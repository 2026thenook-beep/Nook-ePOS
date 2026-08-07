(function (root) {
  'use strict';
  function create(options) {
    options = options || {};
    var transport = options.transport;
    if (!transport || typeof transport.request !== 'function') throw new Error('Server coordinator requires a transport.');
    var writeActions = new Set(['commitTicket','holdOrder','deleteHeldOrder','kitchenUpdate','refundTicket','saveCategory','saveItem','saveItemConfiguration','saveItemConfigurationPatch','savePrompt','savePromptOption','savePromptOptionsBatch','copyItemPrompts','archiveDeleteEntity','saveSetting','saveConfirmedUrl','clearReports','emailReceipt','repairDatabase']);
    var kitchenActions = new Set(['kitchenSnapshot','kitchenUpdate']);
    var liveActions = new Set(['tillLiveSnapshot']);
    var backgroundActions = new Set(['reportsSnapshot','menuSnapshot','serverInfo','connectionCheck','previewDatabaseRepair','diagnosticsRun']);
    var lanes = { write: [], kitchen: [], live: [], general: [], background: [] };
    var active = { write: 0, kitchen: 0, live: 0, general: 0, background: 0, total: 0 };
    var activeJobs = { write: null, kitchen: null, live: null, general: null, background: null };
    var maxTotal = Number(options.maxConcurrent || 3);
    var inFlightReads = new Map();
    var metrics = { queued: 0, completed: 0, failed: 0, deduplicated: 0, slow: 0, lastDurationMs: 0, maxDurationMs: 0 };
    var durationsByAction = {};
    var maintenancePaused = false;
    var readGeneration = 0;
    function laneFor(action) {
      if (writeActions.has(action)) return 'write';
      if (kitchenActions.has(action)) return 'kitchen';
      if (liveActions.has(action)) return 'live';
      if (backgroundActions.has(action)) return 'background';
      return 'general';
    }
    function stable(value) {
      if (!value || typeof value !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
      return '{' + Object.keys(value).sort().map(function(k){ return JSON.stringify(k)+':'+stable(value[k]); }).join(',') + '}';
    }
    function transient(err) {
      var text = String((err && (err.message || err.code)) || '').toLowerCase();
      var status = Number(err && err.status);
      return !err || err.name === 'AbortError' || err.code === 'REQUEST_TIMEOUT' || status === 408 || status === 429 || status >= 500 || /busy|lock|timeout|network|fetch|temporar|service unavailable|quota|rate limit|too many/.test(text);
    }
    function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
    function retryDelaysFor(action, lane) {
      // Reads are polled by the application and should fail fast rather than
      // monopolising a lane with nested retries. Only proven idempotent writes
      // receive short internal retries.
      if (lane !== 'write') return [0];
      if (['commitTicket','holdOrder','deleteHeldOrder','kitchenUpdate','saveCategory','saveItem','saveItemConfiguration','saveItemConfigurationPatch','savePrompt','savePromptOption','savePromptOptionsBatch','saveSetting','saveConfirmedUrl'].indexOf(action) >= 0) {
        return [0, 750, 2000];
      }
      // Refunds, email sends, destructive maintenance and archive/delete
      // operations must not be automatically repeated after an ambiguous result.
      return [0];
    }
    async function runWithRetry(job) {
      var delays = retryDelaysFor(job.action, job.lane);
      var last;
      for (var i=0;i<delays.length;i++) {
        if (delays[i]) await sleep(delays[i] + Math.floor(Math.random()*200));
        try { return await transport.request(job.action, job.payload, job.controller ? { signal: job.controller.signal } : undefined); }
        catch (err) {
          last=err;
          // A deployment 404 is definitive for this URL and must never be
          // multiplied by coordinator retries.
          if (Number(err && err.status) === 404 || !transient(err) || i===delays.length-1) throw err;
        }
      }
      throw last || new Error('Server request failed.');
    }
    function pump() {
      if (active.total >= maxTotal) return;
      ['write','kitchen','live','general','background'].forEach(function(lane){
        if (active.total >= maxTotal || active[lane] || !lanes[lane].length) return;
        var job=lanes[lane].shift(); active[lane]=1; active.total+=1; activeJobs[lane]=job; job.startedAt=Date.now();
        runWithRetry(job).then(function(result){
          if (job.lane !== 'write' && job.readGeneration !== readGeneration) {
            var stale = new Error('Response ignored because a newer synchronisation generation is active.');
            stale.code = 'STALE_RESPONSE';
            metrics.failed+=1;
            job.reject(stale);
            return;
          }
          metrics.completed+=1; job.resolve(result);
        }, function(err){
          if (job.lane !== 'write' && job.readGeneration !== readGeneration) {
            var stale = new Error('Response ignored because a newer synchronisation generation is active.');
            stale.code = 'STALE_RESPONSE';
            metrics.failed+=1;
            job.reject(stale);
            return;
          }
          metrics.failed+=1; job.reject(err);
        })
          .finally(function(){ var duration=Math.max(0,Date.now()-job.startedAt); metrics.lastDurationMs=duration; metrics.maxDurationMs=Math.max(metrics.maxDurationMs,duration); if(duration>=5000) metrics.slow+=1; durationsByAction[job.action]={lastMs:duration,maxMs:Math.max(duration,(durationsByAction[job.action]||{}).maxMs||0)}; if(activeJobs[lane]===job) activeJobs[lane]=null; active[lane]=0; active.total=Math.max(0,active.total-1); if(job.dedupeKey && inFlightReads.get(job.dedupeKey)===job.promise) inFlightReads.delete(job.dedupeKey); pump(); });
      });
    }
    function request(action,payload,requestOptions) {
      requestOptions=requestOptions||{};
      var lane=laneFor(action); var isRead=lane!=='write';
      if (maintenancePaused && lane !== 'write' && requestOptions.allowDuringMaintenance !== true) {
        var pausedError = new Error('Background synchronisation is paused for maintenance.');
        pausedError.code = 'SYNC_PAUSED';
        return Promise.reject(pausedError);
      }
      var dedupeKey=isRead ? readGeneration+'|'+action+'|'+stable(payload||{}) : '';
      if (dedupeKey && inFlightReads.has(dedupeKey)) { metrics.deduplicated+=1; return inFlightReads.get(dedupeKey); }
      var job={action:action,payload:payload||{},resolve:null,reject:null,dedupeKey:dedupeKey,lane:lane,readGeneration:readGeneration,controller:isRead && typeof AbortController !== 'undefined' ? new AbortController() : null,promise:null};
      var promise=new Promise(function(resolve,reject){ job.resolve=resolve; job.reject=reject; lanes[lane].push(job); metrics.queued+=1; pump(); });
      job.promise=promise;
      if (dedupeKey) inFlightReads.set(dedupeKey,promise);
      return promise;
    }
    function invalidateReads(reason, code){
      readGeneration+=1;
      var message=String(reason || 'Request cancelled because a newer synchronisation generation is active.');
      var errorCode=code || 'STALE_RESPONSE';
      ['kitchen','live','general','background'].forEach(function(lane){
        while(lanes[lane].length){
          var job=lanes[lane].shift();
          if(job.dedupeKey && inFlightReads.get(job.dedupeKey)===job.promise) inFlightReads.delete(job.dedupeKey);
          var err=new Error(message); err.code=errorCode; job.reject(err);
        }
        var activeJob=activeJobs[lane];
        if(activeJob && activeJob.controller && typeof activeJob.controller.abort === 'function') activeJob.controller.abort();
      });
      pump();
      return readGeneration;
    }
    function beginMaintenance(){
      maintenancePaused=true;
      invalidateReads('Request cancelled because synchronisation entered maintenance mode.','SYNC_PAUSED');
    }
    function endMaintenance(){ maintenancePaused=false; pump(); }
    function waitForWritesIdle(timeoutMs){
      timeoutMs=Number(timeoutMs||15000); var started=Date.now();
      return new Promise(function(resolve){ (function check(){ if(!active.write && !lanes.write.length) return resolve(true); if(Date.now()-started>=timeoutMs) return resolve(false); setTimeout(check,50); })(); });
    }
    function snapshot(){ return {maintenancePaused:maintenancePaused,readGeneration:readGeneration,metrics:Object.assign({},metrics), durationsByAction:Object.assign({},durationsByAction), active:Object.assign({},active), queued:{write:lanes.write.length,kitchen:lanes.kitchen.length,live:lanes.live.length,general:lanes.general.length,background:lanes.background.length}}; }
    return Object.freeze({request:request,snapshot:snapshot,laneFor:laneFor,beginMaintenance:beginMaintenance,endMaintenance:endMaintenance,invalidateReads:invalidateReads,waitForWritesIdle:waitForWritesIdle});
  }
  root.NookServerCoordinator = Object.freeze({create:create});
})(typeof window !== 'undefined' ? window : globalThis);

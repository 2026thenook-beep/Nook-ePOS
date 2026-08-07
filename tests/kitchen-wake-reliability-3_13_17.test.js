const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');
const path=require('path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
const release=fs.readFileSync(path.join(root,'js','release.js'),'utf8');
const foundation=fs.readFileSync(path.join(root,'js','foundation.js'),'utf8');
const coordinatorSource=fs.readFileSync(path.join(root,'js','server-coordinator.js'),'utf8');

test('Kitchen polling is disabled while the page is hidden',()=>{
  assert.match(release,/appVersion: '3\.13\.20'/);
  assert.doesNotMatch(release,/kitchenHiddenPollIntervalMs/);
  const allowed=app.slice(app.indexOf('function kitchenSyncAllowed()'),app.indexOf('function kitchenAdaptivePollInterval()'));
  assert.match(allowed,/document\.visibilityState !== 'hidden'/);
  const sync=app.slice(app.indexOf('async function syncKitchenQueue'),app.indexOf('function runSyncCoordinator'));
  assert.match(sync,/document\.visibilityState === 'hidden'/);
});

test('hidden-page transition invalidates old reads and Kitchen in-flight state',()=>{
  assert.match(app,/function invalidateReadsForHiddenPage\(\)/);
  assert.match(app,/uiReadGeneration \+= 1/);
  assert.match(app,/kitchenPollEpoch \+= 1/);
  assert.match(app,/kitchenPollInFlight = false/);
  assert.match(app,/ServerCoordinator\.invalidateReads/);
  const start=app.indexOf("document.addEventListener('visibilitychange'");
  const vis=app.slice(start,app.indexOf("window.addEventListener('beforeunload'",start));
  assert.match(vis,/invalidateReadsForHiddenPage\(\)/);
  assert.match(vis,/state\.activeTab === 'Kitchen' \? 0 : 750/);
});

test('stale Kitchen finalizer cannot clear a newer foreground request',()=>{
  const sync=app.slice(app.indexOf('async function syncKitchenQueue'),app.indexOf('function runSyncCoordinator'));
  assert.match(sync,/var pollEpoch = kitchenPollEpoch/);
  assert.match(sync,/if \(pollEpoch !== kitchenPollEpoch\) return/);
});

test('Kitchen wake refresh happens before a generic connection check',()=>{
  const wake=app.slice(app.indexOf('async function runWakeConsistencyCheck'),app.indexOf('async function resumeBackgroundSyncAfterWake'));
  const kitchen=wake.indexOf("state.activeTab === 'Kitchen'");
  const snapshot=wake.indexOf('await syncKitchenQueue({ silent: true, foregroundWake: true })');
  const connection=wake.indexOf("await api('connectionCheck')");
  assert.ok(kitchen>=0 && snapshot>kitchen && connection>snapshot);
});

test('server coordinator invalidation aborts an old read and permits a fresh generation',async()=>{
  const sandbox={globalThis:{},setTimeout,clearTimeout,console,Set,Map,Promise,Date,Math,Error,Object,Array,Number,String,JSON,AbortController};
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(coordinatorSource,sandbox);
  let calls=0;
  const coord=sandbox.NookServerCoordinator.create({transport:{request:(action,payload,options)=>{
    calls++;
    if(calls===1){
      return new Promise((resolve,reject)=>{
        const signal=options&&options.signal;
        if(signal) signal.addEventListener('abort',()=>{const e=new Error('cancelled');e.name='AbortError';reject(e);},{once:true});
      });
    }
    return Promise.resolve({ok:true,generation:calls});
  }}});
  const first=coord.request('kitchenSnapshot',{sinceRevision:'x'});
  await new Promise(r=>setTimeout(r,10));
  coord.invalidateReads('browser hidden');
  const second=coord.request('kitchenSnapshot',{sinceRevision:'x'});
  await assert.rejects(first,e=>e&&e.code==='STALE_RESPONSE');
  const result=await second;
  assert.equal(result.ok,true);
  assert.equal(calls,2);
});

test('API client distinguishes external cancellation from timeout',()=>{
  assert.match(foundation,/requestOptions = requestOptions \|\| \{\}/);
  assert.match(foundation,/REQUEST_ABORTED/);
  assert.match(foundation,/externalSignal/);
});

test('read invalidation never cancels an active write',async()=>{
  const sandbox={globalThis:{},setTimeout,clearTimeout,console,Set,Map,Promise,Date,Math,Error,Object,Array,Number,String,JSON,AbortController};
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(coordinatorSource,sandbox);
  let finishWrite;
  const coord=sandbox.NookServerCoordinator.create({transport:{request:(action)=>{
    if(action==='commitTicket') return new Promise(resolve=>{finishWrite=()=>resolve({ok:true});});
    return Promise.resolve({ok:true});
  }}});
  const write=coord.request('commitTicket',{clientRequestId:'wake-write-safety'});
  await new Promise(r=>setTimeout(r,10));
  coord.invalidateReads('browser hidden');
  finishWrite();
  const result=await write;
  assert.equal(result.ok,true);
});

const fs = require('fs');
const assert = require('assert');
const app = fs.readFileSync('js/app.js', 'utf8');

function extract(from, to) {
  const start = app.indexOf('  ' + from);
  const end = app.indexOf('  ' + to, start + 2);
  assert(start >= 0 && end > start, `could not extract ${from}`);
  return app.slice(start, end);
}

const dateSource = app.slice(app.indexOf('  function todayDateString(date) {'), app.indexOf('  function dateInPeriod', app.indexOf('  function todayDateString(date) {')));
const combineSource = extract('function combineReportSnapshots(snapshots) {', 'function focusedRefreshOverlay');
const refreshSource = extract('async function refreshReportsData(options) {', 'async function refreshTicketHistoryData');

function makeHarness(apiImpl) {
  const state = {
    reportFrom: '2026-08-07', reportTo: '2026-08-07', reportLoadedDate: '',
    reportComparisonAvailability: {previous:false,lastWeek:false}, activeTab: 'Reports',
    focusedRefresh: {reports:{inFlight:false,requestedDate:'',pendingDate:'',updatedAt:'',error:'',warning:''}},
    data: {}
  };
  const merged = [];
  const calls = [];
  const api = async (action, payload) => { calls.push({action,payload:{...payload}}); return apiImpl(action,payload); };
  const factory = new Function('state','api','merged',
    `var uiReadGeneration=0;
     function renderReports(){}
     function focusedRefreshOverlay(){}
     function mergeTransactionData(data){ state.data=data; merged.push(data); }
     function clearSyncFault(){}
     function recoverStatusIfHealthy(){}
     function isStaleResponseError(err){ return !!(err && err.code==='STALE_RESPONSE'); }
     function markSyncFault(){}
     function toast(){}
     function hideBusyMessage(){}
     ${dateSource}
     ${combineSource}
     ${refreshSource}
     return {refreshReportsData};`);
  return {state,calls,merged,...factory(state,api,merged)};
}

(async () => {
  const h = makeHarness(async (action,payload) => ({data:{tickets:[{TicketID:payload.fromDate,CreatedAt:payload.fromDate+'T10:00:00'}],ticketItems:[],ticketAddOns:[],refunds:[],refundItems:[]}}));
  await h.refreshReportsData();
  assert.deepStrictEqual(h.calls.map(x=>x.payload), [
    {fromDate:'2026-08-07',toDate:'2026-08-07'},
    {fromDate:'2026-08-06',toDate:'2026-08-06'},
    {fromDate:'2026-07-31',toDate:'2026-07-31'}
  ]);
  assert.strictEqual(h.state.reportLoadedDate,'2026-08-07');
  assert.deepStrictEqual(h.state.data.tickets.map(t=>t.TicketID), ['2026-08-07','2026-08-06','2026-07-31']);
  assert.deepStrictEqual(h.state.reportComparisonAvailability,{previous:true,lastWeek:true});

  let resolveFirst;
  let first = true;
  const h2 = makeHarness(async (action,payload) => {
    if (first) {
      first=false;
      return new Promise(resolve => { resolveFirst = () => resolve({data:{tickets:[],ticketItems:[],ticketAddOns:[],refunds:[],refundItems:[]}}); });
    }
    return {data:{tickets:[],ticketItems:[],ticketAddOns:[],refunds:[],refundItems:[]}};
  });
  const oldPromise = h2.refreshReportsData();
  await new Promise(r=>setTimeout(r,0));
  h2.state.reportFrom='2026-08-04'; h2.state.reportTo='2026-08-04';
  await h2.refreshReportsData();
  assert.strictEqual(h2.state.focusedRefresh.reports.pendingDate,'2026-08-04','new date must be queued while old read is active');
  resolveFirst();
  await oldPromise;
  await new Promise(r=>setTimeout(r,20));
  // Old date must not continue to its comparison calls. The queued latest date must run all three exact reads.
  assert.deepStrictEqual(h2.calls.map(x=>x.payload), [
    {fromDate:'2026-08-07',toDate:'2026-08-07'},
    {fromDate:'2026-08-04',toDate:'2026-08-04'},
    {fromDate:'2026-08-03',toDate:'2026-08-03'},
    {fromDate:'2026-07-28',toDate:'2026-07-28'}
  ]);
  assert.strictEqual(h2.state.reportLoadedDate,'2026-08-04');
  console.log('3.13.20 report refresh behavioural checks passed');
})().catch(err => { console.error(err); process.exit(1); });

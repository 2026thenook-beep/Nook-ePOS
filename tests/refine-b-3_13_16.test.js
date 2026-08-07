const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'google','Code.gs'),'utf8');
const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
const release=fs.readFileSync(path.join(root,'js','release.js'),'utf8');
const build=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'),'utf8'));

assert.strictEqual(build.release,'3.13.19');
assert.strictEqual(build.frontendVersion,'3.13.19');
assert.strictEqual(build.backendVersion,'3.13.18');
assert.strictEqual(build.databaseVersion,'1.0.6');
assert(release.includes("appVersion: '3.13.19'"));
assert(release.includes("acceptedBackendVersions: Object.freeze(['3.13.18', '3.13.17', '3.13.16'])"));
assert(code.includes("var NOOK_VERSION = '3.13.18';"));

const rangeStart=code.indexOf('function transactionSnapshotForRange_');
const rangeEnd=code.indexOf('function reportsSnapshotResponse_',rangeStart);
const range=code.slice(rangeStart,rangeEnd);
assert(range.includes("rowNumbersMatchingDateRange_('Tickets', 'CreatedAt'"));
assert(range.includes("rowNumbersMatchingDateRange_('Refunds', 'CreatedAt'"));
assert(range.includes("rowNumbersMatchingIds_('TicketItems', 'TicketID'"));
assert(range.includes("rowNumbersMatchingIds_('TicketAddOns', 'TicketID'"));
assert(range.includes("rowNumbersMatchingIds_('RefundItems', 'RefundID'"));
assert(!range.includes("rowsToObjects_('Tickets').filter"));
assert(!range.includes("rowsToObjects_('TicketItems').filter"));
assert(!range.includes("rowsToObjects_('TicketAddOns').filter"));
assert(!range.includes("rowsToObjects_('Refunds').filter"));
assert(!range.includes("rowsToObjects_('RefundItems').filter"));

const duplicateStart=code.indexOf('function ticketBundleByClientRequestId_');
const duplicateEnd=code.indexOf('function nextTicketNumber_',duplicateStart);
const duplicate=code.slice(duplicateStart,duplicateEnd);
assert(duplicate.includes("firstRowNumberMatchingValue_('Tickets', 'ClientRequestID'"));
assert(!duplicate.includes("rowsToObjects_('Tickets')"));

const kitchenStart=code.indexOf('function kitchenUpdate_');
const kitchenEnd=code.indexOf('function refundTicket_',kitchenStart);
const kitchen=code.slice(kitchenStart,kitchenEnd);
assert(kitchen.includes('var categoriesById = {};'));
assert.strictEqual((kitchen.match(/rowsToObjects_\('Categories'\)/g)||[]).length,1);
assert(code.includes("toUpperCase() !== 'COMPLETE'"));

const confirmedStart=code.indexOf('function saveConfirmedUrl_');
const confirmedEnd=code.indexOf('function commitTicket_',confirmedStart);
const confirmed=code.slice(confirmedStart,confirmedEnd);
assert(confirmed.includes("setKeyValuesBatch_('Settings'"));
assert(!confirmed.includes("saveSetting_('LastConfirmedScriptUrl'"));

assert(code.includes('var NOOK_RUNTIME_CACHE_'));
assert(code.includes('function resetRuntimeCache_()'));
assert(code.includes('function doGet(e) {\n  resetRuntimeCache_();'));
assert(code.includes('function doPost(e) {\n  resetRuntimeCache_();'));
assert(code.includes('NOOK_RUNTIME_CACHE_.headers'));
assert(code.includes('function setKeyValuesBatch_'));

assert(app.includes('function serverCacheData_()'));
assert(app.includes('cached.tickets = [];'));
assert(app.includes('cached.ticketItems = [];'));
assert(app.includes('cached.ticketAddOns = [];'));
assert(app.includes('cached.refunds = [];'));
assert(app.includes('cached.refundItems = [];'));

console.log('NOOK-REFINE-B 3.13.18 checks passed');

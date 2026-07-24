const assert = require('assert');
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '..', 'google', 'Code.gs'), 'utf8');

assert(code.includes("if (action === 'bootstrap') return json_(bootstrapResponse_())"), 'bootstrap should use read response without the global write lock');
assert(code.includes("if (action === 'serverInfo') return json_(serverInfoResponse_())"), 'serverInfo should use read response without the global write lock');
assert(code.includes('function nonBlockingRepairForRead_()'), 'non-blocking read repair helper should exist');
assert(code.includes('return previewDatabaseRepair_();'), 'read helper should remain read-only and return a preview');
assert(code.includes('function withWriteLock_'), 'write lock helper should exist');
assert(code.includes('function withMaintenanceLock_'), 'maintenance lock helper should exist');
assert(code.includes("return withWriteLock_(function ()"), 'commitTicket should still use write locking for strict persistence');
assert(!/if \(action === 'bootstrap'\) return json_\(withLock_/.test(code), 'bootstrap must not be wrapped in withLock_');
assert(!/if \(action === 'serverInfo'\) return json_\(withLock_/.test(code), 'serverInfo must not be wrapped in withLock_');

console.log('Read-only startup and lock routing tests passed');

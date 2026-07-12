const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('google/Code.gs', 'utf8');
vm.runInNewContext(code, { console });

assert(code.includes("action === 'setupDatabase' || action === 'repairDatabase'"), 'repairDatabase action must be exposed');
assert(code.includes('function repairDatabase_'), 'repairDatabase_ must exist');
assert(code.includes('function ensureSheetSchema_'), 'ensureSheetSchema_ must exist');
assert(code.includes("Added missing column(s)"), 'repair should append missing columns');
assert(!/setupSheets_\(\);\s*if \(action === 'commitTicket'\)/.test(code), 'normal commit path should not run old full setup before every payment');
assert(code.includes("'LoyaltyTotal'"), 'Tickets loyalty column must remain in schema');
assert(code.includes("'IsDrinkCategory'"), 'Category drink flag must remain in schema');

console.log('Database repair static tests passed');
assert(code.includes('DeletedItems'), 'DeletedItems archive sheet must be part of schema/repair');
assert(code.includes('function archiveDeleteEntity_'), 'archive delete backend function must exist');
assert(code.includes("action === 'archiveDeleteEntity'"), 'archive delete action must be exposed');
assert(code.includes('function saveConfirmedUrl_'), 'confirmed URL backend function must exist');
assert(code.includes("action === 'saveConfirmedUrl'"), 'confirmed URL action must be exposed');

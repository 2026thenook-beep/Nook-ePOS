const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const gs = fs.readFileSync(path.join(root, 'google/Code.gs'), 'utf8');
function ok(value, message) { if (!value) throw new Error(message); }
[
  'authoriseEmailService',
  'sendTestEmailToScriptOwner',
  'runSystemDiagnostics',
  'repairSpreadsheet',
  'setupOrRepairDatabase',
  'verifyDatabaseConnection'
].forEach(name => ok(gs.includes('function ' + name + '()'), name + ' must remain visible in Apps Script'));
ok(gs.includes('MailApp.getRemainingDailyQuota()'), 'Email authorisation must invoke MailApp');
ok(gs.includes("repairDatabase_({ seedIfEmpty: false })"), 'Safe repair must avoid demonstration seeding');
ok(gs.includes("repairDatabase_({ seedIfEmpty: true })"), 'Setup repair must support required seed defaults');
console.log('3.13.18 maintenance tools test passed');

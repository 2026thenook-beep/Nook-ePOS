const fs = require('fs');
const assert = require('assert');
const app = fs.readFileSync('js/app.js','utf8');
const css = fs.readFileSync('css/app.css','utf8');
const index = fs.readFileSync('index.html','utf8');
const release = fs.readFileSync('js/release.js','utf8');
[
  'Refresh Local Data','Repair Connection','Factory Reset Device','Test Server','Reload Menu','Force Till Refresh',
  'Device Information','Connection Diagnostics','Engineer Mode'
].forEach(text => assert(app.includes(text), `Missing UI/function text: ${text}`));
[
  "data-action=\"test-server\"","data-action=\"reload-menu\"","data-action=\"force-till-update\"",
  "data-action=\"refresh-local-data\"","data-action=\"repair-connection\"","data-action=\"factory-reset-device\"",
  "data-action=\"save-device-profile\""
].forEach(text => assert(app.includes(text), `Missing action: ${text}`));
assert(app.includes('DEVICE_PROFILE_KEY'), 'Persistent device identity key missing');
assert(app.includes('attachEngineerModeLongPress'), 'Long press Engineer Mode missing');
assert(app.includes('QueueManager.pendingCount()'), 'Pending transaction diagnostics missing');
assert(app.includes('QueueManager.outboxPendingCount()'), 'Outbox diagnostics missing');
assert(css.includes('.engineer-mode-panel'), 'Engineer Mode styling missing');
assert(index.includes('3.14.1'), 'Index version mismatch');
assert(release.includes("appVersion: '3.14.1'"), 'Release version mismatch');
console.log('verified device diagnostics 3.14.1 passed');

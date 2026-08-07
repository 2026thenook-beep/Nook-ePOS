const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

test('unchanged Kitchen success clears the matching stored fault', () => {
  const sync = app.slice(app.indexOf('async function syncKitchenQueue'), app.indexOf('function runSyncCoordinator'));
  const unchanged = sync.slice(sync.indexOf('if (res.data.unchanged === true)'), sync.indexOf("if (!Array.isArray(res.data.kitchenQueue))"));
  assert.match(unchanged, /state\.status\.read = 'OK'/);
  assert.match(unchanged, /clearSyncFault\('kitchen'\)/);
  assert.match(unchanged, /recoverStatusIfHealthy\(\)/);
  assert.match(unchanged, /if \(state\.activeTab === 'Kitchen'\) renderStatus\(\)/);
});

test('successful silent Kitchen poll repaints the status bar', () => {
  const sync = app.slice(app.indexOf('async function syncKitchenQueue'), app.indexOf('function runSyncCoordinator'));
  assert.match(sync, /A successful Kitchen read must visibly clear a previous Kitchen refresh error/);
  assert.match(sync, /if \(state\.activeTab === 'Kitchen'\) renderStatus\(\);/);
  assert.doesNotMatch(sync, /else if \(!options\.silent && state\.activeTab === 'Kitchen'\)/);
});

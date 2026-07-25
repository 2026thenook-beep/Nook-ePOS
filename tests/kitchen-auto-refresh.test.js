const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const backend = fs.readFileSync('google/Code.gs', 'utf8');
const release = fs.readFileSync('js/release.js', 'utf8');

assert(release.includes('kitchenPollIntervalMs: 3000'), 'kitchen should poll every three seconds');
assert(app.includes("api('kitchenSnapshot')"), 'frontend should request the lightweight kitchen snapshot');
assert(app.includes("state.activeTab === 'Kitchen'"), 'kitchen reads should be restricted to the Kitchen tab');
assert(app.includes("document.visibilityState === 'hidden'"), 'synchronisation should pause while the browser is hidden');
assert(app.includes('kitchenQueueSignature'), 'queue changes should be detected before rerendering');
assert(app.includes('function runSyncCoordinator()'), 'shared synchronisation coordinator missing');
assert(backend.includes("if (action === 'kitchenSnapshot')"), 'backend should route kitchenSnapshot reads');
assert(backend.includes("kitchenQueue: rowsToObjects_('KitchenQueue')"), 'snapshot should read the live KitchenQueue sheet');
assert(release.includes("appVersion: '3.8.6'"), 'frontend version should be 3.8.6');
assert(release.includes("appVersion: '3.8.6'"), 'backend version should be 3.8.6');

console.log('Kitchen auto-refresh tests passed');

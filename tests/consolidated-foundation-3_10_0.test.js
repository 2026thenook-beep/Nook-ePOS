const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const release = fs.readFileSync('js/release.js', 'utf8');
const backend = fs.readFileSync('google/Code.gs', 'utf8');
const build = JSON.parse(fs.readFileSync('build-info.json', 'utf8'));

assert.strictEqual(build.release, '3.13.22');
assert.strictEqual(build.frontendVersion, '3.13.22');
assert.strictEqual(build.backendVersion, '3.13.18');
assert.strictEqual(build.mergeSource, '3.10.0');
assert.strictEqual(build.consolidationReference, 'NOOK-PATCH-MERGE-3.10.0-R01');
assert.match(release, /appVersion:\s*'3\.13\.22'/);
assert.match(backend, /3\.13\.18/);
assert.match(index, /app\.css\?v=3\.13\.22/);
assert.match(index, /app\.js\?v=3\.13\.22/);

// Automatic post-payment prompting must use the guarded scheduler, never a direct modal call.
assert.match(app, /scheduleOrderTypePrompt\('post-payment'\)/);
assert.doesNotMatch(app, /showOrderTypePrompt\('post-payment'\)/);

// Keep one current payment choice route and no confusing mixed-payment option.
assert.match(app, /select-payment-method/);
assert.match(app, /data-method="Cash"/);
assert.match(app, /data-method="Card"/);
assert.doesNotMatch(app, /data-method="Mixed"|Mixed payment/i);

// Kitchen feedback remains non-blocking through inline Saving/Reopen states.
assert.match(app, /kitchenPendingUpdates/);
assert.match(app, /Saving…/);
assert.doesNotMatch(app, /showBusyMessage\([^\n]*Kitchen/);

console.log('3.13.18 consolidated foundation checks passed.');

const fs = require('fs');
const assert = require('assert');
const app = fs.readFileSync('js/app.js', 'utf8');
const build = JSON.parse(fs.readFileSync('build-info.json', 'utf8'));

assert.strictEqual(build.release, '3.8.6');
assert(!/CategoryName:\s*text\(item\.CategoryName\)/.test(app), 'derived CategoryName must not participate in dirty comparison');
assert(app.includes("option.Active = existing && Object.prototype.hasOwnProperty.call(existing, 'Active') ? Core.active(existing.Active) : true;"), 'existing inactive option state must be preserved');
assert(app.includes('state.dirtyPromptOptions = {};') && app.includes('state.promptOptionOriginals = {};'), 'legacy option dirty state must be reset with authoritative baseline');
assert(app.includes('state.adminDirty.item = {};') && app.includes('state.adminDirty.prompt = {};'), 'legacy item/prompt dirty state must be reset with authoritative baseline');
assert(app.includes("JSON.stringify(collectAdminItemConfiguration()) !== JSON.stringify(state.adminItemBaseline)"), 'unified normalized snapshot comparison must remain authoritative');
console.log('3.8.6 false dirty-state regression checks passed');

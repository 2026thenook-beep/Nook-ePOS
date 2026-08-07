const fs = require('fs');
const assert = require('assert');
const app = fs.readFileSync('js/app.js', 'utf8');
const build = JSON.parse(fs.readFileSync('build-info.json', 'utf8'));

assert.strictEqual(build.release, '3.13.20');
assert(!/CategoryName:\s*text\(item\.CategoryName\)/.test(app), 'derived CategoryName must not participate in dirty comparison');
assert(app.includes("option.Active = Object.prototype.hasOwnProperty.call(option, 'Active') ? Core.truthy(option.Active) : true;"), 'explicit option Active state must be collected without creating false dirty state');
assert(app.includes('state.dirtyPromptOptions = {};') && app.includes('state.promptOptionOriginals = {};'), 'legacy option dirty state must be reset with authoritative baseline');
assert(app.includes('state.adminDirty.item = {};') && app.includes('state.adminDirty.prompt = {};'), 'legacy item/prompt dirty state must be reset with authoritative baseline');
assert(app.includes("JSON.stringify(collectAdminItemConfiguration()) !== JSON.stringify(state.adminItemBaseline)"), 'unified normalized snapshot comparison must remain authoritative');
console.log('3.13.18 false dirty-state regression checks passed');

const fs = require('fs');
const assert = require('assert');

const css = fs.readFileSync('css/app.css', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const build = JSON.parse(fs.readFileSync('build-info.json', 'utf8'));

assert.equal(build.release, '3.13.22');
assert.equal(build.frontendVersion, '3.13.22');
assert.equal(build.backendVersion, '3.13.18');
assert(app.includes('class="layout-category-wrap'), 'Till categories must still use the layout wrapper');
assert(css.includes('.layout-category-wrap{display:inline-flex;position:relative;align-items:center;flex:0 0 auto;min-width:0}'), 'category wrappers must not shrink');
assert(css.includes('@media (max-width:1180px){.category-strip>.layout-category-wrap{flex:0 0 auto}'), 'tablet strip must explicitly keep category wrappers non-shrinking');
assert(css.includes('.category-strip>.layout-category-wrap>.pill-btn{display:block;max-width:180px;overflow-wrap:anywhere}'), 'long category labels must remain contained on tablet');
assert(css.includes('.category-strip { flex-wrap:nowrap; overflow-x:auto;'), 'tablet category strip must remain horizontally scrollable');

console.log('3.13.22 iPad category layout checks passed.');

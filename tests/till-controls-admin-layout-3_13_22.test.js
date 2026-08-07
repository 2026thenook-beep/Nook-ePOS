const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
const build = JSON.parse(fs.readFileSync(path.join(root, 'build-info.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
const release = fs.readFileSync(path.join(root, 'js/release.js'), 'utf8');

assert.strictEqual(build.release, '3.13.22');
assert.strictEqual(build.frontendVersion, '3.13.22');
assert.strictEqual(build.backendVersion, '3.13.18');
assert(release.includes("acceptedBackendVersions: Object.freeze(['3.13.18', '3.13.17', '3.13.16'])"));

// Normal selling Till must no longer carry a permanent layout-edit launcher.
assert(!app.includes("'<div class=\"till-layout-launch\"><button class=\"secondary compact\" data-action=\"edit-till-layout\">Edit menu layout</button></div>'"), 'normal Till still contains the old Edit menu layout launcher');
assert(app.includes('data-action="edit-till-layout-from-admin">Edit Till layout</button>'), 'Menu Admin must expose Edit Till layout');
assert(app.includes("if (action === 'edit-till-layout-from-admin') { await openTillLayoutFromAdmin(); return; }"), 'Menu Admin layout action handler missing');
assert(app.includes('async function openTillLayoutFromAdmin()'), 'Admin-to-Till layout entry function missing');
assert(app.includes("if (state.cart.length)"), 'layout editing must still refuse a live basket');
assert(app.includes("if (!(await guardAdminNavigation())) return;"), 'unsaved Menu Admin edits must be guarded');
assert(app.includes("applyPendingMenuIfSafe('Till');"), 'safe pending menu update should be applied before layout editing');
assert(app.includes("state.activeTab = 'Till';"), 'layout editor must navigate to the Till');
assert(app.includes('state.tillLayoutEditMode = true;'), 'layout edit mode must be enabled');

// Modifier controls remain a two-button operational row and must not be clipped at short iPad heights.
assert(app.includes('<div class="ticket-secondary-controls">'), 'modifier row missing');
assert(app.includes('data-action="toggle-loyalty"'), 'Apply loyalty action missing');
assert(app.includes('data-action="toggle-staff-discount"'), 'Staff discount action missing');
assert(css.includes('/* 3.13.22 Till modifier controls and Menu Admin layout-entry refinement. */'), '3.13.22 CSS marker missing');
assert(css.includes('.ticket-secondary-controls {\n  flex: 0 0 auto;\n  max-height: none;\n  overflow: visible;'), 'modifier row must not be height-clipped');
assert(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'), 'modifier row must retain two equal columns on supported Till layouts');
assert(css.includes('@media (max-height: 760px) and (min-width: 701px)'), 'short iPad viewport override missing');
assert(css.includes('.ticket-secondary-controls { max-height: none; overflow: visible; }'), 'short viewport must explicitly defeat old clipping rule');

console.log('3.13.22 Till modifier controls and Menu Admin layout-entry checks passed.');

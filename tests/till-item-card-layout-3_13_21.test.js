const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
const build = JSON.parse(fs.readFileSync('build-info.json', 'utf8'));

assert.strictEqual(build.release, '3.13.22');
assert.strictEqual(build.frontendVersion, '3.13.22');
assert.strictEqual(build.backendVersion, '3.13.18');

const renderStart = app.indexOf('function renderTill()');
const renderEnd = app.indexOf('function renderTicketPanel()', renderStart);
const till = app.slice(renderStart, renderEnd);
assert(till.includes('<span class="item-card-copy">'), 'Till item cards need a dedicated copy column');
assert(till.includes('<span class="loyalty-menu-badge">LOYALTY</span>'), 'loyalty badge must remain visible on eligible items');
assert(till.includes('<span class="item-name">'), 'item name must remain visible');
assert(till.includes('<span class="item-desc">'), 'item description must remain visible when configured');
assert(!till.includes('<span><span class="item-name">'), 'name/description must not use the old inline anonymous wrapper');

const copyPos = till.indexOf('<span class="item-card-copy">');
const loyaltyPos = till.indexOf('<span class="loyalty-menu-badge">LOYALTY</span>', copyPos);
const namePos = till.indexOf('<span class="item-name">', copyPos);
const descPos = till.indexOf('<span class="item-desc">', copyPos);
const pricePos = till.indexOf('<span class="item-price">', copyPos);
assert(loyaltyPos > copyPos && loyaltyPos < namePos, 'loyalty indicator must render above the item name');
assert(namePos < descPos, 'description must render after the item name');
assert(descPos < pricePos, 'price must remain after the descriptive copy');

assert(css.includes('.item-card-copy { display:flex; flex-direction:column;'), 'item copy must be a vertical column');
assert(css.includes('.item-name { display:block;'), 'item name must be a block');
assert(css.includes('.item-desc { display:block;'), 'description must be a block below the name');
assert(css.includes('.loyalty-menu-badge { position:static;'), 'loyalty badge must participate in normal layout flow');
assert(!css.includes('.loyalty-menu-badge { position: absolute;'), 'loyalty badge must not overlay item text');
assert(css.includes('/* 3.13.21 Till item-card hierarchy: loyalty badge in flow, name above description. */'), '3.13.22 responsive item-card rule missing');

console.log('3.13.22 Till item-card hierarchy checks passed.');

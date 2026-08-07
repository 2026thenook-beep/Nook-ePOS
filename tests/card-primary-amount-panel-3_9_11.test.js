const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

test('card confirmation uses a dedicated large primary amount panel', () => {
  assert.match(app, /<div class="card-payment-primary-panel"><span>CARD PAYMENT<\/span><strong>' \+ Core\.money\(totals\.total\)/);
  assert.match(css, /\.card-payment-primary-panel strong \{ font-size:48px; line-height:1\.05; font-weight:1000; \}/);
});

test('cash primary change panel remains unchanged', () => {
  assert.match(css, /\.cash-change-panel strong \{ font-size:48px; line-height:1\.05; font-weight:1000; \}/);
  assert.match(app, /label: 'CHANGE'/);
});

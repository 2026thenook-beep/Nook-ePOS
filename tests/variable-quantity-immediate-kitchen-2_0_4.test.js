const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'google', 'Code.gs'), 'utf8');
const presentation = fs.readFileSync(path.join(root, 'js', 'presentation.js'), 'utf8');

assert(app.includes('function addOnUsesVariableQuantity(addOn)'));
assert(presentation.includes("text += ' ×' + quantity"));
assert(app.includes('option-variable-label'));
assert(!app.includes("var radio = card.querySelector('input[type=\"radio\"],input[type=\"checkbox\"]')"));
assert(app.includes("state.kitchenRecentlyCompleted[id] = true;\n    renderKitchen();"));
assert(app.includes('}, 1800);'));
assert(backend.includes('function receiptVariableQuantityMap_()'));
assert(backend.includes('function receiptAddOnText_(addOn, variableMap)'));
console.log('3.8.6 variable quantity and immediate kitchen completion tests passed');

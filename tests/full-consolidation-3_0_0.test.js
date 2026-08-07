const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const root = __dirname + '/..';
const index = fs.readFileSync(root + '/index.html', 'utf8');
const app = fs.readFileSync(root + '/js/app.js', 'utf8');

['models.js', 'presentation.js', 'operations.js'].forEach(name => {
  assert(index.includes('js/' + name + '?v=3.13.20'), name + ' must be loaded by index.html');
});
assert(app.includes('Models.normaliseData(data)'), 'app must use canonical data normalisation');
assert(app.includes('Presentation.renderAddOnList'), 'app must use the shared modifier renderer');
assert(!app.includes("function escapeHtml(value)"), 'duplicate app HTML escaping must be removed');

const context = { console, setInterval, clearInterval, Promise };
context.globalThis = context;
vm.createContext(context);
for (const name of ['core.js', 'models.js', 'presentation.js', 'operations.js']) {
  vm.runInContext(fs.readFileSync(root + '/js/' + name, 'utf8'), context);
}
const data = context.NookModels.normaliseData({ tickets: null });
assert.deepStrictEqual(Array.from(data.tickets), []);
const text = context.NookPresentation.addOnDisplayText(
  { OptionText: 'Extra Bacon', Quantity: 2, UnitPrice: 1, AllowValue: true },
  { core: context.NookCore, models: context.NookModels, includePrice: false }
);
assert.strictEqual(text, 'Extra Bacon ×2');
console.log('3.13.18 consolidation tests passed');

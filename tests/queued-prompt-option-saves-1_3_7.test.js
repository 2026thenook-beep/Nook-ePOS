const fs = require('fs');
const app = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/app.css', 'utf8');
function expect(text, message) { if (!text) throw new Error(message); }
expect(app.includes('dirtyPromptOptions'), 'Missing queued option state');
expect(app.includes('savePromptOptions(promptId)'), 'Missing batch prompt option save');
expect(app.includes('Save option changes ('), 'Missing combined save button count');
expect(app.includes('confirmDiscardPromptOptionChanges'), 'Missing unsaved changes navigation guard');
expect(app.includes("event.returnValue = ''"), 'Missing browser close/refresh warning');
expect(app.includes("markPromptOptionDirty(o.OptionID, null)"), 'New options are not queued');
expect(!app.includes('data-action="save-option" data-id='), 'Individual option Save button is still rendered');
expect(css.includes('.unsaved-option-warning'), 'Missing unsaved warning styling');
console.log('Queued prompt option saves 3.13.18 checks passed');

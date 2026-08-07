const fs=require('fs'); const assert=require('assert');
const app=fs.readFileSync('js/app.js','utf8'); const back=fs.readFileSync('google/Code.gs','utf8'); const css=fs.readFileSync('css/app.css','utf8');
assert(app.includes('KitchenPromptTitlesEnabled'));
assert(app.includes('ShowTitleOnKDS'));
assert(app.includes('renderKitchenAddOns'));
assert(app.includes('Show prompt title on Kitchen Display'));
assert(back.includes("'ShowTitleOnKDS'"));
assert(css.includes('.kds-prompt-title'));
console.log('KDS prompt titles 3.13.18 checks passed');

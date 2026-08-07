const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync('js/app.js', 'utf8');
const backend = fs.readFileSync('google/Code.gs', 'utf8');

assert(app.includes("action: 'saveItemConfigurationPatch'"), 'item configuration should save in one API action');
assert(!app.includes("for (var pIndex = 0; pIndex < config.prompts.length; pIndex++) await saveServerEntity('savePrompt'"), 'frontend must not save prompts in serial requests');
assert(app.includes('function pickItem(item)'), 'dirty snapshot must use canonical item fields');
assert(app.includes('function pickPrompt(prompt)'), 'dirty snapshot must use canonical prompt fields');
assert(app.includes('function pickOption(option)'), 'dirty snapshot must use canonical option fields');
assert(backend.includes("action === 'saveItemConfigurationPatch'"), 'backend must expose consolidated save action');
assert(backend.includes('function saveItemConfigurationPatch_(patch)'), 'backend must save the configuration under one write lock');
console.log('fast configuration save 3.13.18 checks passed');

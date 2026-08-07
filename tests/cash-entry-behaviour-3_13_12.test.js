const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
assert(app.includes("state.ticketMeta.CashPaid = '';\n    var digits = '';"), 'cash payment must start with blank Cash Received');
assert(app.includes('data-cash-entry-source="empty"'), 'cash display must track entry source');
assert(app.includes("if (source !== 'manual') digits = '';"), 'first typed digit after preset must replace preset');
assert(app.includes("if (action === 'exact') {\n      digits = String(Math.round(currentTotals().total * 100));\n      source = 'preset';"), 'Exact Amount must populate amount due as Cash Received');
assert(app.includes("display.setAttribute('data-cash-entry-source', source);"), 'cash entry source must be persisted in display state');
console.log('3.13.18 cash entry behaviour checks passed');

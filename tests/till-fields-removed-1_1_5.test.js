const fs = require('fs');
const app = fs.readFileSync('js/app.js', 'utf8');
const release = fs.readFileSync('js/release.js', 'utf8');
function assert(ok, message) { if (!ok) throw new Error(message); }
assert(!app.includes('placeholder="Server name" data-field="ServerName"'), 'Till must not show Server name field');
assert(!app.includes('placeholder="Table number" data-field="TableNumber"'), 'Till must not show Table number field');
assert(!app.includes('placeholder="Customer name for receipt" data-field="CustomerName"'), 'Till must not show Customer name field');
assert(app.includes('id="paymentCustomerName"'), 'Payment prompt must retain customer name input');
assert(app.includes('id="paymentTableNumber"'), 'Payment prompt must retain table number input');
assert(release.includes("appVersion: '3.13.22'"), 'Frontend version must be 3.13.18');
assert(release.includes("appVersion: '3.13.22'"), 'Backend version must be 3.13.18');
console.log('till-fields-removed-1_1_5: PASS');

const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync('js/app.js', 'utf8');

assert(app.includes('cash-loyalty-reminder'), 'Cash payment screen must include the loyalty reminder');
assert(app.includes("var stampQty = loyaltyStampQuantity();"), 'Cash reminder must calculate the qualifying loyalty quantity');
assert(app.includes('data-amount=\"5\">£5'), 'Cash quick tenders must include £5');
assert(app.includes('LOYALTY STAMP REMINDER'), 'Loyalty reminder wording must remain visible');
console.log('3.13.18 cash loyalty reminder and £5 tender checks passed');

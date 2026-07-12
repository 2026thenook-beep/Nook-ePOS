const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('google/Code.gs', 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(code, context);

const cart = [{
  ItemID: 'I1',
  ItemName: 'Latte',
  Quantity: 2,
  BasePrice: 3,
  LoyaltyRedeemed: true,
  LoyaltyQuantity: 1,
  AddOns: [{ Quantity: 1, UnitPrice: 0.5 }]
}];
const eligibility = { I1: true };
context.validateLoyaltyRedemptions_(cart, eligibility);
const totals = JSON.parse(JSON.stringify(context.calculateTotals_(cart, { StaffDiscountApplied: true, StaffDiscountPercent: 10 }, eligibility)));
assert.deepStrictEqual(totals, {
  subtotal: 6,
  addOnTotal: 1,
  grossTotal: 7,
  loyaltyTotal: 3.5,
  afterLoyaltyTotal: 3.5,
  discountPercent: 10,
  discountTotal: 0.35,
  total: 3.15
});
assert.throws(() => context.validateLoyaltyRedemptions_(cart, { I1: false }), /not marked Loyalty eligible/);

console.log('Backend loyalty tests passed');

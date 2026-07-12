const assert = require('assert');
const Core = require('../js/core.js');

const item = { ItemID: 'I1', ItemName: 'Breakfast Cob', CategoryID: 'C1', Price: 3.75, LoyaltyEligible: true };
const line = Core.makeCartLine(item, [
  { PromptID: 'P1', PromptTitle: 'Additional item', OptionID: 'O1', OptionText: 'Sausage', Quantity: 3, UnitPrice: 1.00 },
  { PromptID: 'P1', PromptTitle: 'Additional item', OptionID: 'O2', OptionText: 'Egg', Quantity: 1, UnitPrice: 0.70 }
], 'no sauce');

assert.strictEqual(Core.lineUnitAddOnTotal(line), 3.70);
assert.strictEqual(Core.lineUnitTotal(line), 7.45);
assert.strictEqual(Core.lineTotal(line), 7.45);
assert.strictEqual(Core.lineLoyaltyDiscount(line), 0);

Core.setLineQuantity(line, 2);
assert.strictEqual(Core.lineTotal(line), 14.90);
assert.deepStrictEqual(Core.cartTotals([line]), { subtotal: 7.50, addOnTotal: 7.40, grossTotal: 14.90, loyaltyTotal: 0, afterLoyaltyTotal: 14.90, discountPercent: 0, discountTotal: 0, total: 14.90 });
assert.deepStrictEqual(Core.cartTotals([line], { discountApplied: true, discountPercent: 10 }), { subtotal: 7.50, addOnTotal: 7.40, grossTotal: 14.90, loyaltyTotal: 0, afterLoyaltyTotal: 14.90, discountPercent: 10, discountTotal: 1.49, total: 13.41 });

line.LoyaltyRedeemed = true;
line.LoyaltyQuantity = 1;
Core.setLineQuantity(line, 2);
assert.strictEqual(Core.lineLoyaltyDiscount(line), 7.45, 'one unit should be free for loyalty');
assert.strictEqual(Core.lineNetTotal(line), 7.45);
assert.deepStrictEqual(Core.cartTotals([line], { discountApplied: true, discountPercent: 10 }), { subtotal: 7.50, addOnTotal: 7.40, grossTotal: 14.90, loyaltyTotal: 7.45, afterLoyaltyTotal: 7.45, discountPercent: 10, discountTotal: 0.75, total: 6.70 });

assert.strictEqual(Core.validatePayment([line], 'Cash', '').ok, false, 'cash must require entered paid amount');
assert.strictEqual(Core.validatePayment([line], 'Cash', 6.69, { discountApplied: true, discountPercent: 10 }).ok, false, 'cash cannot be under final total');
assert.strictEqual(Core.validatePayment([line], 'Cash', 6.70, { discountApplied: true, discountPercent: 10 }).ok, true, 'cash valid when enough paid after loyalty and discount');
assert.strictEqual(Core.validatePayment([line], 'Card', '').ok, true, 'card does not need cash paid');

const payload = Core.buildTicketPayload({ cart: [line], meta: { OrderType: 'Takeaway', StaffDiscountApplied: true, StaffDiscountPercent: 10 }, payment: { method: 'Cash', cashTendered: 20 } });
assert.strictEqual(payload.totals.loyaltyTotal, 7.45);
assert.strictEqual(payload.totals.discountTotal, 0.75);
assert.strictEqual(payload.totals.total, 6.70);
assert.strictEqual(payload.payment.changeDue, 13.30);

console.log('Core tests passed');

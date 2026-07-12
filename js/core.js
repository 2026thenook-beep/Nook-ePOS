(function (root) {
  'use strict';

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function roundMoney(value) {
    return Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;
  }

  function money(value) {
    return '£' + roundMoney(value).toFixed(2);
  }

  function uid(prefix) {
    return String(prefix || 'ID') + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function active(value) {
    return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1' || value === '' || value == null;
  }

  function truthy(value) {
    return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1';
  }

  function clampPercent(value) {
    var n = toNumber(value, 0);
    if (n < 0) return 0;
    if (n > 100) return 100;
    return n;
  }

  function normaliseDiscountOptions(options) {
    options = options || {};
    var applied = truthy(options.discountApplied || options.StaffDiscountApplied);
    var percent = applied ? clampPercent(options.discountPercent != null ? options.discountPercent : options.StaffDiscountPercent) : 0;
    return { applied: applied && percent > 0, percent: percent };
  }

  function lineUnitAddOnTotal(line) {
    return roundMoney((line.AddOns || []).reduce(function (sum, addon) {
      return sum + (toNumber(addon.Quantity, 1) * toNumber(addon.UnitPrice, addon.Price || 0));
    }, 0));
  }

  function lineUnitTotal(line) {
    return roundMoney(toNumber(line.BasePrice, 0) + lineUnitAddOnTotal(line));
  }

  function lineTotal(line) {
    return roundMoney(lineUnitTotal(line) * Math.max(1, toNumber(line.Quantity, 1)));
  }

  function loyaltyQuantity(line) {
    if (!truthy(line.LoyaltyRedeemed)) return 0;
    var qty = Math.max(1, toNumber(line.Quantity, 1));
    var loyaltyQty = Math.max(1, toNumber(line.LoyaltyQuantity, 1));
    return Math.min(qty, loyaltyQty);
  }

  function lineLoyaltyDiscount(line) {
    return roundMoney(lineUnitTotal(line) * loyaltyQuantity(line));
  }

  function lineNetTotal(line) {
    return roundMoney(Math.max(0, lineTotal(line) - lineLoyaltyDiscount(line)));
  }

  function cartTotals(cart, options) {
    var subtotal = 0;
    var addOnTotal = 0;
    var loyaltyTotal = 0;
    (cart || []).forEach(function (line) {
      var qty = Math.max(1, toNumber(line.Quantity, 1));
      subtotal += toNumber(line.BasePrice, 0) * qty;
      addOnTotal += lineUnitAddOnTotal(line) * qty;
      loyaltyTotal += lineLoyaltyDiscount(line);
    });
    subtotal = roundMoney(subtotal);
    addOnTotal = roundMoney(addOnTotal);
    loyaltyTotal = roundMoney(loyaltyTotal);
    var grossTotal = roundMoney(subtotal + addOnTotal);
    var afterLoyaltyTotal = roundMoney(Math.max(0, grossTotal - loyaltyTotal));
    var discount = normaliseDiscountOptions(options);
    var discountTotal = discount.applied ? roundMoney(afterLoyaltyTotal * discount.percent / 100) : 0;
    var total = roundMoney(Math.max(0, afterLoyaltyTotal - discountTotal));
    return {
      subtotal: subtotal,
      addOnTotal: addOnTotal,
      grossTotal: grossTotal,
      loyaltyTotal: loyaltyTotal,
      afterLoyaltyTotal: afterLoyaltyTotal,
      discountPercent: discount.applied ? discount.percent : 0,
      discountTotal: discountTotal,
      total: total
    };
  }

  function makeCartLine(item, selections, note) {
    selections = selections || [];
    var addOns = selections.map(function (s) {
      return {
        PromptID: s.PromptID || '',
        PromptTitle: s.PromptTitle || '',
        OptionID: s.OptionID || '',
        OptionText: s.OptionText || '',
        Action: s.Action || 'Modifier',
        Quantity: Math.max(1, toNumber(s.Quantity, 1)),
        UnitPrice: roundMoney(toNumber(s.UnitPrice != null ? s.UnitPrice : s.Price, 0)),
        Total: roundMoney(Math.max(1, toNumber(s.Quantity, 1)) * toNumber(s.UnitPrice != null ? s.UnitPrice : s.Price, 0))
      };
    });
    var line = {
      CartLineID: uid('CL'),
      ItemID: item.ItemID,
      ItemName: item.ItemName,
      CategoryID: item.CategoryID,
      CategoryName: item.CategoryName || '',
      Quantity: 1,
      BasePrice: roundMoney(toNumber(item.Price, 0)),
      AddOns: addOns,
      Note: note || '',
      LoyaltyEligible: truthy(item.LoyaltyEligible),
      LoyaltyRedeemed: false,
      LoyaltyQuantity: 0
    };
    line.UnitAddOnTotal = lineUnitAddOnTotal(line);
    line.UnitTotal = lineUnitTotal(line);
    if (truthy(line.LoyaltyRedeemed)) line.LoyaltyQuantity = loyaltyQuantity(line);
    else line.LoyaltyQuantity = 0;
    line.LoyaltyDiscount = lineLoyaltyDiscount(line);
    line.LineTotal = lineTotal(line);
    line.NetLineTotal = lineNetTotal(line);
    return line;
  }

  function setLineQuantity(line, qty) {
    line.Quantity = Math.max(1, toNumber(qty, 1));
    line.UnitAddOnTotal = lineUnitAddOnTotal(line);
    line.UnitTotal = lineUnitTotal(line);
    if (truthy(line.LoyaltyRedeemed)) line.LoyaltyQuantity = loyaltyQuantity(line);
    else line.LoyaltyQuantity = 0;
    line.LoyaltyDiscount = lineLoyaltyDiscount(line);
    line.LineTotal = lineTotal(line);
    line.NetLineTotal = lineNetTotal(line);
    return line;
  }

  function buildTicketPayload(args) {
    args = args || {};
    var cart = clone(args.cart || []);
    cart.forEach(function (line) { setLineQuantity(line, line.Quantity); });
    var meta = Object.assign({}, args.meta || {});
    var discount = normaliseDiscountOptions({
      discountApplied: args.discountApplied != null ? args.discountApplied : meta.StaffDiscountApplied,
      discountPercent: args.discountPercent != null ? args.discountPercent : meta.StaffDiscountPercent
    });
    meta.StaffDiscountApplied = discount.applied;
    meta.StaffDiscountPercent = discount.applied ? discount.percent : 0;
    var totals = cartTotals(cart, { discountApplied: discount.applied, discountPercent: discount.percent });
    var payment = args.payment || {};
    var method = payment.method || '';
    var cashTendered = method === 'Cash' ? roundMoney(toNumber(payment.cashTendered, 0)) : '';
    var changeDue = method === 'Cash' ? roundMoney(cashTendered - totals.total) : 0;
    return {
      meta: meta,
      cart: cart,
      totals: totals,
      payment: {
        method: method,
        cashTendered: cashTendered,
        changeDue: changeDue < 0 ? 0 : changeDue
      }
    };
  }

  function validatePayment(cart, method, cashTendered, options) {
    var totals = cartTotals(cart, options);
    if (!cart || cart.length === 0) return { ok: false, message: 'Add at least one item before taking payment.' };
    if (method === 'Cash') {
      if (cashTendered === '' || cashTendered == null) return { ok: false, message: 'Enter the amount of cash the customer has paid.' };
      var paid = toNumber(cashTendered, NaN);
      if (!Number.isFinite(paid)) return { ok: false, message: 'Cash paid must be a number.' };
      if (roundMoney(paid) < totals.total) return { ok: false, message: 'Cash paid is less than the ticket total.' };
    }
    if (method !== 'Cash' && method !== 'Card') return { ok: false, message: 'Choose Cash or Card.' };
    return { ok: true, totals: totals };
  }

  function kitchenPayloadFromTicket(ticket, ticketItems, ticketAddOns) {
    var items = (ticketItems || []).filter(function (item) { return item.TicketID === ticket.TicketID; }).map(function (item) {
      var addons = (ticketAddOns || []).filter(function (addon) { return addon.TicketItemID === item.TicketItemID; });
      return Object.assign({}, item, { AddOns: addons });
    });
    return {
      TicketID: ticket.TicketID,
      TicketNumber: ticket.TicketNumber,
      CreatedAt: ticket.CreatedAt,
      OrderType: ticket.OrderType,
      ServerName: ticket.ServerName,
      TableNumber: ticket.TableNumber,
      CustomerName: ticket.CustomerName,
      Items: items
    };
  }

  var Core = {
    toNumber: toNumber,
    roundMoney: roundMoney,
    money: money,
    uid: uid,
    clone: clone,
    active: active,
    truthy: truthy,
    clampPercent: clampPercent,
    normaliseDiscountOptions: normaliseDiscountOptions,
    lineUnitAddOnTotal: lineUnitAddOnTotal,
    lineUnitTotal: lineUnitTotal,
    lineTotal: lineTotal,
    loyaltyQuantity: loyaltyQuantity,
    lineLoyaltyDiscount: lineLoyaltyDiscount,
    lineNetTotal: lineNetTotal,
    cartTotals: cartTotals,
    makeCartLine: makeCartLine,
    setLineQuantity: setLineQuantity,
    buildTicketPayload: buildTicketPayload,
    validatePayment: validatePayment,
    kitchenPayloadFromTicket: kitchenPayloadFromTicket
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  root.NookCore = Core;
})(typeof window !== 'undefined' ? window : globalThis);

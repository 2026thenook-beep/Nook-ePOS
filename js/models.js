(function (root) {
  'use strict';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emptyData() {
    return {
      meta: {}, settings: {}, nextTicketNumber: '',
      categories: [], menuItems: [], prompts: [], promptOptions: [],
      heldOrders: [], tickets: [], ticketItems: [], ticketAddOns: [],
      refunds: [], refundItems: [], kitchenQueue: [], deletedItems: []
    };
  }

  function normaliseData(data) {
    var result = Object.assign(emptyData(), data || {});
    ['categories', 'menuItems', 'prompts', 'promptOptions', 'heldOrders', 'tickets', 'ticketItems', 'ticketAddOns', 'refunds', 'refundItems', 'kitchenQueue', 'deletedItems'].forEach(function (key) {
      if (!Array.isArray(result[key])) result[key] = [];
    });
    if (!result.meta || typeof result.meta !== 'object') result.meta = {};
    if (!result.settings || typeof result.settings !== 'object') result.settings = {};
    return result;
  }

  function addOnUsesVariableQuantity(addOn, promptOptions, truthy) {
    if (addOn && addOn.AllowValue != null) return truthy(addOn.AllowValue);
    var optionId = addOn && addOn.OptionID;
    var option = (promptOptions || []).find(function (candidate) {
      return String(candidate.OptionID) === String(optionId);
    });
    return !!option && truthy(option.AllowValue);
  }

  function ticketBundle(data, ticketId) {
    data = normaliseData(data);
    var ticket = data.tickets.find(function (entry) { return String(entry.TicketID) === String(ticketId); }) || null;
    var items = data.ticketItems.filter(function (entry) { return String(entry.TicketID) === String(ticketId); }).map(function (item) {
      var line = clone(item);
      line.AddOns = data.ticketAddOns.filter(function (addOn) { return String(addOn.TicketItemID) === String(item.TicketItemID); });
      return line;
    });
    return { ticket: ticket, items: items };
  }

  root.NookModels = Object.freeze({
    clone: clone,
    emptyData: emptyData,
    normaliseData: normaliseData,
    addOnUsesVariableQuantity: addOnUsesVariableQuantity,
    ticketBundle: ticketBundle
  });
})(typeof window !== 'undefined' ? window : globalThis);

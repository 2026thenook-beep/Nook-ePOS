(function (root) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }

  function attr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function bySort(core, a, b) {
    return core.toNumber(a.Sort, 0) - core.toNumber(b.Sort, 0) ||
      String(a.CategoryName || a.ItemName || a.PromptTitle || a.OptionText || '').localeCompare(String(b.CategoryName || b.ItemName || b.PromptTitle || b.OptionText || ''));
  }

  function addOnDisplayText(addOn, options) {
    options = options || {};
    var core = options.core;
    var models = options.models;
    var text = String((addOn && addOn.OptionText) || 'Additional item');
    var quantity = Math.max(1, core.toNumber(addOn && addOn.Quantity, 1));
    if (models.addOnUsesVariableQuantity(addOn, options.promptOptions || [], core.truthy)) text += ' ×' + quantity;
    if (options.includePrice && core.toNumber(addOn && (addOn.UnitPrice != null ? addOn.UnitPrice : addOn.Price), 0)) {
      text += ' (' + core.money(core.toNumber(addOn.UnitPrice != null ? addOn.UnitPrice : addOn.Price, 0) * quantity) + ')';
    }
    return text;
  }

  function renderAddOnList(addOns, options) {
    if (!addOns || !addOns.length) return '';
    return '<ul class="addon-list">' + addOns.map(function (addOn) {
      return '<li>' + escapeHtml(addOnDisplayText(addOn, options)) + '</li>';
    }).join('') + '</ul>';
  }

  root.NookPresentation = Object.freeze({
    escapeHtml: escapeHtml,
    attr: attr,
    bySort: bySort,
    addOnDisplayText: addOnDisplayText,
    renderAddOnList: renderAddOnList
  });
})(typeof window !== 'undefined' ? window : globalThis);

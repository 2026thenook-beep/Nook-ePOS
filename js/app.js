(function () {
  'use strict';

  var Core = window.NookCore;
  var RELEASE = window.NOOK_RELEASE || {};
  var CONFIG = window.NOOK_CONFIG || {};
  var CACHE_KEY = 'nook_epos_browser_server_cache';
  var DRAFT_KEY = 'nook_epos_browser_draft';
  var CONFIG_KEY = 'nook_epos_browser_config';
  var LEGACY_CONFIG_KEYS = ['nook_epos_browser_1_0_5_config', 'nook_epos_browser_1_0_4_config', 'nook_epos_browser_1_0_3_config', 'nook_epos_browser_1_0_2_config'];
  var LEGACY_DRAFT_KEYS = ['nook_epos_browser_1_0_5_draft', 'nook_epos_browser_1_0_4_draft', 'nook_epos_browser_1_0_3_draft', 'nook_epos_browser_1_0_2_draft'];
  var TABS = ['Till', 'Held', 'Reports', 'Live Tickets', 'Refunds', 'Kitchen', 'Admin', 'Settings'];
  var KITCHEN_POLL_INTERVAL_MS = RELEASE.kitchenPollIntervalMs || 3000;
  var MENU_POLL_INTERVAL_MS = RELEASE.menuPollIntervalMs || 5000;
  var SYNC_TICK_INTERVAL_MS = RELEASE.syncTickIntervalMs || 1000;
  var kitchenPollInFlight = false;
  var menuPollInFlight = false;
  var lastMenuSignature = '';
  var syncCoordinator = { timer: null, lastKitchenRun: 0, lastMenuRun: 0 };

  var state = {
    activeTab: 'Till',
    activeCategoryId: '',
    adminMode: 'items',
    selectedItemId: '',
    selectedCategoryId: '',
    adminFilterCategoryId: '',
    adminSearch: '',
    reportFrom: todayDateString(new Date()),
    reportTo: todayDateString(new Date()),
    kitchenRecentlyCompleted: {},
    lastDatabaseRepair: null,
    paymentInProgress: false,
    data: Core.clone(window.NOOK_SEED || {}),
    cart: [],
    pendingPaymentRequestId: '',
    ticketMeta: { OrderType: 'Takeaway', ServerName: '', TableNumber: '', CustomerName: '', CashPaid: '' },
    serverReady: false,
    status: { mode: 'starting', read: 'waiting', write: 'waiting', backendVersion: '', databaseVersion: '', spreadsheetName: '', spreadsheetId: '', message: 'Starting…' }
  };

  function $(id) { return document.getElementById(id); }
  var uiVersionEl = $('uiVersion');
  if (uiVersionEl) uiVersionEl.textContent = CONFIG.frontendVersion || 'unknown';
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (s) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s];
    });
  }
  function attr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
  function bySort(a, b) { return Core.toNumber(a.Sort, 0) - Core.toNumber(b.Sort, 0) || String(a.CategoryName || a.ItemName || a.PromptTitle || a.OptionText).localeCompare(String(b.CategoryName || b.ItemName || b.PromptTitle || b.OptionText)); }
  function isConfiguredUrl() {
    var url = getScriptUrl();
    return !!url && !/PASTE_YOUR_DEPLOYED/i.test(url);
  }
  function getScriptUrl() {
    try {
      var saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
      if (saved.scriptUrl) return saved.scriptUrl;
      for (var i = 0; i < LEGACY_CONFIG_KEYS.length; i++) {
        var legacy = JSON.parse(localStorage.getItem(LEGACY_CONFIG_KEYS[i]) || '{}');
        if (legacy.scriptUrl) return legacy.scriptUrl;
      }
      return CONFIG.scriptUrl || '';
    } catch (err) {
      return CONFIG.scriptUrl || '';
    }
  }
  function setScriptUrl(url) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ scriptUrl: String(url || '').trim() }));
  }
  function strictPersistence() {
    return CONFIG.strictServerPersistence !== false;
  }

  function canUseLocalTestMode() {
    return !isConfiguredUrl() && CONFIG.allowLocalTestMode === true;
  }

  function canUseLiveData() {
    return state.serverReady || canUseLocalTestMode();
  }

  function emptyData() {
    return {
      meta: {}, settings: {}, nextTicketNumber: '',
      categories: [], menuItems: [], prompts: [], promptOptions: [],
      heldOrders: [], tickets: [], ticketItems: [], ticketAddOns: [],
      refunds: [], kitchenQueue: [], deletedItems: []
    };
  }

  function saveLocal() {
    // Strict persistence rule: browser storage may keep the unfinished basket only.
    // Committed tickets, reports, admin data, held orders and kitchen state must come from Google Sheets.
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ cart: state.cart, ticketMeta: state.ticketMeta, pendingPaymentRequestId: state.pendingPaymentRequestId }));
    if (canUseLocalTestMode()) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: state.data }));
    }
  }

  function saveServerCache() {
    // Backup/debug copy only. It is never used as the live authority while strict persistence is enabled.
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data: state.data }));
    } catch (err) {
      console.warn('Server cache save failed', err);
    }
  }

  function loadLocal() {
    try {
      var draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!draft) {
        for (var i = 0; i < LEGACY_DRAFT_KEYS.length; i++) {
          draft = JSON.parse(localStorage.getItem(LEGACY_DRAFT_KEYS[i]) || 'null');
          if (draft) break;
        }
      }
      if (draft) {
        state.cart = Array.isArray(draft.cart) ? draft.cart : [];
        state.ticketMeta = Object.assign(state.ticketMeta, draft.ticketMeta || {});
        state.pendingPaymentRequestId = draft.pendingPaymentRequestId || '';
      }
      if (canUseLocalTestMode()) {
        var cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cache && cache.data) state.data = Object.assign(Core.clone(window.NOOK_SEED || {}), cache.data);
      }
    } catch (err) {
      console.warn('Local draft restore failed', err);
    }
  }

  function clearLocalData() {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(CACHE_KEY);
  }
  function toast(message) {
    var root = $('toastRoot');
    var div = document.createElement('div');
    div.className = 'toast';
    div.textContent = message;
    root.appendChild(div);
    setTimeout(function () { div.remove(); }, 3200);
  }

  async function api(action, payload) {
    var url = getScriptUrl();
    if (!isConfiguredUrl()) throw new Error('Google Script URL is not configured.');
    var request = Object.assign({}, payload || {}, {
      action: action,
      client: 'browser',
      frontendVersion: CONFIG.frontendVersion || 'unknown'
    });
    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(request)
    });
    if (!response.ok) throw new Error('Server returned HTTP ' + response.status);
    var json = await response.json();
    if (!json.ok) throw new Error(json.error || 'Server returned an error.');
    return json;
  }

  async function bootstrap() {
    state.serverReady = false;
    state.data = canUseLocalTestMode() ? Core.clone(window.NOOK_SEED || {}) : emptyData();
    loadLocal();
    ensureActiveCategory();
    render();

    if (!isConfiguredUrl()) {
      if (canUseLocalTestMode()) {
        state.serverReady = true;
        state.status = { mode: 'local', read: 'local test only', write: 'local test only', backendVersion: 'not connected', databaseVersion: 'not connected', spreadsheetName: '', spreadsheetId: '', message: 'Local test mode only - not connected to Google Sheets' };
      } else {
        state.status = { mode: 'error', read: 'blocked', write: 'blocked', backendVersion: 'not connected', databaseVersion: 'not connected', spreadsheetName: '', spreadsheetId: '', message: 'Server URL required before live use' };
      }
      render();
      return;
    }

    state.status = { mode: 'syncing', read: 'checking', write: 'blocked until connected', backendVersion: '', databaseVersion: '', spreadsheetName: '', spreadsheetId: '', message: 'Connecting to Google Sheets…' };
    renderStatus();
    try {
      var res = await api('bootstrap');
      state.data = normaliseData(res.data || {});
      var versions = res.versions || {};
      var schema = res.schema || {};
      state.lastDatabaseRepair = schema;
      var mode = versionMode(versions);
      state.status = {
        mode: mode,
        read: 'OK',
        write: mode === 'error' ? 'blocked' : 'ready',
        backendVersion: versions.BackendVersion || '',
        databaseVersion: versions.DatabaseVersion || '',
        spreadsheetName: versions.SpreadsheetName || '',
        spreadsheetId: versions.SpreadsheetID || '',
        schemaChanges: (schema.changes || []).length,
        message: mode === 'error' ? ('Version mismatch: frontend expects backend ' + (CONFIG.backendVersion || CONFIG.frontendVersion) + ' but server reports ' + (versions.BackendVersion || 'unknown') + '; database expected ' + CONFIG.databaseVersion + ' and server reports ' + (versions.DatabaseVersion || 'unknown')) : ((schema.changes || []).length ? 'Loaded from Google Sheets - database repaired/updated' : 'Loaded from Google Sheets')
      };
      state.serverReady = state.status.mode !== 'error';
      ensureActiveCategory();
      saveLocal();
      saveServerCache();
      render();
      startSyncCoordinator();
      saveConfirmedUrlAfterGoodConnection(versions);
    } catch (err) {
      state.serverReady = false;
      state.data = emptyData();
      state.status = { mode: 'error', read: 'failed', write: 'blocked', backendVersion: '', databaseVersion: '', spreadsheetName: '', spreadsheetId: '', message: 'Server read failed: ' + err.message };
      stopSyncCoordinator();
      render();
    }
  }


  function kitchenQueueSignature(queue) {
    return (queue || []).map(function (k) {
      return [k.KitchenID || '', k.Status || '', k.PayloadJSON || '', k.CreatedAt || ''].join('|');
    }).join('~');
  }

  async function syncKitchenQueue(options) {
    options = options || {};
    if (kitchenPollInFlight || !isConfiguredUrl() || !state.serverReady) return;
    kitchenPollInFlight = true;
    try {
      var before = kitchenQueueSignature(state.data.kitchenQueue);
      var res = await api('kitchenSnapshot');
      var queue = res.data && Array.isArray(res.data.kitchenQueue) ? res.data.kitchenQueue : [];
      var after = kitchenQueueSignature(queue);
      state.data.kitchenQueue = queue;
      state.status.read = 'OK';
      if (before !== after) {
        state.status.message = 'Kitchen display updated from Google Sheets';
        saveServerCache();
        if (state.activeTab === 'Kitchen') renderKitchen();
      } else if (!options.silent && state.activeTab === 'Kitchen') {
        renderStatus();
      }
    } catch (err) {
      state.status.read = 'kitchen retrying';
      state.status.message = 'Kitchen refresh failed: ' + err.message;
      if (state.activeTab === 'Kitchen') renderStatus();
    } finally {
      kitchenPollInFlight = false;
    }
  }

  function runSyncCoordinator() {
    if (!state.serverReady || !isConfiguredUrl() || document.visibilityState === 'hidden') return;
    var now = Date.now();
    if (state.activeTab === 'Kitchen' && now - syncCoordinator.lastKitchenRun >= KITCHEN_POLL_INTERVAL_MS) {
      syncCoordinator.lastKitchenRun = now;
      syncKitchenQueue({ silent: true });
    }
    if (now - syncCoordinator.lastMenuRun >= MENU_POLL_INTERVAL_MS) {
      syncCoordinator.lastMenuRun = now;
      syncMenuData();
    }
  }

  function startSyncCoordinator() {
    stopSyncCoordinator();
    if (!state.serverReady || !isConfiguredUrl()) return;
    lastMenuSignature = menuSignature(state.data);
    syncCoordinator.lastKitchenRun = 0;
    syncCoordinator.lastMenuRun = 0;
    runSyncCoordinator();
    syncCoordinator.timer = setInterval(runSyncCoordinator, SYNC_TICK_INTERVAL_MS);
  }

  function stopSyncCoordinator() {
    if (syncCoordinator.timer) clearInterval(syncCoordinator.timer);
    syncCoordinator.timer = null;
  }

  function updateKitchenPolling() {
    if (state.activeTab === 'Kitchen') syncCoordinator.lastKitchenRun = 0;
    runSyncCoordinator();
  }

  function menuSignature(data) {
    return JSON.stringify([data.categories || [], data.menuItems || [], data.prompts || [], data.promptOptions || [], data.deletedItems || []]);
  }

  async function syncMenuData() {
    if (menuPollInFlight || !state.serverReady || !isConfiguredUrl() || document.visibilityState === 'hidden') return;
    menuPollInFlight = true;
    try {
      var res = await api('menuSnapshot');
      var incoming = res.data || {};
      var signature = menuSignature(incoming);
      if (signature !== lastMenuSignature) {
        ['categories','menuItems','prompts','promptOptions','deletedItems'].forEach(function (key) { state.data[key] = incoming[key] || []; });
        lastMenuSignature = signature;
        ensureActiveCategory();
        saveServerCache();
        render();
      }
    } catch (err) {
      console.warn('Menu synchronisation retrying', err);
    } finally {
      menuPollInFlight = false;
    }
  }

  function versionMode(versions) {
    var expectedBackend = CONFIG.backendVersion || CONFIG.frontendVersion || 'unknown';
    var expectedDatabase = CONFIG.databaseVersion || expectedBackend;
    if (versions.BackendVersion && versions.BackendVersion !== expectedBackend) return 'error';
    if (versions.DatabaseVersion && versions.DatabaseVersion !== expectedDatabase) return 'error';
    return 'live';
  }

  function normaliseData(data) {
    var seed = Core.clone(window.NOOK_SEED || {});
    var merged = Object.assign(seed, data || {});
    ['categories', 'menuItems', 'prompts', 'promptOptions', 'heldOrders', 'tickets', 'ticketItems', 'ticketAddOns', 'refunds', 'kitchenQueue', 'deletedItems'].forEach(function (key) {
      if (!Array.isArray(merged[key])) merged[key] = [];
    });
    return merged;
  }

  function renderStatus() {
    var banner = $('syncBanner');
    var st = state.status;
    banner.className = 'sync-banner ' + (st.mode === 'error' ? 'error' : st.mode === 'local' ? 'local' : st.mode === 'warn' ? 'warn' : '');
    var parts = [];
    parts.push(new Date().toLocaleTimeString());
    parts.push(st.message || 'Ready');
    parts.push('Frontend: ' + (CONFIG.frontendVersion || 'unknown'));
    if (st.backendVersion) parts.push('Backend: ' + st.backendVersion);
    if (st.databaseVersion) parts.push('Database: ' + st.databaseVersion);
    if (st.spreadsheetName) parts.push('Sheet: ' + st.spreadsheetName);
    parts.push('Write: ' + (st.write || 'waiting'));
    parts.push('Read: ' + (st.read || 'waiting'));
    banner.textContent = parts.join(' • ');
  }

  function renderNav() {
    $('topNav').innerHTML = TABS.map(function (tab) {
      return '<button class="nav-btn' + (state.activeTab === tab ? ' active' : '') + '" data-tab="' + attr(tab) + '">' + escapeHtml(tab) + '</button>';
    }).join('');
  }

  function render() {
    renderNav();
    renderStatus();
    if (state.activeTab !== 'Settings' && strictPersistence() && !canUseLiveData()) {
      renderServerRequired();
      return;
    }
    if (state.activeTab === 'Till') renderTill();
    if (state.activeTab === 'Held') renderHeld();
    if (state.activeTab === 'Reports') renderReports();
    if (state.activeTab === 'Live Tickets') renderLiveTickets();
    if (state.activeTab === 'Refunds') renderRefunds();
    if (state.activeTab === 'Kitchen') renderKitchen();
    if (state.activeTab === 'Admin') renderAdmin();
    if (state.activeTab === 'Settings') renderSettings();
  }

  function renderServerRequired() {
    var configured = isConfiguredUrl();
    $('main').innerHTML = '<section class="panel"><h2>Server connection required</h2>' +
      '<p class="help">Strict persistence is active. The till will not use stale browser data for tickets, reports, kitchen, held orders or menu admin.</p>' +
      '<div class="cards"><div class="card"><h3>Current status</h3><div>' + escapeHtml(state.status.message || 'Not connected') + '</div></div>' +
      '<div class="card"><h3>Google Script URL</h3><div>' + (configured ? 'Configured' : 'Missing') + '</div></div></div>' +
      '<div class="row" style="margin-top:12px"><button class="primary" data-tab="Settings">Open Settings</button><button class="secondary" data-action="refresh">Retry server read</button></div></section>';
  }

  function categories() { return (state.data.categories || []).filter(function (c) { return Core.active(c.Active); }).sort(bySort); }
  function itemsForCategory(categoryId) {
    return (state.data.menuItems || []).filter(function (item) { return Core.active(item.Active) && (!categoryId || item.CategoryID === categoryId); }).sort(bySort);
  }
  function ensureActiveCategory() {
    var cats = categories();
    if (!state.activeCategoryId && cats[0]) state.activeCategoryId = cats[0].CategoryID;
    if (state.activeCategoryId && !cats.some(function (c) { return c.CategoryID === state.activeCategoryId; }) && cats[0]) state.activeCategoryId = cats[0].CategoryID;
  }
  function categoryName(categoryId) {
    var c = (state.data.categories || []).find(function (x) { return x.CategoryID === categoryId; });
    return c ? c.CategoryName : '';
  }

  function categoryById(categoryId) {
    return (state.data.categories || []).find(function (x) { return x.CategoryID === categoryId; }) || null;
  }

  function isDrinkCategory(categoryId) {
    var c = categoryById(categoryId);
    return !!(c && Core.truthy(c.IsDrinkCategory));
  }

  function staffDiscountPercent() {
    return Core.clampPercent((state.data.settings || {}).StaffDiscountPercent || 0);
  }

  function staffDiscountApplied() {
    return Core.truthy(state.ticketMeta.StaffDiscountApplied);
  }

  function discountOptions() {
    return { discountApplied: staffDiscountApplied(), discountPercent: staffDiscountPercent() };
  }

  function currentTotals() {
    return Core.cartTotals(state.cart, discountOptions());
  }

  function loyaltyLines() {
    return (state.cart || []).filter(function (line) { return Core.truthy(line.LoyaltyEligible); });
  }

  function appliedLoyaltyLine() {
    return (state.cart || []).find(function (line) { return Core.truthy(line.LoyaltyRedeemed); }) || null;
  }

  function applyLoyaltyToBestEligibleLine() {
    var existing = appliedLoyaltyLine();
    if (existing) {
      existing.LoyaltyRedeemed = false;
      existing.LoyaltyQuantity = 0;
      Core.setLineQuantity(existing, existing.Quantity);
      return { applied: false, message: 'Loyalty removed.' };
    }
    var lines = loyaltyLines();
    if (!lines.length) return { applied: false, message: 'No item on this ticket is marked as loyalty eligible in Menu Admin.' };
    var best = lines.slice().sort(function (a, b) { return Core.lineUnitTotal(b) - Core.lineUnitTotal(a); })[0];
    best.LoyaltyRedeemed = true;
    best.LoyaltyQuantity = 1;
    Core.setLineQuantity(best, best.Quantity);
    return { applied: true, message: 'Loyalty applied to ' + best.ItemName + '.' };
  }

  function cashChangeInfo(totals) {
    totals = totals || currentTotals();
    if (state.ticketMeta.CashPaid === '' || state.ticketMeta.CashPaid == null) {
      return { text: 'Enter cash paid to see change automatically.', className: 'change-summary' };
    }
    var paid = Core.toNumber(state.ticketMeta.CashPaid, NaN);
    if (!Number.isFinite(paid)) return { text: 'Cash paid must be a number.', className: 'change-summary warning' };
    var change = Core.roundMoney(paid - totals.total);
    if (change < 0) return { text: 'Still to pay: ' + Core.money(Math.abs(change)), className: 'change-summary warning' };
    return { text: 'Change required: ' + Core.money(change), className: 'change-summary ok' };
  }

  function updateCashChangeDisplay() {
    var el = $('cashChangePreview');
    if (!el) return;
    var info = cashChangeInfo();
    el.className = info.className;
    el.textContent = info.text;
  }

  function todayDateString(date) {
    date = date || new Date();
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function ticketDateString(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    return todayDateString(d);
  }

  function reportRangeLabel() {
    if (state.reportFrom && state.reportTo && state.reportFrom === state.reportTo) return state.reportFrom;
    return (state.reportFrom || 'start') + ' to ' + (state.reportTo || 'today');
  }

  function ticketInReportRange(ticket) {
    var day = ticketDateString(ticket.CreatedAt);
    if (!day) return false;
    if (state.reportFrom && day < state.reportFrom) return false;
    if (state.reportTo && day > state.reportTo) return false;
    return true;
  }

  function renderTill() {
    ensureActiveCategory();
    var cats = categories();
    var items = itemsForCategory(state.activeCategoryId);
    $('main').innerHTML = '<div class="grid-till">' +
      '<section class="panel till-menu-panel">' +
        '<div class="category-strip">' + cats.map(function (c) {
          return '<button class="pill-btn' + (state.activeCategoryId === c.CategoryID ? ' active' : '') + '" data-action="set-category" data-id="' + attr(c.CategoryID) + '">' + escapeHtml(c.CategoryName) + '</button>';
        }).join('') + '</div>' +
        '<div class="item-grid-scroll"><div class="item-grid">' + items.map(function (item) {
          return '<button class="item-card" data-action="add-item" data-id="' + attr(item.ItemID) + '">' +
            '<span><span class="item-name">' + escapeHtml(item.ItemName) + '</span>' +
            (item.Description ? '<span class="item-desc">' + escapeHtml(item.Description) + '</span>' : '') + '</span>' +
            '<span class="item-price">' + Core.money(item.Price) + '</span>' +
          '</button>';
        }).join('') + '</div></div>' +
      '</section>' + renderTicketPanel() + '</div>';
  }

  function renderTicketPanel() {
    var totals = currentTotals();
    var discountPercent = staffDiscountPercent();
    var discountActive = staffDiscountApplied() && discountPercent > 0;
    var changeInfo = cashChangeInfo(totals);
    var discountButtonText = discountPercent > 0 ? ('Staff discount ' + discountPercent + '%') : 'Staff discount not set';
    return '<aside class="panel ticket-panel">' +
      '<h2>Ticket next<br>from server</h2>' +
      '<div class="ticket-fields">' +
        '<select class="select" data-field="OrderType"><option' + (state.ticketMeta.OrderType === 'Takeaway' ? ' selected' : '') + '>Takeaway</option><option' + (state.ticketMeta.OrderType === 'Eat in' ? ' selected' : '') + '>Eat in</option></select>' +
      '</div>' +
      '<div class="ticket-content-scroll">' +
      '<div class="cart-box">' + (state.cart.length ? state.cart.map(renderCartLine).join('') : '<div class="empty-cart">Tap an item to start</div>') + '</div>' +
      '<div class="totals">' +
        '<div class="total-row"><span>Items</span><strong>' + Core.money(totals.subtotal) + '</strong></div>' +
        '<div class="total-row"><span>Additional items</span><strong>' + Core.money(totals.addOnTotal) + '</strong></div>' +
        (totals.loyaltyTotal ? '<div class="total-row loyalty-row"><span>Loyalty</span><strong>- ' + Core.money(totals.loyaltyTotal) + '</strong></div>' : '') +
        (discountActive ? '<div class="total-row discount-row"><span>Staff discount ' + escapeHtml(discountPercent) + '%</span><strong>- ' + Core.money(totals.discountTotal) + '</strong></div>' : '') +
        '<div class="total-row big"><span>Total to pay</span><span>' + Core.money(totals.total) + '</span></div>' +
      '</div>' +
      '<div class="cart-actions">' +
        '<button class="loyalty-btn' + (appliedLoyaltyLine() ? ' active' : '') + '" data-action="toggle-loyalty"' + (!loyaltyLines().length ? ' disabled' : '') + '>' + (appliedLoyaltyLine() ? 'Remove loyalty' : 'Apply loyalty') + '</button>' +
        '<div class="help">Loyalty only applies to items ticked as Loyalty eligible in Menu Admin. It removes one eligible item price before payment.</div>' +
        '<button class="staff-discount-btn' + (discountActive ? ' active' : '') + '" data-action="toggle-staff-discount"' + (!discountPercent ? ' disabled' : '') + '>' + escapeHtml(discountButtonText) + (discountActive ? ' applied' : '') + '</button>' +
        '<div class="help">Set the staff discount percentage in Settings. Discount is deducted before cash/change is calculated.</div>' +
        '<input class="input" inputmode="decimal" placeholder="Cash paid" data-field="CashPaid" value="' + attr(state.ticketMeta.CashPaid) + '">' +
        '<div id="cashChangePreview" class="' + changeInfo.className + '">' + escapeHtml(changeInfo.text) + '</div>' +
        '<div class="row"><button class="pay-cash half" data-action="pay-cash">Cash</button><button class="pay-card half" data-action="pay-card">Card</button></div>' +
        '<div class="row"><button class="secondary half" data-action="hold-current">Hold order</button><button class="danger half" data-action="clear-cart">Clear</button></div>' +
        '<div class="help">Cash paid is intentionally blank. Staff enter the cash tendered only when taking cash.</div>' +
      '</div>' +
      '</div>' +
    '</aside>';
  }

  function renderCartLine(line, index) {
    Core.setLineQuantity(line, line.Quantity);
    var loyaltyDiscount = Core.lineLoyaltyDiscount(line);
    var netLineTotal = Core.lineNetTotal(line);
    var loyaltyLabel = loyaltyDiscount ? '<div class="loyalty-chip">LOYALTY - ' + Core.money(loyaltyDiscount) + '</div>' : (Core.truthy(line.LoyaltyEligible) ? '<div class="loyalty-eligible-chip">Loyalty eligible</div>' : '');
    return '<div class="cart-line' + (loyaltyDiscount ? ' loyalty-applied' : '') + '">' +
      '<div class="line-top"><div><div class="line-title">' + escapeHtml(line.ItemName) + '</div><div class="help">' + Core.money(line.BasePrice) + ' base + ' + Core.money(line.UnitAddOnTotal) + ' add-ons</div>' + loyaltyLabel + '</div><div class="line-money">' + (loyaltyDiscount ? '<span class="old-money">' + Core.money(line.LineTotal) + '</span><br>' : '') + Core.money(netLineTotal) + '</div></div>' +
      ((line.AddOns || []).length ? '<ul class="addon-list">' + line.AddOns.map(function (a) { return '<li>' + escapeHtml(a.OptionText) + (Core.toNumber(a.Quantity, 1) > 1 ? ' x' + escapeHtml(a.Quantity) : '') + (Core.toNumber(a.UnitPrice, 0) ? ' ' + Core.money(Core.toNumber(a.UnitPrice, 0) * Core.toNumber(a.Quantity, 1)) : '') + '</li>'; }).join('') + '</ul>' : '') +
      (line.Note ? '<div class="note-chip">Note: ' + escapeHtml(line.Note) + '</div>' : '') +
      '<div class="qty-row"><button class="qty-btn" data-action="line-minus" data-index="' + index + '">−</button><input class="small-input" data-action="line-qty" data-index="' + index + '" inputmode="numeric" value="' + attr(line.Quantity) + '"><button class="qty-btn" data-action="line-plus" data-index="' + index + '">+</button><button class="ghost" data-action="remove-line" data-index="' + index + '">Remove</button></div>' +
    '</div>';
  }

  function openItemModal(itemId) {
    var item = (state.data.menuItems || []).find(function (x) { return x.ItemID === itemId; });
    if (!item) return;
    var prompts = (state.data.prompts || []).filter(function (p) { return p.TriggerItemID === item.ItemID && Core.active(p.Active); }).sort(bySort);
    if (!prompts.length) {
      state.cart.push(Core.makeCartLine(item, [], ''));
      state.pendingPaymentRequestId = '';
      saveLocal();
      render();
      return;
    }
    var html = '<div class="modal-backdrop"><div class="modal">' +
      '<h2>' + escapeHtml(item.ItemName) + '</h2>' +
      '<div class="help">Choose the item configuration. Additional item quantities and prices are saved to the ticket, reports and kitchen.</div>' +
      prompts.map(function (p) { return renderPromptBlock(p); }).join('') +
      '<div class="prompt-block"><div class="prompt-title">Order note</div><textarea class="textarea" id="promptOrderNote" placeholder="Type any notes for this item, e.g. no beans, extra hot, allergy note"></textarea><div class="help">This note is saved with the item on the ticket, kitchen and reports.</div></div>' +
      '<div class="row"><button class="secondary" data-modal-action="close">Cancel</button><button class="primary" data-modal-action="add-configured" data-item-id="' + attr(item.ItemID) + '">Continue</button></div>' +
    '</div></div>';
    $('modalRoot').innerHTML = html;
  }

  function renderPromptBlock(prompt) {
    var options = (state.data.promptOptions || []).filter(function (o) { return o.PromptID === prompt.PromptID && Core.active(o.Active); }).sort(bySort);
    return '<div class="prompt-block" data-prompt-id="' + attr(prompt.PromptID) + '" data-required="' + (Core.truthy(prompt.Required) ? '1' : '0') + '" data-type="' + attr(prompt.PromptType || 'single') + '">' +
      '<div class="prompt-title">' + escapeHtml(prompt.PromptTitle) + (Core.truthy(prompt.Required) ? ' <span class="badge warn">Required</span>' : '') + '</div>' +
      options.map(function (o) { return renderOptionCard(prompt, o); }).join('') +
    '</div>';
  }

  function renderOptionCard(prompt, option) {
    var allowValue = Core.truthy(option.AllowValue) && String(option.OptionText || '').toLowerCase() !== 'none';
    var inputType = prompt.PromptType === 'multi' ? 'checkbox' : 'radio';
    var choice = '<label class="option-left' + (allowValue ? '' : ' option-select-all') + '"><input type="' + inputType + '" name="prompt_' + attr(prompt.PromptID) + '" value="' + attr(option.OptionID) + '">' +
      '<span><strong>' + escapeHtml(option.OptionText) + '</strong><div class="option-price">' + (Core.toNumber(option.Price, 0) ? Core.money(option.Price) + ' each' : 'No extra charge') + '</div></span></label>';
    return '<div class="option-card' + (allowValue ? ' option-card-variable' : ' option-card-selectable') + '" data-option-id="' + attr(option.OptionID) + '" data-allow-value="' + (allowValue ? '1' : '0') + '">' +
      choice +
      (allowValue ? '<div class="row"><button class="qty-btn" data-modal-action="option-minus" data-option-id="' + attr(option.OptionID) + '">−</button><input class="small-input" inputmode="numeric" data-option-qty="' + attr(option.OptionID) + '" value="0"><button class="qty-btn" data-modal-action="option-plus" data-option-id="' + attr(option.OptionID) + '">+</button></div>' : '') +
    '</div>';
  }

  function addConfiguredItem(itemId) {
    var item = (state.data.menuItems || []).find(function (x) { return x.ItemID === itemId; });
    if (!item) return;
    var selections = [];
    var valid = true;
    var message = '';
    Array.prototype.slice.call(document.querySelectorAll('.prompt-block[data-prompt-id]')).forEach(function (block) {
      var promptId = block.getAttribute('data-prompt-id');
      var prompt = (state.data.prompts || []).find(function (p) { return p.PromptID === promptId; });
      var selectedCount = 0;
      Array.prototype.slice.call(block.querySelectorAll('.option-card')).forEach(function (card) {
        var optionId = card.getAttribute('data-option-id');
        var option = (state.data.promptOptions || []).find(function (o) { return o.OptionID === optionId; });
        if (!option) return;
        var qtyInput = card.querySelector('[data-option-qty]');
        var qty = qtyInput ? Core.toNumber(qtyInput.value, 0) : 0;
        var checked = !!(card.querySelector('input[type="radio"],input[type="checkbox"]') || {}).checked;
        if (qty > 0 || checked) {
          selectedCount += 1;
          if (String(option.OptionText || '').toLowerCase() !== 'none') {
            selections.push({
              PromptID: prompt.PromptID,
              PromptTitle: prompt.PromptTitle,
              OptionID: option.OptionID,
              OptionText: option.OptionText,
              Action: option.Action || 'Modifier',
              Quantity: qty > 0 ? qty : 1,
              UnitPrice: Core.toNumber(option.Price, 0)
            });
          }
        }
      });
      if (block.getAttribute('data-required') === '1' && selectedCount === 0) {
        valid = false;
        message = 'Please answer: ' + prompt.PromptTitle;
      }
    });
    if (!valid) { toast(message); return; }
    var note = ($('promptOrderNote') || {}).value || '';
    state.cart.push(Core.makeCartLine(item, selections, note.trim()));
    state.pendingPaymentRequestId = '';
    closeModal();
    saveLocal();
    render();
  }

  function closeModal() { $('modalRoot').innerHTML = ''; }

  function takePayment(method) {
    if (state.paymentInProgress) { toast('Payment is already saving. Wait for the server confirmation.'); return; }
    var discount = discountOptions();
    var validation = Core.validatePayment(state.cart, method, state.ticketMeta.CashPaid, discount);
    if (!validation.ok) { toast(validation.message); return; }
    if (strictPersistence() && !isConfiguredUrl() && !canUseLocalTestMode()) {
      toast('Payment blocked: Google Script URL is not configured.');
      return;
    }
    if (strictPersistence() && isConfiguredUrl() && !state.serverReady) {
      toast('Payment blocked: server has not loaded successfully.');
      return;
    }
    showPaymentCustomerPrompt(method, validation.totals);
  }

  function showPaymentCustomerPrompt(method, totals) {
    totals = totals || currentTotals();
    var change = method === 'Cash' ? ('<div class="help">Cash paid: ' + Core.money(Core.toNumber(state.ticketMeta.CashPaid, 0)) + ' • Change: ' + Core.money(Core.roundMoney(Core.toNumber(state.ticketMeta.CashPaid, 0) - totals.total)) + '</div>') : '';
    var html = '<div class="modal-backdrop"><div class="modal">' +
      '<h2>' + escapeHtml(method) + ' payment</h2>' +
      '<div class="receipt-banner"><strong>Customer name</strong><span>Enter the customer name now if it needs to appear on the receipt, ticket history and kitchen ticket.</span></div>' +
      '<div class="form-grid clean-form payment-customer-form">' +
        '<label class="span2"><span>Customer name for receipt</span><input class="input" id="paymentCustomerName" placeholder="Optional customer name" value="' + attr(state.ticketMeta.CustomerName) + '"></label>' +
        '<label><span>Table number</span><input class="input" id="paymentTableNumber" placeholder="Optional table number" value="' + attr(state.ticketMeta.TableNumber) + '"></label>' +
        '<div class="card"><h3>Total to pay</h3><div class="item-price">' + Core.money(totals.total) + '</div>' + change + '</div>' +
      '</div>' +
      '<div class="row" style="margin-top:12px"><button class="secondary" data-modal-action="close">Back</button><button class="primary" data-modal-action="confirm-payment" data-method="' + attr(method) + '">Confirm ' + escapeHtml(method) + ' payment</button></div>' +
    '</div></div>';
    $('modalRoot').innerHTML = html;
    setTimeout(function () { var input = $('paymentCustomerName'); if (input) input.focus(); }, 0);
  }

  async function confirmPaymentFromPrompt(method) {
    if ($('paymentCustomerName')) state.ticketMeta.CustomerName = $('paymentCustomerName').value.trim();
    if ($('paymentTableNumber')) state.ticketMeta.TableNumber = $('paymentTableNumber').value.trim();
    await commitPayment(method);
  }

  async function commitPayment(method) {
    if (state.paymentInProgress) { toast('Payment is already saving. Wait for the server confirmation.'); return; }
    var discount = discountOptions();
    var validation = Core.validatePayment(state.cart, method, state.ticketMeta.CashPaid, discount);
    if (!validation.ok) { toast(validation.message); return; }
    if (!state.pendingPaymentRequestId) state.pendingPaymentRequestId = Core.uid('REQ');
    var meta = Object.assign({}, state.ticketMeta, {
      ClientRequestID: state.pendingPaymentRequestId,
      StaffDiscountApplied: discount.discountApplied,
      StaffDiscountPercent: discount.discountApplied ? discount.discountPercent : 0
    });
    var payload = Core.buildTicketPayload({
      cart: state.cart,
      meta: meta,
      discountApplied: discount.discountApplied,
      discountPercent: discount.discountPercent,
      payment: { method: method, cashTendered: state.ticketMeta.CashPaid }
    });
    payload.clientRequestId = state.pendingPaymentRequestId;
    var previewBundle = previewTicketBundle(payload);
    saveLocal();
    state.paymentInProgress = true;
    state.status.write = 'payment queued';
    state.status.message = isConfiguredUrl() ? 'Payment summary shown. Saving ticket to Google Sheets…' : 'Payment summary shown. Saving ticket locally for testing…';
    renderStatus();
    showReceipt(previewBundle.ticket, previewBundle.ticketItems, previewBundle.ticketAddOns, {
      title: 'Payment summary',
      state: 'saving',
      allowClose: false,
      message: isConfiguredUrl()
        ? 'Data exchange has been queued and is being confirmed by Google Sheets. The order will only clear when the save is confirmed.'
        : 'Local test mode is saving this ticket. Live strict persistence still needs Google Sheets.'
    });
    try {
      var result;
      if (isConfiguredUrl()) {
        result = await api('commitTicket', { ticket: payload });
      } else if (canUseLocalTestMode()) {
        result = commitLocalTicket(payload);
      } else {
        throw new Error('Google Script URL is not configured.');
      }
      mergeCommittedTicket(result.data);
      state.cart = [];
      state.pendingPaymentRequestId = '';
      state.ticketMeta.TableNumber = '';
      state.ticketMeta.CustomerName = '';
      state.ticketMeta.CashPaid = '';
      state.ticketMeta.StaffDiscountApplied = false;
      state.paymentInProgress = false;
      state.status.write = 'OK';
      state.status.read = isConfiguredUrl() ? 'OK' : 'local test only';
      state.status.message = isConfiguredUrl() ? 'Ticket saved to Google Sheets' : 'Ticket saved locally for testing only';
      saveLocal();
      saveServerCache();
      render();
      showReceipt(result.data.ticket, result.data.ticketItems, result.data.ticketAddOns, {
        title: 'Ticket #' + result.data.ticket.TicketNumber + ' saved',
        state: 'saved',
        allowClose: true,
        message: isConfiguredUrl() ? 'Server confirmed. The basket, customer name and table number have now been cleared safely.' : 'Local test save complete.'
      });
    } catch (err) {
      state.paymentInProgress = false;
      state.status.mode = 'error';
      state.status.write = 'failed';
      state.status.message = 'Payment not saved: ' + err.message;
      renderStatus();
      showReceipt(previewBundle.ticket, previewBundle.ticketItems, previewBundle.ticketAddOns, {
        title: 'Payment not saved',
        state: 'failed',
        allowClose: true,
        message: 'Google Sheets did not confirm the save: ' + err.message + '. The order has not been cleared and can be retried.'
      });
      toast('Payment not saved. The order has not been cleared.');
    }
  }

  function previewTicketBundle(payload) {
    var now = new Date().toISOString();
    var ticketId = 'PENDING_' + String(payload.clientRequestId || Core.uid('REQ'));
    var ticket = {
      TicketID: ticketId,
      TicketNumber: 'saving…',
      CreatedAt: now,
      OrderType: payload.meta.OrderType || '',
      ServerName: payload.meta.ServerName || '',
      TableNumber: payload.meta.TableNumber || '',
      CustomerName: payload.meta.CustomerName || '',
      Subtotal: payload.totals.subtotal,
      AddOnTotal: payload.totals.addOnTotal,
      LoyaltyTotal: payload.totals.loyaltyTotal,
      DiscountTotal: payload.totals.discountTotal,
      Total: payload.totals.total,
      PaymentMethod: payload.payment.method,
      CashTendered: payload.payment.cashTendered,
      ChangeDue: payload.payment.changeDue,
      Status: 'SAVING'
    };
    var ticketItems = [];
    var ticketAddOns = [];
    payload.cart.forEach(function (line) {
      var ticketItemId = Core.uid('PVI');
      ticketItems.push({
        TicketItemID: ticketItemId,
        TicketID: ticketId,
        ItemID: line.ItemID,
        ItemName: line.ItemName,
        CategoryID: line.CategoryID,
        Quantity: line.Quantity,
        BasePrice: line.BasePrice,
        AddOnTotal: Core.roundMoney(Core.toNumber(line.UnitAddOnTotal, 0) * Core.toNumber(line.Quantity, 1)),
        LineTotal: line.LineTotal,
        LoyaltyRedeemed: Core.truthy(line.LoyaltyRedeemed),
        LoyaltyDiscount: Core.lineLoyaltyDiscount(line),
        Note: line.Note || '',
        Status: 'SAVING'
      });
      (line.AddOns || []).forEach(function (a) {
        var qty = Core.toNumber(a.Quantity, 1) * Core.toNumber(line.Quantity, 1);
        ticketAddOns.push({
          AddOnID: Core.uid('PVA'),
          TicketItemID: ticketItemId,
          TicketID: ticketId,
          PromptID: a.PromptID,
          PromptTitle: a.PromptTitle,
          OptionID: a.OptionID,
          OptionText: a.OptionText,
          Quantity: qty,
          UnitPrice: a.UnitPrice,
          Total: Core.roundMoney(qty * Core.toNumber(a.UnitPrice, 0)),
          Action: a.Action || 'Modifier'
        });
      });
    });
    return { ticket: ticket, ticketItems: ticketItems, ticketAddOns: ticketAddOns };
  }

  function commitLocalTicket(payload) {
    var ticketNo = Core.toNumber(state.data.nextTicketNumber, 1);
    state.data.nextTicketNumber = ticketNo + 1;
    var now = new Date().toISOString();
    var ticketId = Core.uid('T');
    var ticket = {
      TicketID: ticketId,
      TicketNumber: ticketNo,
      CreatedAt: now,
      OrderType: payload.meta.OrderType || '',
      ServerName: payload.meta.ServerName || '',
      TableNumber: payload.meta.TableNumber || '',
      CustomerName: payload.meta.CustomerName || '',
      Subtotal: payload.totals.subtotal,
      AddOnTotal: payload.totals.addOnTotal,
      LoyaltyTotal: payload.totals.loyaltyTotal,
      DiscountTotal: payload.totals.discountTotal,
      Total: payload.totals.total,
      PaymentMethod: payload.payment.method,
      CashTendered: payload.payment.cashTendered,
      ChangeDue: payload.payment.changeDue,
      Status: 'PAID'
    };
    var ticketItems = [];
    var ticketAddOns = [];
    payload.cart.forEach(function (line) {
      var ticketItemId = Core.uid('TI');
      ticketItems.push({
        TicketItemID: ticketItemId,
        TicketID: ticketId,
        ItemID: line.ItemID,
        ItemName: line.ItemName,
        CategoryID: line.CategoryID,
        Quantity: line.Quantity,
        BasePrice: line.BasePrice,
        AddOnTotal: line.UnitAddOnTotal * line.Quantity,
        LineTotal: line.LineTotal,
        LoyaltyRedeemed: Core.truthy(line.LoyaltyRedeemed),
        LoyaltyDiscount: Core.lineLoyaltyDiscount(line),
        Note: line.Note || '',
        Status: 'OPEN'
      });
      (line.AddOns || []).forEach(function (a) {
        ticketAddOns.push({
          AddOnID: Core.uid('TA'),
          TicketItemID: ticketItemId,
          TicketID: ticketId,
          PromptID: a.PromptID,
          PromptTitle: a.PromptTitle,
          OptionID: a.OptionID,
          OptionText: a.OptionText,
          Quantity: Core.toNumber(a.Quantity, 1) * Core.toNumber(line.Quantity, 1),
          UnitPrice: a.UnitPrice,
          Total: Core.roundMoney(Core.toNumber(a.Quantity, 1) * Core.toNumber(line.Quantity, 1) * Core.toNumber(a.UnitPrice, 0)),
          Action: a.Action || 'Modifier'
        });
      });
    });
    var kitchen = {
      KitchenID: Core.uid('K'),
      TicketID: ticketId,
      TicketNumber: ticketNo,
      CreatedAt: now,
      OrderType: ticket.OrderType,
      ServerName: ticket.ServerName,
      TableNumber: ticket.TableNumber,
      CustomerName: ticket.CustomerName,
      Status: 'OPEN',
      PayloadJSON: JSON.stringify(Core.kitchenPayloadFromTicket(ticket, ticketItems, ticketAddOns))
    };
    return { ok: true, data: { ticket: ticket, ticketItems: ticketItems, ticketAddOns: ticketAddOns, kitchen: kitchen } };
  }

  function mergeCommittedTicket(bundle) {
    if (!bundle || !bundle.ticket) return;
    state.data.tickets = (state.data.tickets || []).filter(function (t) { return t.TicketID !== bundle.ticket.TicketID; });
    state.data.ticketItems = (state.data.ticketItems || []).filter(function (it) { return it.TicketID !== bundle.ticket.TicketID; });
    state.data.ticketAddOns = (state.data.ticketAddOns || []).filter(function (a) { return a.TicketID !== bundle.ticket.TicketID; });
    state.data.kitchenQueue = (state.data.kitchenQueue || []).filter(function (k) { return k.TicketID !== bundle.ticket.TicketID; });
    state.data.tickets.push(bundle.ticket);
    state.data.ticketItems = state.data.ticketItems.concat(bundle.ticketItems || []);
    state.data.ticketAddOns = state.data.ticketAddOns.concat(bundle.ticketAddOns || []);
    if (bundle.kitchen) state.data.kitchenQueue.push(bundle.kitchen);
  }

  function showReceipt(ticket, items, addons, options) {
    options = options || {};
    var title = options.title || ('Ticket #' + ticket.TicketNumber + ' saved');
    var stateClass = options.state ? ' receipt-state-' + options.state : '';
    var banner = options.message ? '<div class="receipt-banner' + stateClass + '"><strong>' + escapeHtml(options.state === 'failed' ? 'Action needed' : (options.state === 'saved' ? 'Confirmed' : 'Saving')) + '</strong><span>' + escapeHtml(options.message) + '</span></div>' : '';
    var closeButton = options.allowClose === false
      ? '<button class="secondary" disabled>Waiting for server confirmation…</button>'
      : '<button class="primary" data-modal-action="close">Close</button>';
    var html = '<div class="modal-backdrop"><div class="modal">' +
      '<h2>' + escapeHtml(title) + '</h2>' + banner +
      '<div class="cards"><div class="card"><h3>Total to pay</h3><div class="item-price">' + Core.money(ticket.Total) + '</div><div>' + escapeHtml(ticket.PaymentMethod) + (ticket.PaymentMethod === 'Cash' ? ' • Change ' + Core.money(ticket.ChangeDue) : '') + '</div>' +
        '<div class="receipt-money-lines"><div>Items: ' + Core.money(ticket.Subtotal) + '</div><div>Additional items: ' + Core.money(ticket.AddOnTotal) + '</div>' + (Core.toNumber(ticket.LoyaltyTotal, 0) ? '<div class="loyalty-text">Loyalty: -' + Core.money(ticket.LoyaltyTotal) + '</div>' : '') + (Core.toNumber(ticket.DiscountTotal, 0) ? '<div class="discount-text">Staff discount: -' + Core.money(ticket.DiscountTotal) + '</div>' : '') + '</div></div><div class="card"><h3>Ticket</h3><div class="item-price">#' + escapeHtml(ticket.TicketNumber) + '</div><div>' + escapeHtml(ticket.Status || '') + '</div><div class="receipt-money-lines">' + (ticket.CustomerName ? '<div>Customer: ' + escapeHtml(ticket.CustomerName) + '</div>' : '') + (ticket.TableNumber ? '<div>Table: ' + escapeHtml(ticket.TableNumber) + '</div>' : '') + '</div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Qty</th><th>Item</th><th>Configuration</th><th>Total</th></tr></thead><tbody>' +
      (items || []).map(function (it) {
        var rowAddons = (addons || []).filter(function (a) { return a.TicketItemID === it.TicketItemID; });
        var loyalty = Core.toNumber(it.LoyaltyDiscount, 0);
        var rowTotal = Core.roundMoney(Core.toNumber(it.LineTotal, 0) - loyalty);
        return '<tr><td>' + escapeHtml(it.Quantity) + '</td><td>' + escapeHtml(it.ItemName) + (loyalty ? '<div class="loyalty-chip">LOYALTY - ' + Core.money(loyalty) + '</div>' : '') + (it.Note ? '<div class="note-chip">' + escapeHtml(it.Note) + '</div>' : '') + '</td><td>' + rowAddons.map(function (a) { return escapeHtml(a.OptionText) + (Core.toNumber(a.Quantity, 1) > 1 ? ' x' + escapeHtml(a.Quantity) : ''); }).join('<br>') + '</td><td>' + Core.money(rowTotal) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="row" style="margin-top:12px">' + closeButton + '</div>' +
    '</div></div>';
    $('modalRoot').innerHTML = html;
  }

  function renderHeld() {
    var held = state.data.heldOrders || [];
    $('main').innerHTML = '<section class="panel"><div class="loader-header"><h2>Held orders</h2><button class="primary" data-action="hold-current">Hold current ticket</button></div>' +
      (held.length ? '<div class="cards">' + held.map(function (h) {
        var total = h.Total || (safeJson(h.PayloadJSON).totals || {}).total || 0;
        return '<div class="card"><h3>' + escapeHtml(h.CustomerName || h.TableNumber || h.OrderType || 'Held order') + '</h3><div class="help">' + escapeHtml(h.CreatedAt || '') + '</div><div class="item-price">' + Core.money(total) + '</div><div class="row"><button class="primary" data-action="recall-held" data-id="' + attr(h.HoldID) + '">Recall</button><button class="danger" data-action="delete-held" data-id="' + attr(h.HoldID) + '">Delete</button></div></div>';
      }).join('') + '</div>' : '<div class="card">No held orders.</div>') + '</section>';
  }

  async function holdCurrent() {
    if (!state.cart.length) { toast('There is no current order to hold.'); return; }
    if (strictPersistence() && !isConfiguredUrl() && !canUseLocalTestMode()) { toast('Hold blocked: server is not configured.'); return; }
    var discount = discountOptions();
    var holdMeta = Object.assign({}, state.ticketMeta, { StaffDiscountApplied: discount.discountApplied, StaffDiscountPercent: discount.discountPercent });
    var payload = Core.buildTicketPayload({ cart: state.cart, meta: holdMeta, discountApplied: discount.discountApplied, discountPercent: discount.discountPercent, payment: { method: '' } });
    var hold = {
      HoldID: Core.uid('H'),
      CreatedAt: new Date().toISOString(),
      OrderType: state.ticketMeta.OrderType,
      ServerName: state.ticketMeta.ServerName,
      TableNumber: state.ticketMeta.TableNumber,
      CustomerName: state.ticketMeta.CustomerName,
      PayloadJSON: JSON.stringify(payload),
      Total: payload.totals.total
    };
    try {
      state.status.write = 'saving held order';
      renderStatus();
      if (isConfiguredUrl()) await api('holdOrder', { hold: hold });
      else if (!canUseLocalTestMode()) throw new Error('Google Script URL is not configured.');
      state.data.heldOrders = state.data.heldOrders || [];
      state.data.heldOrders.push(hold);
      state.cart = [];
      state.pendingPaymentRequestId = '';
      state.ticketMeta.CashPaid = '';
      state.ticketMeta.StaffDiscountApplied = false;
      state.status.write = 'OK';
      state.status.message = isConfiguredUrl() ? 'Held order saved to Google Sheets' : 'Held order saved locally for testing only';
      saveLocal();
      saveServerCache();
      render();
      toast('Order held.');
    } catch (err) {
      state.status.mode = 'error';
      state.status.write = 'failed';
      state.status.message = 'Hold not saved: ' + err.message;
      renderStatus();
      toast('Hold not saved. The order is still on the till.');
    }
  }

  async function recallHeld(id) {
    var held = (state.data.heldOrders || []).find(function (h) { return h.HoldID === id; });
    if (!held) return;
    try {
      if (isConfiguredUrl()) await api('deleteHeldOrder', { HoldID: id });
      else if (!canUseLocalTestMode()) throw new Error('Google Script URL is not configured.');
      var payload = safeJson(held.PayloadJSON);
      state.cart = payload.cart || [];
      state.pendingPaymentRequestId = '';
      state.ticketMeta = Object.assign(state.ticketMeta, payload.meta || {}, { CashPaid: '' });
      state.data.heldOrders = (state.data.heldOrders || []).filter(function (h) { return h.HoldID !== id; });
      state.activeTab = 'Till';
      saveLocal();
      saveServerCache();
      render();
    } catch (err) {
      toast('Held order could not be recalled because the server update failed: ' + err.message);
    }
  }

  async function deleteHeld(id) {
    try {
      if (isConfiguredUrl()) await api('deleteHeldOrder', { HoldID: id });
      else if (!canUseLocalTestMode()) throw new Error('Google Script URL is not configured.');
      state.data.heldOrders = (state.data.heldOrders || []).filter(function (h) { return h.HoldID !== id; });
      saveLocal();
      saveServerCache();
      render();
    } catch (err) {
      toast('Held order delete failed: ' + err.message);
    }
  }

  function safeJson(text) { try { return typeof text === 'string' ? JSON.parse(text) : (text || {}); } catch (err) { return {}; } }

  function renderLiveTickets() {
    var tickets = (state.data.tickets || []).slice().sort(function (a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); });
    $('main').innerHTML = '<section class="panel"><div class="loader-header"><h2>Live Tickets</h2><button class="secondary" data-action="refresh">Refresh from server</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Time</th><th>Type</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>' +
      tickets.map(function (t) {
        return '<tr><td>#' + escapeHtml(t.TicketNumber) + '</td><td>' + escapeHtml(formatDate(t.CreatedAt)) + '</td><td>' + escapeHtml(t.OrderType) + '</td><td>' + Core.money(t.Total) + '</td><td>' + escapeHtml(t.PaymentMethod) + '</td><td>' + escapeHtml(t.Status || 'PAID') + '</td><td><button class="secondary" data-action="view-ticket" data-id="' + attr(t.TicketID) + '">View</button></td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function viewTicket(ticketId) {
    var t = (state.data.tickets || []).find(function (x) { return x.TicketID === ticketId; });
    if (!t) return;
    var items = (state.data.ticketItems || []).filter(function (x) { return x.TicketID === ticketId; });
    var addons = (state.data.ticketAddOns || []).filter(function (x) { return x.TicketID === ticketId; });
    showReceipt(t, items, addons);
  }

  function renderReports() {
    var allTickets = (state.data.tickets || []).filter(function (t) { return (t.Status || 'PAID') !== 'VOID'; });
    var tickets = allTickets.filter(ticketInReportRange);
    var ticketIdMap = {};
    tickets.forEach(function (t) { ticketIdMap[t.TicketID] = true; });
    var grossSales = tickets.reduce(function (s, t) { return s + Core.toNumber(t.Subtotal, 0) + Core.toNumber(t.AddOnTotal, 0); }, 0);
    var loyaltyGiven = tickets.reduce(function (s, t) { return s + Core.toNumber(t.LoyaltyTotal, 0); }, 0);
    var staffDiscountGiven = tickets.reduce(function (s, t) { return s + Core.toNumber(t.DiscountTotal, 0); }, 0);
    var discountGiven = Core.roundMoney(loyaltyGiven + staffDiscountGiven);
    var totalSales = tickets.reduce(function (s, t) { return s + Core.toNumber(t.Total, 0); }, 0);
    var cashSales = tickets.filter(function (t) { return t.PaymentMethod === 'Cash'; }).reduce(function (s, t) { return s + Core.toNumber(t.Total, 0); }, 0);
    var cardSales = tickets.filter(function (t) { return t.PaymentMethod === 'Card'; }).reduce(function (s, t) { return s + Core.toNumber(t.Total, 0); }, 0);
    var itemRows = itemReportRows(ticketIdMap);
    $('main').innerHTML = '<section class="panel"><div class="loader-header"><div><h2>Reports</h2><div class="help">Current view: ' + escapeHtml(reportRangeLabel()) + '. Today loads automatically when you open Reports.</div></div><button class="secondary" data-action="refresh">Refresh from server</button></div>' +
      '<div class="report-filters"><label><span>From</span><input class="input" type="date" id="reportFrom" value="' + attr(state.reportFrom) + '"></label><label><span>To</span><input class="input" type="date" id="reportTo" value="' + attr(state.reportTo) + '"></label><button class="secondary" data-action="report-today">Today</button><button class="secondary" data-action="export-reports">Export selected period</button><button class="danger" data-action="clear-reports">Clear all reports</button></div>' +
      '<div class="cards"><div class="card"><h3>Net sales</h3><div class="item-price">' + Core.money(totalSales) + '</div><div class="help">After loyalty and staff discount</div></div><div class="card"><h3>Gross before discount</h3><div class="item-price">' + Core.money(grossSales) + '</div></div><div class="card"><h3>Total discount given</h3><div class="item-price discount-text">' + Core.money(discountGiven) + '</div><div class="help">Loyalty + staff discount</div></div><div class="card"><h3>Loyalty given</h3><div class="item-price loyalty-text">' + Core.money(loyaltyGiven) + '</div></div><div class="card"><h3>Staff discount</h3><div class="item-price discount-text">' + Core.money(staffDiscountGiven) + '</div></div><div class="card"><h3>Cash</h3><div class="item-price">' + Core.money(cashSales) + '</div></div><div class="card"><h3>Card</h3><div class="item-price">' + Core.money(cardSales) + '</div></div><div class="card"><h3>Tickets</h3><div class="item-price">' + tickets.length + '</div></div></div>' +
      '<h3>Ticket totals</h3><div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Time</th><th>Payment</th><th>Gross</th><th>Loyalty</th><th>Staff discount</th><th>Net total</th></tr></thead><tbody>' +
      tickets.slice().sort(function (a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); }).map(function (t) {
        var gross = Core.toNumber(t.Subtotal, 0) + Core.toNumber(t.AddOnTotal, 0);
        return '<tr><td>#' + escapeHtml(t.TicketNumber) + '</td><td>' + escapeHtml(formatDate(t.CreatedAt)) + '</td><td>' + escapeHtml(t.PaymentMethod) + '</td><td>' + Core.money(gross) + '</td><td>' + Core.money(t.LoyaltyTotal) + '</td><td>' + Core.money(t.DiscountTotal) + '</td><td>' + Core.money(t.Total) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<h3>Item sales</h3><div class="table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Gross item value</th><th>Loyalty value</th><th>Net item value</th></tr></thead><tbody>' +
      itemRows.map(function (r) { return '<tr><td>' + escapeHtml(r.name) + '</td><td>' + escapeHtml(r.qty) + '</td><td>' + Core.money(r.sales) + '</td><td>' + Core.money(r.loyalty) + '</td><td>' + Core.money(r.net) + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>';
  }

  function itemReportRows(ticketIdMap) {
    var map = {};
    (state.data.ticketItems || []).forEach(function (item) {
      if (ticketIdMap && !ticketIdMap[item.TicketID]) return;
      if (!map[item.ItemName]) map[item.ItemName] = { name: item.ItemName, qty: 0, sales: 0, loyalty: 0, net: 0 };
      map[item.ItemName].qty += Core.toNumber(item.Quantity, 0);
      map[item.ItemName].sales += Core.toNumber(item.LineTotal, 0);
      map[item.ItemName].loyalty += Core.toNumber(item.LoyaltyDiscount, 0);
      map[item.ItemName].net += Core.roundMoney(Core.toNumber(item.LineTotal, 0) - Core.toNumber(item.LoyaltyDiscount, 0));
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.qty - a.qty; });
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function exportReports() {
    var tickets = (state.data.tickets || []).filter(function (t) { return (t.Status || 'PAID') !== 'VOID' && ticketInReportRange(t); });
    var ids = {};
    tickets.forEach(function (t) { ids[t.TicketID] = true; });
    var rows = [['Ticket Number','Created At','Order Type','Server','Table','Customer','Payment Method','Subtotal','Add On Total','Loyalty Discount','Staff Discount','Total','Status']];
    tickets.forEach(function (t) {
      rows.push([t.TicketNumber,t.CreatedAt,t.OrderType,t.ServerName,t.TableNumber,t.CustomerName,t.PaymentMethod,t.Subtotal,t.AddOnTotal,t.LoyaltyTotal,t.DiscountTotal,t.Total,t.Status || 'PAID']);
    });
    rows.push([]);
    rows.push(['ITEM LINES']);
    rows.push(['Ticket Number','Item','Quantity','Base Price','Line Total','Loyalty Discount','Notes']);
    (state.data.ticketItems || []).filter(function (i) { return ids[i.TicketID]; }).forEach(function (i) {
      var ticket = tickets.find(function (t) { return t.TicketID === i.TicketID; }) || {};
      rows.push([ticket.TicketNumber,i.ItemName,i.Quantity,i.BasePrice,i.LineTotal,i.LoyaltyDiscount,i.Notes || '']);
    });
    var csv = rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nook-reports-' + (state.reportFrom || 'start') + '-to-' + (state.reportTo || 'today') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Report export created for ' + reportRangeLabel() + '.');
  }

  function openClearReportsKeypad() {
    var html = '<div class="modal-backdrop"><div class="modal report-clear-modal">' +
      '<h2>Clear all reports</h2>' +
      '<div class="danger-panel"><strong>Warning</strong><div>This permanently clears all tickets, ticket items, add-ons, refunds and kitchen records, then resets the ticket counter to 0.</div></div>' +
      '<div class="keypad-hint">Passcode hint: <strong>Wiesheu</strong></div>' +
      '<div class="passcode-display" id="reportClearPasscodeDisplay" aria-label="Report clear passcode">••••</div>' +
      '<input type="hidden" id="reportClearPasscode" value="">' +
      '<div class="pos-keypad" aria-label="Numeric keypad">' +
        [1,2,3,4,5,6,7,8,9].map(function (digit) { return '<button type="button" class="keypad-key" data-modal-action="report-code-digit" data-digit="' + digit + '">' + digit + '</button>'; }).join('') +
        '<button type="button" class="keypad-key keypad-clear" data-modal-action="report-code-clear">Clear</button>' +
        '<button type="button" class="keypad-key" data-modal-action="report-code-digit" data-digit="0">0</button>' +
        '<button type="button" class="keypad-key keypad-delete" data-modal-action="report-code-delete">⌫</button>' +
      '</div>' +
      '<div class="row keypad-actions"><button class="secondary" data-modal-action="close">Cancel</button><button class="danger" data-modal-action="report-code-submit">Clear reports</button></div>' +
    '</div></div>';
    $('modalRoot').innerHTML = html;
    updateReportClearPasscodeDisplay();
  }

  function updateReportClearPasscodeDisplay() {
    var input = $('reportClearPasscode');
    var display = $('reportClearPasscodeDisplay');
    if (!input || !display) return;
    var length = String(input.value || '').length;
    display.textContent = Array(length + 1).join('●') + Array(Math.max(0, 4 - length) + 1).join('○');
  }

  function editReportClearPasscode(action, digit) {
    var input = $('reportClearPasscode');
    if (!input) return;
    var value = String(input.value || '');
    if (action === 'digit' && value.length < 4) value += String(digit || '');
    if (action === 'delete') value = value.slice(0, -1);
    if (action === 'clear') value = '';
    input.value = value.replace(/\D/g, '').slice(0, 4);
    updateReportClearPasscodeDisplay();
  }

  async function submitClearReportsPasscode() {
    var input = $('reportClearPasscode');
    var passcode = String((input || {}).value || '').trim();
    if (passcode.length !== 4) { toast('Enter the four-digit passcode.'); return; }
    if (!window.confirm('Permanently clear all saved reports and reset the ticket counter to 0?')) return;
    try {
      state.status.write = 'clearing reports';
      renderStatus();
      await api('clearReports', { passcode: passcode });
      closeModal();
      await bootstrap();
      toast('All report data cleared. Ticket counter reset to 0.');
    } catch (err) {
      editReportClearPasscode('clear');
      persistFailed('Reports were not cleared', err);
    }
  }

  function renderRefunds() {
    var tickets = (state.data.tickets || []).slice().sort(function (a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); });
    var refunds = state.data.refunds || [];
    $('main').innerHTML = '<section class="panel"><h2>Refunds</h2><div class="help">Select a saved ticket, enter reason and amount, then save the refund to reports.</div>' +
      '<div class="form-grid"><select class="select span2" id="refundTicketId"><option value="">Select ticket</option>' + tickets.map(function (t) { return '<option value="' + attr(t.TicketID) + '">#' + escapeHtml(t.TicketNumber) + ' - ' + Core.money(t.Total) + ' - ' + escapeHtml(formatDate(t.CreatedAt)) + '</option>'; }).join('') + '</select>' +
      '<input class="input" id="refundAmount" inputmode="decimal" placeholder="Refund amount"><input class="input" id="refundStaff" placeholder="Staff name"><textarea class="textarea span2" id="refundReason" placeholder="Reason"></textarea><button class="primary span2" data-action="save-refund">Save refund</button></div>' +
      '<h3>Refund log</h3><div class="table-wrap"><table><thead><tr><th>Time</th><th>Ticket</th><th>Amount</th><th>Reason</th><th>Staff</th></tr></thead><tbody>' + refunds.map(function (r) { return '<tr><td>' + escapeHtml(formatDate(r.CreatedAt)) + '</td><td>#' + escapeHtml(r.TicketNumber) + '</td><td>' + Core.money(r.Amount) + '</td><td>' + escapeHtml(r.Reason) + '</td><td>' + escapeHtml(r.StaffName) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
  }

  async function saveRefund() {
    var ticketId = $('refundTicketId').value;
    var ticket = (state.data.tickets || []).find(function (t) { return t.TicketID === ticketId; });
    if (!ticket) { toast('Select a ticket first.'); return; }
    var refund = {
      RefundID: Core.uid('R'),
      TicketID: ticket.TicketID,
      TicketNumber: ticket.TicketNumber,
      CreatedAt: new Date().toISOString(),
      Amount: Core.roundMoney(Core.toNumber($('refundAmount').value, ticket.Total)),
      Reason: $('refundReason').value.trim(),
      StaffName: $('refundStaff').value.trim()
    };
    if (!refund.Amount) { toast('Enter a refund amount.'); return; }
    try {
      state.status.write = 'saving refund';
      renderStatus();
      if (isConfiguredUrl()) await api('refundTicket', { refund: refund });
      else if (!canUseLocalTestMode()) throw new Error('Google Script URL is not configured.');
      state.data.refunds = state.data.refunds || [];
      state.data.refunds.push(refund);
      state.status.write = 'OK';
      state.status.message = isConfiguredUrl() ? 'Refund saved to Google Sheets' : 'Refund saved locally for testing only';
      saveLocal();
      saveServerCache();
      render();
      toast('Refund saved.');
    } catch (err) {
      state.status.mode = 'error';
      state.status.write = 'failed';
      state.status.message = 'Refund not saved: ' + err.message;
      renderStatus();
      toast('Refund not saved.');
    }
  }

  function kitchenOpenTicketCounts(queue) {
    return (queue || []).reduce(function (counts, k) {
      var payload = safeJson(k.PayloadJSON);
      var groups = kitchenGroups(payload.Items || []);
      var sectionState = kitchenSectionState(payload);
      var ticketComplete = (k.Status || 'OPEN') === 'COMPLETE';
      if (!ticketComplete && groups.food.length && sectionState.FoodStatus !== 'COMPLETE') counts.food += 1;
      if (!ticketComplete && groups.drinks.length && sectionState.DrinksStatus !== 'COMPLETE') counts.drinks += 1;
      return counts;
    }, { food: 0, drinks: 0 });
  }

  function renderKitchen() {
    var allQueue = state.data.kitchenQueue || [];
    var counts = kitchenOpenTicketCounts(allQueue);
    var queue = allQueue.filter(function (k) {
      return (k.Status || 'OPEN') !== 'COMPLETE' || state.kitchenRecentlyCompleted[k.KitchenID];
    }).sort(function (a, b) { return String(a.CreatedAt).localeCompare(String(b.CreatedAt)); });
    $('main').innerHTML = '<section class="panel"><div class="loader-header"><div><h2>Kitchen Display</h2><div class="help">New tickets load automatically from Google Sheets while this screen is open. Food and drinks are split by the Drink category tick box in Menu Admin. Completed sections stay greyed out on every device after the server confirms the update.</div></div><div class="kitchen-header-actions"><div class="kitchen-open-counts" aria-label="Open kitchen ticket counts"><span class="kitchen-count food"><strong>' + counts.food + '</strong> Open Food</span><span class="kitchen-count drinks"><strong>' + counts.drinks + '</strong> Open Drinks</span></div><button class="secondary" data-action="refresh">Refresh from server</button></div></div>' +
      '<div class="kitchen-grid">' + (queue.length ? queue.map(renderKitchenTicket).join('') : '<div class="card">No open kitchen tickets.</div>') + '</div></section>';
  }

  function kitchenSectionState(payload) {
    var sections = payload.Sections || {};
    return {
      FoodStatus: sections.FoodStatus || 'OPEN',
      DrinksStatus: sections.DrinksStatus || 'OPEN',
      CompletedAt: sections.CompletedAt || ''
    };
  }

  function isDrinkItem(item) {
    return isDrinkCategory(item.CategoryID);
  }

  function kitchenGroups(items) {
    var groups = { food: [], drinks: [] };
    (items || []).forEach(function (item) {
      if (isDrinkItem(item)) groups.drinks.push(item);
      else groups.food.push(item);
    });
    return groups;
  }

  function isKitchenSectionDone(sectionState, sectionName, groupItems) {
    if (!groupItems.length) return true;
    return sectionName === 'food' ? sectionState.FoodStatus === 'COMPLETE' : sectionState.DrinksStatus === 'COMPLETE';
  }

  function kitchenOverallStatus(sectionState, groups) {
    var foodDone = isKitchenSectionDone(sectionState, 'food', groups.food);
    var drinksDone = isKitchenSectionDone(sectionState, 'drinks', groups.drinks);
    return foodDone && drinksDone ? 'COMPLETE' : 'OPEN';
  }

  function renderKitchenTicket(k) {
    var payload = safeJson(k.PayloadJSON);
    var ticketNumber = k.TicketNumber || payload.TicketNumber || '';
    var items = payload.Items || [];
    var groups = kitchenGroups(items);
    var sectionState = kitchenSectionState(payload);
    var complete = (k.Status || 'OPEN') === 'COMPLETE' || kitchenOverallStatus(sectionState, groups) === 'COMPLETE';
    var meta = [];
    if (k.TableNumber || payload.TableNumber) meta.push('Table ' + (k.TableNumber || payload.TableNumber));
    if (k.CustomerName || payload.CustomerName) meta.push(k.CustomerName || payload.CustomerName);
    if (k.ServerName || payload.ServerName) meta.push('Staff: ' + (k.ServerName || payload.ServerName));
    return '<div class="kitchen-ticket' + (complete ? ' complete' : '') + '"><div class="stamp">COMPLETED</div><div class="kitchen-header"><div><div class="ticket-last4">#' + escapeHtml(ticketNumber) + '</div><strong>' + escapeHtml(k.OrderType || payload.OrderType || '') + '</strong><div class="help">' + escapeHtml(formatDate(k.CreatedAt || payload.CreatedAt)) + '</div>' + (meta.length ? '<div class="help">' + escapeHtml(meta.join(' • ')) + '</div>' : '') + '</div></div>' +
      renderKitchenSection(k, 'food', 'Food', groups.food, sectionState.FoodStatus) +
      renderKitchenSection(k, 'drinks', 'Drinks', groups.drinks, sectionState.DrinksStatus) +
      '</div>';
  }

  function renderKitchenSection(k, sectionName, title, items, status) {
    if (!items.length) return '';
    var done = status === 'COMPLETE';
    return '<div class="kitchen-section' + (done ? ' done' : '') + '"><div class="kitchen-section-head"><div><h3>' + escapeHtml(title) + '</h3><span class="badge ' + (done ? 'ok' : 'warn') + '">' + (done ? 'Completed' : 'Open') + '</span></div>' +
      (done ? '<button class="secondary" data-action="reopen-kitchen-section" data-id="' + attr(k.KitchenID) + '" data-section="' + attr(sectionName) + '">Reopen</button>' : '<button class="primary" data-action="complete-kitchen-section" data-id="' + attr(k.KitchenID) + '" data-section="' + attr(sectionName) + '">Complete ' + escapeHtml(title) + '</button>') +
      '</div>' + items.map(function (item) {
        var loyalty = Core.toNumber(item.LoyaltyDiscount, 0);
        return '<div class="kitchen-item"><strong>' + escapeHtml(item.Quantity) + ' x ' + escapeHtml(item.ItemName) + '</strong>' +
          (loyalty ? '<div class="loyalty-chip">LOYALTY</div>' : '') +
          ((item.AddOns || []).length ? '<ul class="addon-list">' + item.AddOns.map(function (a) { return '<li>' + escapeHtml(a.OptionText) + (Core.toNumber(a.Quantity, 1) > 1 ? ' x' + escapeHtml(a.Quantity) : '') + '</li>'; }).join('') + '</ul>' : '') +
          (item.Note ? '<div class="note-chip">' + escapeHtml(item.Note) + '</div>' : '') + '</div>';
      }).join('') + '</div>';
  }

  async function updateKitchenSection(id, sectionName, status) {
    var k = (state.data.kitchenQueue || []).find(function (x) { return x.KitchenID === id; });
    if (!k) return;
    var payload = safeJson(k.PayloadJSON);
    var groups = kitchenGroups(payload.Items || []);
    var sectionState = kitchenSectionState(payload);
    if (sectionName === 'food') sectionState.FoodStatus = status;
    if (sectionName === 'drinks') sectionState.DrinksStatus = status;
    var overall = kitchenOverallStatus(sectionState, groups);
    if (overall === 'COMPLETE') sectionState.CompletedAt = new Date().toISOString();
    else sectionState.CompletedAt = '';
    payload.Sections = sectionState;
    try {
      if (isConfiguredUrl()) await api('kitchenUpdate', { KitchenID: id, Status: overall, PayloadJSON: JSON.stringify(payload) });
      else if (!canUseLocalTestMode()) throw new Error('Google Script URL is not configured.');
      k.Status = overall;
      k.PayloadJSON = JSON.stringify(payload);
      state.status.write = 'OK';
      state.status.message = isConfiguredUrl() ? 'Kitchen section updated in Google Sheets' : 'Kitchen section updated locally for testing only';
      saveLocal();
      saveServerCache();
      if (overall === 'COMPLETE') {
        state.kitchenRecentlyCompleted[id] = true;
        render();
        setTimeout(function () {
          delete state.kitchenRecentlyCompleted[id];
          if (state.activeTab === 'Kitchen') render();
        }, 3000);
      } else {
        delete state.kitchenRecentlyCompleted[id];
        render();
      }
    } catch (err) {
      state.status.mode = 'error';
      state.status.write = 'failed';
      state.status.message = 'Kitchen update failed: ' + err.message;
      renderStatus();
      toast('Kitchen update failed. Ticket remains open.');
    }
  }

  async function completeKitchen(id) {
    var k = (state.data.kitchenQueue || []).find(function (x) { return x.KitchenID === id; });
    if (!k) return;
    var payload = safeJson(k.PayloadJSON);
    var groups = kitchenGroups(payload.Items || []);
    var sectionState = kitchenSectionState(payload);
    if (groups.food.length) sectionState.FoodStatus = 'COMPLETE';
    if (groups.drinks.length) sectionState.DrinksStatus = 'COMPLETE';
    sectionState.CompletedAt = new Date().toISOString();
    payload.Sections = sectionState;
    try {
      if (isConfiguredUrl()) await api('kitchenUpdate', { KitchenID: id, Status: 'COMPLETE', PayloadJSON: JSON.stringify(payload) });
      else if (!canUseLocalTestMode()) throw new Error('Google Script URL is not configured.');
      k.Status = 'COMPLETE';
      k.PayloadJSON = JSON.stringify(payload);
      state.status.write = 'OK';
      state.status.message = isConfiguredUrl() ? 'Kitchen ticket updated in Google Sheets' : 'Kitchen ticket updated locally for testing only';
      saveLocal();
      saveServerCache();
      state.kitchenRecentlyCompleted[id] = true;
      render();
      setTimeout(function () {
        delete state.kitchenRecentlyCompleted[id];
        if (state.activeTab === 'Kitchen') render();
      }, 3000);
    } catch (err) {
      state.status.mode = 'error';
      state.status.write = 'failed';
      state.status.message = 'Kitchen update failed: ' + err.message;
      renderStatus();
      toast('Kitchen update failed. Ticket remains open.');
    }
  }

  function renderAdmin() {
    var totalItems = (state.data.menuItems || []).length;
    var activeItems = (state.data.menuItems || []).filter(function (i) { return Core.active(i.Active); }).length;
    var totalCats = (state.data.categories || []).length;
    var totalPrompts = (state.data.prompts || []).length;
    $('main').innerHTML = '<section class="panel admin-page"><div class="admin-hero"><div><h2>Menu admin</h2><p class="help">Edit items, categories and item configuration from one cleaner screen. Saves still require Google Sheets confirmation.</p></div><div class="admin-summary"><div><strong>' + activeItems + '</strong><span>active items</span></div><div><strong>' + totalItems + '</strong><span>total items</span></div><div><strong>' + totalCats + '</strong><span>categories</span></div><div><strong>' + totalPrompts + '</strong><span>prompts</span></div></div></div>' +
      '<div class="admin-tabs"><button class="pill-btn' + (state.adminMode === 'items' ? ' active' : '') + '" data-action="admin-mode" data-mode="items">Menu items</button><button class="pill-btn' + (state.adminMode === 'categories' ? ' active' : '') + '" data-action="admin-mode" data-mode="categories">Categories</button><button class="pill-btn' + (state.adminMode === 'deleted' ? ' active' : '') + '" data-action="admin-mode" data-mode="deleted">Deleted items</button><button class="secondary" data-action="refresh">Refresh from server</button></div>' +
      (state.adminMode === 'categories' ? renderCategoryLoader() : state.adminMode === 'deleted' ? renderDeletedItemsAdmin() : renderItemLoader()) + '</section>';
  }

  function renderItemLoader() {
    var cats = categories();
    var items = (state.data.menuItems || []).slice().filter(function (i) {
      var matchesCategory = !state.adminFilterCategoryId || i.CategoryID === state.adminFilterCategoryId;
      var search = state.adminSearch.toLowerCase();
      var matchesSearch = !search || String(i.ItemName || '').toLowerCase().includes(search) || String(i.Description || '').toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    }).sort(function (a, b) { return String(categoryName(a.CategoryID)).localeCompare(categoryName(b.CategoryID)) || bySort(a, b); });
    if (!state.selectedItemId && items[0]) state.selectedItemId = items[0].ItemID;
    var selected = (state.data.menuItems || []).find(function (i) { return i.ItemID === state.selectedItemId; }) || null;
    return '<div class="admin-layout"><aside class="list-panel admin-sidebar"><div class="admin-sidebar-title"><strong>Find item</strong><button class="primary compact" data-action="new-item">+ New</button></div>' +
      '<select class="select" id="adminFilterCategory"><option value="">All categories</option>' + cats.map(function (c) { return '<option value="' + attr(c.CategoryID) + '"' + (state.adminFilterCategoryId === c.CategoryID ? ' selected' : '') + '>' + escapeHtml(c.CategoryName) + '</option>'; }).join('') + '</select>' +
      '<input class="input" id="adminSearch" placeholder="Search item name or description" value="' + attr(state.adminSearch) + '">' +
      '<div class="help">Showing ' + items.length + ' item' + (items.length === 1 ? '' : 's') + '</div>' +
      '<div class="admin-list-scroll">' + items.map(function (item) { var inactive = !Core.active(item.Active); return '<button class="list-btn' + (state.selectedItemId === item.ItemID ? ' active' : '') + (inactive ? ' inactive-admin-tile' : '') + '" data-action="select-admin-item" data-id="' + attr(item.ItemID) + '"><div class="not-active-sticker">NOT ACTIVE</div><div class="list-title">' + escapeHtml(item.ItemName) + '</div><div class="help">' + escapeHtml(categoryName(item.CategoryID) || 'No category') + ' • ' + Core.money(item.Price) + ' • ' + (Core.active(item.Active) ? 'Active' : 'Inactive') + '</div></button>'; }).join('') + '</div>' +
      '</aside><div class="admin-editor">' + (selected ? renderItemForm(selected) + renderItemConfiguration(selected) : '<div class="card empty-admin"><h3>Select or create an item</h3><p class="help">Choose an item from the left to edit its price, category and prompts.</p></div>') + '</div></div>';
  }

  function renderItemForm(item) {
    var cats = categories();
    var inactive = !Core.active(item.Active);
    return '<div class="card admin-card' + (inactive ? ' inactive-admin-panel' : '') + '"><div class="not-active-sticker">NOT ACTIVE</div><div class="section-title"><div><span class="step-badge">1</span><h3>Item details</h3></div><span class="badge ' + (Core.active(item.Active) ? 'ok' : 'danger') + '">' + (Core.active(item.Active) ? 'Active' : 'Inactive') + '</span></div><div class="form-grid clean-form">' +
      '<input type="hidden" id="itemId" value="' + attr(item.ItemID) + '">' +
      '<label><span>Item name</span><input class="input" id="itemName" placeholder="e.g. Bacon cob" value="' + attr(item.ItemName) + '"></label>' +
      '<label><span>Category</span><select class="select" id="itemCategory">' + cats.map(function (c) { return '<option value="' + attr(c.CategoryID) + '"' + (item.CategoryID === c.CategoryID ? ' selected' : '') + '>' + escapeHtml(c.CategoryName) + '</option>'; }).join('') + '</select></label>' +
      '<label><span>Price</span><input class="input" id="itemPrice" inputmode="decimal" placeholder="0.00" value="' + attr(item.Price) + '"></label>' +
      '<label><span>Sort order</span><input class="input" id="itemSort" inputmode="numeric" placeholder="Sort" value="' + attr(item.Sort) + '"></label>' +
      '<label class="span2"><span>Description</span><textarea class="textarea" id="itemDescription" placeholder="Optional description shown on the till button">' + escapeHtml(item.Description) + '</textarea></label>' +
      '<label class="switchline"><input type="checkbox" id="itemActive"' + (Core.active(item.Active) ? ' checked' : '') + '> Show on till</label>' +
      '<label class="switchline"><input type="checkbox" id="itemLoyalty"' + (Core.truthy(item.LoyaltyEligible) ? ' checked' : '') + '> Loyalty eligible</label>' +
      '<div class="row span2 admin-save-row"><button class="primary" data-action="save-item">Save item to Google Sheets</button><button class="danger" data-action="delete-item">Delete item</button></div>' +
    '</div></div>';
  }

  function renderPromptCopyOptions(targetItemId) {
    var itemsByCategory = {};
    categories().forEach(function (category) { itemsByCategory[category.CategoryID] = []; });
    (state.data.menuItems || []).filter(function (candidate) {
      return candidate.ItemID !== targetItemId && (state.data.prompts || []).some(function (p) { return p.TriggerItemID === candidate.ItemID; });
    }).sort(function (a, b) {
      return categoryName(a.CategoryID).localeCompare(categoryName(b.CategoryID)) || bySort(a, b);
    }).forEach(function (candidate) {
      if (!itemsByCategory[candidate.CategoryID]) itemsByCategory[candidate.CategoryID] = [];
      itemsByCategory[candidate.CategoryID].push(candidate);
    });
    return categories().map(function (category) {
      var items = itemsByCategory[category.CategoryID] || [];
      if (!items.length) return '';
      return '<optgroup label="' + attr(category.CategoryName) + '">' + items.map(function (candidate) {
        var count = (state.data.prompts || []).filter(function (p) { return p.TriggerItemID === candidate.ItemID; }).length;
        return '<option value="' + attr(candidate.ItemID) + '">' + escapeHtml(candidate.ItemName) + ' (' + count + ' prompt' + (count === 1 ? '' : 's') + ')</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }

  function renderItemConfiguration(item) {
    var prompts = (state.data.prompts || []).filter(function (p) { return p.TriggerItemID === item.ItemID; }).sort(bySort);
    var copyOptions = renderPromptCopyOptions(item.ItemID);
    return '<div class="card admin-card"><div class="section-title"><div><span class="step-badge">2</span><h3>Item configuration</h3></div><button class="secondary" data-action="add-prompt" data-id="' + attr(item.ItemID) + '">+ Add prompt</button></div>' +
      '<div class="help">Use prompts for add-ons, choices and upsells. Tick Qty on an option when staff should enter a quantity, such as 3 x sausage.</div>' +
      '<div class="prompt-copy-panel"><div><strong>Copy prompts from another menu item</strong><div class="help">Items are grouped by category. Existing prompts on this item are kept; copied prompts receive new IDs.</div></div><div class="prompt-copy-controls"><select class="select" id="copyPromptsSource"><option value="">Select an item…</option>' + copyOptions + '</select><button class="secondary" data-action="copy-prompts" data-id="' + attr(item.ItemID) + '"' + (copyOptions ? '' : ' disabled') + '>Copy prompts</button></div></div>' +
      (prompts.length ? prompts.map(renderPromptAdminCard).join('') : '<div class="empty-admin"><h3>No prompts yet</h3><p class="help">Add a prompt or copy prompts from another menu item.</p></div>') + '</div>';
  }

  function renderPromptAdminCard(prompt) {
    var options = (state.data.promptOptions || []).filter(function (o) { return o.PromptID === prompt.PromptID; }).sort(bySort);
    var inactive = !Core.active(prompt.Active);
    return '<div class="prompt-admin-card' + (inactive ? ' inactive-admin-panel' : '') + '"><div class="not-active-sticker">NOT ACTIVE</div><div class="prompt-card-title"><strong>Prompt</strong><span class="help">Question asked at the till</span></div><div class="form-grid clean-form">' +
      '<input type="hidden" data-prompt-field="PromptID" value="' + attr(prompt.PromptID) + '">' +
      '<input class="input" data-prompt-field="PromptTitle" aria-label="Prompt title" value="' + attr(prompt.PromptTitle) + '" placeholder="Prompt title">' +
      '<select class="select" data-prompt-field="PromptType"><option value="single"' + (prompt.PromptType === 'single' ? ' selected' : '') + '>Single choice</option><option value="multi"' + (prompt.PromptType === 'multi' ? ' selected' : '') + '>Multiple / quantity choice</option></select>' +
      '<input class="input" data-prompt-field="Sort" inputmode="numeric" value="' + attr(prompt.Sort) + '" placeholder="Sort">' +
      '<label class="switchline"><input type="checkbox" data-prompt-field="Required"' + (Core.truthy(prompt.Required) ? ' checked' : '') + '> Required</label>' +
      '<label class="switchline"><input type="checkbox" data-prompt-field="AllowNotes"' + (Core.truthy(prompt.AllowNotes) ? ' checked' : '') + '> Allow item note</label>' +
      '<label class="switchline"><input type="checkbox" data-prompt-field="Active"' + (Core.active(prompt.Active) ? ' checked' : '') + '> Active</label>' +
      '<div class="row"><button class="primary" data-action="save-prompt" data-id="' + attr(prompt.PromptID) + '">Save prompt</button><button class="danger" data-action="delete-prompt" data-id="' + attr(prompt.PromptID) + '">Delete prompt</button></div>' +
      '</div><h3>Options</h3>' +
      '<div>' + options.map(renderOptionAdminRow).join('') + '</div>' +
      '<button class="secondary" data-action="add-option" data-id="' + attr(prompt.PromptID) + '">+ Add option</button>' +
    '</div>';
  }

  function renderOptionAdminRow(option) {
    return '<div class="option-admin-row" data-option-admin-id="' + attr(option.OptionID) + '">' +
      '<input class="input" data-option-field="OptionText" value="' + attr(option.OptionText) + '" placeholder="Option text">' +
      '<input class="input" data-option-field="Price" inputmode="decimal" value="' + attr(option.Price) + '" placeholder="Price">' +
      '<input class="input" data-option-field="Sort" inputmode="numeric" value="' + attr(option.Sort) + '" placeholder="Sort">' +
      '<select class="select" data-option-field="Action"><option' + (option.Action === 'Modifier' ? ' selected' : '') + '>Modifier</option><option' + (option.Action === 'none' ? ' selected' : '') + '>none</option></select>' +
      '<label class="switchline"><input type="checkbox" data-option-field="AllowValue"' + (Core.truthy(option.AllowValue) ? ' checked' : '') + '> Qty</label>' +
      '<div class="row"><button class="secondary" data-action="save-option" data-id="' + attr(option.OptionID) + '">Save</button><button class="danger" data-action="delete-option" data-id="' + attr(option.OptionID) + '">Delete</button></div>' +
    '</div>';
  }

  function renderCategoryLoader() {
    var cats = (state.data.categories || []).slice().sort(bySort);
    if (!state.selectedCategoryId && cats[0]) state.selectedCategoryId = cats[0].CategoryID;
    var selected = (state.data.categories || []).find(function (c) { return c.CategoryID === state.selectedCategoryId; }) || null;
    return '<div class="admin-layout"><aside class="list-panel admin-sidebar"><div class="admin-sidebar-title"><strong>Categories</strong><button class="primary compact" data-action="new-category">+ New</button></div>' +
      '<div class="help">Categories control the till tabs. Tick Drink category to make the kitchen show those items under Drinks.</div>' +
      '<div class="admin-list-scroll">' + cats.map(function (c) { return '<button class="list-btn' + (state.selectedCategoryId === c.CategoryID ? ' active' : '') + '" data-action="select-admin-category" data-id="' + attr(c.CategoryID) + '"><div class="list-title">' + escapeHtml(c.CategoryName) + '</div><div class="help">Sort ' + escapeHtml(c.Sort) + ' • ' + (Core.active(c.Active) ? 'Active' : 'Inactive') + ' • ' + (Core.truthy(c.IsDrinkCategory) ? 'Drinks' : 'Food') + '</div></button>'; }).join('') + '</div>' +
      '</aside><div class="admin-editor">' + (selected ? renderCategoryForm(selected) : '<div class="card empty-admin"><h3>Select or create a category</h3><p class="help">Use clear names such as Hot Drinks, Cold Drinks, Breakfast, Cakes or Lunch.</p></div>') + '</div></div>';
  }

  function renderCategoryForm(c) {
    return '<div class="card admin-card"><div class="section-title"><div><span class="step-badge">1</span><h3>Category details</h3></div><span class="badge ' + (Core.active(c.Active) ? 'ok' : 'danger') + '">' + (Core.active(c.Active) ? 'Active' : 'Inactive') + '</span></div><div class="form-grid clean-form">' +
      '<input type="hidden" id="categoryId" value="' + attr(c.CategoryID) + '">' +
      '<label><span>Category name</span><input class="input" id="categoryName" placeholder="e.g. Hot Drinks" value="' + attr(c.CategoryName) + '"></label>' +
      '<label><span>Sort order</span><input class="input" id="categorySort" inputmode="numeric" placeholder="Sort" value="' + attr(c.Sort) + '"></label>' +
      '<label><span>Button colour</span><input class="input" id="categoryButtonColour" placeholder="Optional" value="' + attr(c.ButtonColour) + '"></label>' +
      '<label class="switchline"><input type="checkbox" id="categoryActive"' + (Core.active(c.Active) ? ' checked' : '') + '> Show on till</label>' +
      '<label class="switchline"><input type="checkbox" id="categoryIsDrink"' + (Core.truthy(c.IsDrinkCategory) ? ' checked' : '') + '> Drink category for kitchen</label>' +
      '<div class="help span2">Kitchen display no longer guesses from names. Tick this box for drink categories; unticked categories are treated as food.</div>' +
      '<div class="row span2 admin-save-row"><button class="primary" data-action="save-category">Save category to Google Sheets</button><button class="danger" data-action="delete-category">Deactivate category</button></div>' +
    '</div></div>';
  }

  async function saveItem() {
    var id = $('itemId').value || Core.uid('I');
    var catId = $('itemCategory').value;
    var item = {
      ItemID: id,
      CategoryID: catId,
      CategoryName: categoryName(catId),
      ItemName: $('itemName').value.trim(),
      Description: $('itemDescription').value.trim(),
      Price: Core.roundMoney(Core.toNumber($('itemPrice').value, 0)),
      Active: $('itemActive').checked,
      Sort: Core.toNumber($('itemSort').value, 0),
      LoyaltyEligible: $('itemLoyalty').checked
    };
    if (!item.ItemName) { toast('Item needs a name.'); return; }
    try {
      await saveServerEntity('saveItem', { item: item });
      upsertLocal('menuItems', 'ItemID', item);
      state.selectedItemId = id;
      saveLocal();
      saveServerCache();
      render();
      toast(isConfiguredUrl() ? 'Item saved to Google Sheets.' : 'Item saved locally for testing only.');
    } catch (err) {
      persistFailed('Item not saved', err);
    }
  }

  async function saveCategory() {
    var id = $('categoryId').value || Core.uid('C');
    var c = { CategoryID: id, CategoryName: $('categoryName').value.trim(), Sort: Core.toNumber($('categorySort').value, 0), Active: $('categoryActive').checked, ButtonColour: $('categoryButtonColour').value.trim(), IsDrinkCategory: $('categoryIsDrink').checked };
    if (!c.CategoryName) { toast('Category needs a name.'); return; }
    try {
      await saveServerEntity('saveCategory', { category: c });
      upsertLocal('categories', 'CategoryID', c);
      state.selectedCategoryId = id;
      saveLocal();
      saveServerCache();
      render();
      toast(isConfiguredUrl() ? 'Category saved to Google Sheets.' : 'Category saved locally for testing only.');
    } catch (err) {
      persistFailed('Category not saved', err);
    }
  }

  async function savePrompt(promptId) {
    var button = document.querySelector('.prompt-admin-card [data-action="save-prompt"][data-id="' + cssEscape(promptId) + '"]');
    if (!button) { toast('Cannot find this prompt on the page.'); return; }
    var card = button.closest('.prompt-admin-card');
    var prompt = { PromptID: promptId, TriggerItemID: state.selectedItemId };
    Array.prototype.slice.call(card.querySelectorAll('[data-prompt-field]')).forEach(function (input) {
      var key = input.getAttribute('data-prompt-field');
      if (key === 'PromptID') return;
      prompt[key] = input.type === 'checkbox' ? input.checked : input.value;
    });
    prompt.Sort = Core.toNumber(prompt.Sort, 0);
    try {
      await saveServerEntity('savePrompt', { prompt: prompt });
      upsertLocal('prompts', 'PromptID', prompt);
      saveLocal();
      saveServerCache();
      render();
      toast(isConfiguredUrl() ? 'Prompt saved to Google Sheets.' : 'Prompt saved locally for testing only.');
    } catch (err) {
      persistFailed('Prompt not saved', err);
    }
  }

  async function copyPromptsToItem(targetItemId) {
    var source = $('copyPromptsSource');
    var sourceItemId = source ? source.value : '';
    if (!sourceItemId) { toast('Select a menu item to copy prompts from.'); return; }
    if (sourceItemId === targetItemId) { toast('Choose a different menu item.'); return; }
    var sourceItem = (state.data.menuItems || []).find(function (i) { return i.ItemID === sourceItemId; });
    var targetItem = (state.data.menuItems || []).find(function (i) { return i.ItemID === targetItemId; });
    var sourcePrompts = (state.data.prompts || []).filter(function (p) { return p.TriggerItemID === sourceItemId; }).sort(bySort);
    if (!sourcePrompts.length) { toast('That item has no prompts to copy.'); return; }
    var label = sourceItem ? sourceItem.ItemName : 'selected item';
    if (!window.confirm('Copy ' + sourcePrompts.length + ' prompt' + (sourcePrompts.length === 1 ? '' : 's') + ' from "' + label + '" to "' + (targetItem ? targetItem.ItemName : 'this item') + '"? Existing prompts will be kept.')) return;
    try {
      state.status.write = 'saving';
      state.status.message = 'Copying prompts to Google Sheets…';
      renderStatus();
      var res = await saveServerEntity('copyItemPrompts', { sourceItemId: sourceItemId, targetItemId: targetItemId });
      if (res && res.prompts) res.prompts.forEach(function (p) { upsertLocal('prompts', 'PromptID', p); });
      if (res && res.options) res.options.forEach(function (o) { upsertLocal('promptOptions', 'OptionID', o); });
      saveLocal();
      saveServerCache();
      render();
      toast((res && res.promptCount ? res.promptCount : sourcePrompts.length) + ' prompt' + ((res && res.promptCount ? res.promptCount : sourcePrompts.length) === 1 ? '' : 's') + ' copied from ' + label + '.');
    } catch (err) {
      persistFailed('Prompts not copied', err);
    }
  }

  async function saveOption(optionId) {
    var row = document.querySelector('[data-option-admin-id="' + cssEscape(optionId) + '"]');
    if (!row) { toast('Cannot find this option on the page.'); return; }
    var existing = (state.data.promptOptions || []).find(function (o) { return o.OptionID === optionId; });
    var option = Object.assign({}, existing || { OptionID: optionId });
    Array.prototype.slice.call(row.querySelectorAll('[data-option-field]')).forEach(function (input) {
      var key = input.getAttribute('data-option-field');
      option[key] = input.type === 'checkbox' ? input.checked : input.value;
    });
    option.Price = Core.roundMoney(Core.toNumber(option.Price, 0));
    option.Sort = Core.toNumber(option.Sort, 0);
    option.Active = true;
    try {
      await saveServerEntity('savePromptOption', { option: option });
      upsertLocal('promptOptions', 'OptionID', option);
      saveLocal();
      saveServerCache();
      render();
      toast(isConfiguredUrl() ? 'Option saved to Google Sheets.' : 'Option saved locally for testing only.');
    } catch (err) {
      persistFailed('Option not saved', err);
    }
  }

  function cssEscape(id) { return String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
  function upsertLocal(listName, idField, object) {
    state.data[listName] = state.data[listName] || [];
    var idx = state.data[listName].findIndex(function (x) { return x[idField] === object[idField]; });
    if (idx >= 0) state.data[listName][idx] = Object.assign({}, state.data[listName][idx], object);
    else state.data[listName].push(object);
  }

  async function saveServerEntity(action, payload) {
    if (isConfiguredUrl()) {
      state.status.write = 'saving';
      state.status.message = 'Saving to Google Sheets…';
      renderStatus();
      var res = await api(action, payload);
      state.status.write = 'OK';
      state.status.read = 'OK';
      state.status.message = 'Saved to Google Sheets';
      renderStatus();
      return res;
    }
    if (canUseLocalTestMode()) {
      state.status.write = 'local test only';
      state.status.message = 'Saved locally for testing only';
      renderStatus();
      return { ok: true, local: true };
    }
    throw new Error('Google Script URL is not configured. Strict persistence is blocking this save.');
  }

  function persistFailed(prefix, err) {
    state.status.mode = 'error';
    state.status.write = 'failed';
    state.status.message = prefix + ': ' + err.message;
    renderStatus();
    toast(prefix + '. Nothing was marked as saved.');
  }

  async function deactivateEntity(listName, idField, id, action, payloadKey) {
    var entity = (state.data[listName] || []).find(function (x) { return x[idField] === id; });
    if (!entity) return;
    var updated = Object.assign({}, entity, { Active: false });
    var payload = {};
    payload[payloadKey] = updated;
    try {
      await saveServerEntity(action, payload);
      upsertLocal(listName, idField, updated);
      saveLocal();
      saveServerCache();
      render();
      toast('Deactivated and saved to Google Sheets.');
    } catch (err) {
      persistFailed('Deactivate not saved', err);
    }
  }

  function renderSettings() {
    var repair = state.lastDatabaseRepair || {};
    var changes = repair.changes || [];
    var schemaOk = repair.status && repair.status.ok;
    var savedUrl = confirmedUrlInfo();
    var savedUrlText = savedUrl.url || 'No confirmed URL saved in database yet';
    var savedVersionText = savedUrl.version || 'Test / reload from server to confirm and save this device URL';
    var repairHtml = changes.length
      ? '<ul class="help-list">' + changes.slice(0, 8).map(function (x) { return '<li>' + escapeHtml(x) + '</li>'; }).join('') + (changes.length > 8 ? '<li>+' + (changes.length - 8) + ' more change(s)</li>' : '') + '</ul>'
      : '<p class="help">No repair changes have been needed on this device since the last server reload.</p>';
    $('main').innerHTML = '<section class="panel"><h2>Settings</h2><div class="form-grid">' +
      '<input class="input span2" id="scriptUrl" placeholder="Google Apps Script Web App URL ending /exec" value="' + attr(getScriptUrl()) + '">' +
      '<button class="primary" data-action="save-settings">Save script URL</button><button class="secondary" data-action="refresh">Test / reload from server</button>' +
      '</div><h3>Shared confirmed URL</h3><div class="card confirmed-url-card"><div class="url-version-label">' + escapeHtml(savedVersionText) + '</div><label><span>Last confirmed good URL saved in database</span><input class="input" id="confirmedScriptUrl" readonly value="' + attr(savedUrlText) + '"></label><div class="help">This is saved to Google Sheets only after the URL has been tested successfully. Other connected devices can copy it from here.</div><div class="row"><button class="secondary" data-action="copy-confirmed-url">Copy saved URL</button><button class="primary" data-action="save-confirmed-url">Save current confirmed URL now</button></div><div class="help">Last saved: ' + escapeHtml(formatDate(savedUrl.savedAt) || 'Not saved yet') + '</div></div>' +
      '<h3>Connection</h3><div class="cards"><div class="card"><h3>Server ready</h3><div class="item-price">' + (state.serverReady ? 'YES' : 'NO') + '</div></div><div class="card"><h3>Spreadsheet</h3><div>' + escapeHtml(state.status.spreadsheetName || 'Not confirmed') + '</div></div><div class="card"><h3>Strict persistence</h3><div class="item-price">' + (strictPersistence() ? 'ON' : 'OFF') + '</div></div></div>' +
      '<h3>Database maintenance</h3><div class="cards"><div class="card"><h3>Schema status</h3><div class="item-price">' + (schemaOk ? 'OK' : 'Check') + '</div><p class="help">The app can add missing sheets/columns and update version metadata without deleting your menu or sales rows.</p></div><div class="card span2"><h3>Last repair/update</h3>' + repairHtml + '</div></div>' +
      '<div class="row"><button class="primary" data-action="repair-database">Repair / update spreadsheet</button><button class="secondary" data-action="refresh">Reload after repair</button></div>' +
      '<h3>Staff discount</h3><div class="form-grid"><label><span>Staff discount percentage</span><input class="input" id="staffDiscountPercent" inputmode="decimal" value="' + attr(staffDiscountPercent()) + '" placeholder="e.g. 10"></label><button class="primary" data-action="save-staff-discount">Save staff discount</button><div class="help span2">This percentage is used by the Staff Discount button on the till. The discount is taken off before cash/change is calculated and is reported under Discount given.</div></div>' +
      '<h3>Version lock</h3><div class="cards"><div class="card"><h3>Frontend</h3><div class="item-price">' + escapeHtml(CONFIG.frontendVersion || 'unknown') + '</div></div><div class="card"><h3>Expected Backend</h3><div class="item-price">' + escapeHtml(CONFIG.backendVersion || '1.0.8') + '</div></div><div class="card"><h3>Expected Database</h3><div class="item-price">' + escapeHtml(CONFIG.databaseVersion || 'unknown') + '</div></div></div>' +
      '<h3>Safety</h3><p class="help">Payments, refunds, held orders, kitchen updates and admin changes only become saved after Google Sheets confirms them. Browser storage is used only for the unfinished basket and a downloadable backup/debug copy.</p>' +
      '<div class="row"><button class="secondary" data-action="download-backup">Download local backup JSON</button><button class="danger" data-action="clear-local-data">Clear local draft/cache</button></div></section>';
  }

  async function saveStaffDiscountSetting() {
    var input = $('staffDiscountPercent');
    var percent = Core.clampPercent(input ? input.value : 0);
    try {
      await saveServerEntity('saveSetting', { key: 'StaffDiscountPercent', value: String(percent) });
      state.data.settings = state.data.settings || {};
      state.data.settings.StaffDiscountPercent = percent;
      if (!percent) state.ticketMeta.StaffDiscountApplied = false;
      saveLocal();
      saveServerCache();
      render();
      toast('Staff discount saved at ' + percent + '%.');
    } catch (err) {
      persistFailed('Staff discount setting not saved', err);
    }
  }

  function confirmedUrlInfo() {
    var settings = state.data.settings || {};
    return {
      url: settings.LastConfirmedScriptUrl || '',
      version: settings.LastConfirmedUrlVersion || '',
      savedAt: settings.LastConfirmedUrlSavedAt || '',
      backendVersion: settings.LastConfirmedUrlBackendVersion || '',
      databaseVersion: settings.LastConfirmedUrlDatabaseVersion || '',
      frontendVersion: settings.LastConfirmedUrlFrontendVersion || ''
    };
  }

  function currentConfirmedUrlVersionLabel(versions) {
    versions = versions || state.status || {};
    return 'Frontend ' + (CONFIG.frontendVersion || 'unknown') + ' / Backend ' + (versions.BackendVersion || versions.backendVersion || '') + ' / Database ' + (versions.DatabaseVersion || versions.databaseVersion || '');
  }

  async function saveConfirmedUrlAfterGoodConnection(versions) {
    if (!isConfiguredUrl() || !state.serverReady) return;
    var url = getScriptUrl();
    var label = currentConfirmedUrlVersionLabel(versions || state.status);
    var info = confirmedUrlInfo();
    if (info.url === url && info.version === label) return;
    try {
      var res = await api('saveConfirmedUrl', {
        url: url,
        version: label,
        frontendVersion: CONFIG.frontendVersion || 'unknown',
        backendVersion: (versions || {}).BackendVersion || state.status.backendVersion || '',
        databaseVersion: (versions || {}).DatabaseVersion || state.status.databaseVersion || ''
      });
      state.data.settings = Object.assign({}, state.data.settings || {}, res.settings || {});
      saveServerCache();
      if (state.activeTab === 'Settings') render();
    } catch (err) {
      console.warn('Confirmed URL was not saved to database', err);
    }
  }

  async function saveConfirmedUrlManually() {
    if (!state.serverReady || !isConfiguredUrl()) { toast('Test / reload from server first so the URL is confirmed as good.'); return; }
    state.status.write = 'saving confirmed URL';
    state.status.message = 'Saving confirmed URL to Google Sheets…';
    renderStatus();
    try {
      var res = await api('saveConfirmedUrl', {
        url: getScriptUrl(),
        version: currentConfirmedUrlVersionLabel(state.status),
        frontendVersion: CONFIG.frontendVersion || 'unknown',
        backendVersion: state.status.backendVersion || '',
        databaseVersion: state.status.databaseVersion || ''
      });
      state.data.settings = Object.assign({}, state.data.settings || {}, res.settings || {});
      state.status.write = 'OK';
      state.status.message = 'Confirmed URL saved to Google Sheets';
      saveServerCache();
      render();
      toast('Confirmed URL saved. Other connected devices can copy it from Settings.');
    } catch (err) {
      persistFailed('Confirmed URL not saved', err);
    }
  }

  function copyTextToClipboard(text) {
    text = String(text || '');
    if (!text) { toast('No URL available to copy.'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('URL copied.'); }).catch(function () { fallbackCopyText(text); });
      return;
    }
    fallbackCopyText(text);
  }

  function fallbackCopyText(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); toast('URL copied.'); }
    catch (err) { toast('Could not copy automatically. Highlight the URL and copy it manually.'); }
    area.remove();
  }

  function renderDeletedItemsAdmin() {
    var rows = (state.data.deletedItems || []).slice().sort(function (a, b) { return String(b.DeletedAt || '').localeCompare(String(a.DeletedAt || '')); });
    return '<div class="admin-layout"><aside class="list-panel admin-sidebar"><div class="admin-sidebar-title"><strong>Deleted items</strong></div><div class="help">Rows moved here are archived in the Google Sheet tab called DeletedItems and are no longer used by the till/admin menus.</div></aside>' +
      '<div class="admin-editor"><div class="card admin-card"><div class="section-title"><div><span class="step-badge">3</span><h3>Archive log</h3></div><span class="badge danger">' + rows.length + ' deleted</span></div>' +
      (rows.length ? rows.map(function (r) {
        return '<div class="deleted-admin-row"><div><strong>' + escapeHtml(r.Name || r.EntityID || 'Deleted row') + '</strong><div class="help">' + escapeHtml(r.EntityType || '') + ' • ' + escapeHtml(r.EntityID || '') + ' • ' + escapeHtml(formatDate(r.DeletedAt) || '') + '</div></div><span class="badge danger">Archived</span></div>';
      }).join('') : '<div class="empty-admin"><h3>No deleted rows</h3><p class="help">Deleted menu items, prompts and options will appear here after the server confirms the archive-delete.</p></div>') +
      '</div></div></div>';
  }

  function localListForEntityType(entityType) {
    if (entityType === 'MenuItem') return { list: 'menuItems', idField: 'ItemID', sheet: 'MenuItems' };
    if (entityType === 'Prompt') return { list: 'prompts', idField: 'PromptID', sheet: 'Prompts' };
    if (entityType === 'PromptOption') return { list: 'promptOptions', idField: 'OptionID', sheet: 'PromptOptions' };
    return null;
  }

  function addDeletedRowsLocally(rows) {
    if (!rows || !rows.length) return;
    state.data.deletedItems = state.data.deletedItems || [];
    rows.forEach(function (row) {
      if (!state.data.deletedItems.some(function (existing) { return existing.DeletedID === row.DeletedID; })) state.data.deletedItems.push(row);
    });
  }

  function removeArchivedEntitiesLocally(deletedRecords) {
    deletedRecords = deletedRecords || [];
    deletedRecords.forEach(function (rec) {
      var sheet = rec.sheet || rec.EntityType;
      var id = rec.id || rec.EntityID;
      if (sheet === 'MenuItems') state.data.menuItems = (state.data.menuItems || []).filter(function (x) { return x.ItemID !== id; });
      if (sheet === 'Prompts') state.data.prompts = (state.data.prompts || []).filter(function (x) { return x.PromptID !== id; });
      if (sheet === 'PromptOptions') state.data.promptOptions = (state.data.promptOptions || []).filter(function (x) { return x.OptionID !== id; });
    });
    if (state.selectedItemId && !(state.data.menuItems || []).some(function (x) { return x.ItemID === state.selectedItemId; })) state.selectedItemId = '';
  }

  async function archiveDeleteEntity(entityType, id) {
    var spec = localListForEntityType(entityType);
    if (!spec || !id) return;
    var entity = (state.data[spec.list] || []).find(function (x) { return x[spec.idField] === id; });
    var label = entity ? (entity.ItemName || entity.PromptTitle || entity.OptionText || id) : id;
    var cascade = entityType === 'MenuItem' ? ' This will also archive/delete its prompts and options.' : entityType === 'Prompt' ? ' This will also archive/delete its options.' : '';
    if (!window.confirm('Are you sure you want to delete "' + label + '"? It will be moved to the DeletedItems sheet and removed from the active database/UI.' + cascade)) return;
    try {
      var result = await saveServerEntity('archiveDeleteEntity', { entityType: entityType, id: id, deletedBy: state.ticketMeta.ServerName || '' });
      addDeletedRowsLocally((result || {}).deletedItems || []);
      removeArchivedEntitiesLocally((result || {}).deletedRecords || []);
      saveLocal();
      saveServerCache();
      render();
      toast('Deleted and archived in the DeletedItems sheet.');
    } catch (err) {
      persistFailed('Delete not saved', err);
    }
  }

  function formatDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  async function runDatabaseRepair() {
    if (!isConfiguredUrl()) {
      toast('Add the Google Script URL first.');
      return;
    }
    state.status.write = 'repairing';
    state.status.message = 'Repairing/updating spreadsheet schema…';
    renderStatus();
    try {
      var res = await api('repairDatabase');
      state.lastDatabaseRepair = res.schema || null;
      if (res.data) state.data = normaliseData(res.data || {});
      var versions = res.versions || {};
      var mode = versionMode(versions);
      state.status = {
        mode: mode,
        read: 'OK',
        write: mode === 'error' ? 'blocked' : 'ready',
        backendVersion: versions.BackendVersion || '',
        databaseVersion: versions.DatabaseVersion || '',
        spreadsheetName: versions.SpreadsheetName || '',
        spreadsheetId: versions.SpreadsheetID || '',
        schemaChanges: ((res.schema || {}).changes || []).length,
        message: mode === 'error' ? 'Version mismatch after database repair' : 'Database repair/update complete'
      };
      state.serverReady = state.status.mode !== 'error';
      ensureActiveCategory();
      saveLocal();
      saveServerCache();
      render();
      toast('Database repair complete. Changes made: ' + (((res.schema || {}).changes || []).length));
    } catch (err) {
      state.status.mode = 'error';
      state.status.write = 'failed';
      state.status.message = 'Database repair failed: ' + err.message;
      renderStatus();
      toast('Database repair failed. Existing rows were not cleared.');
    }
  }

  async function refresh() { await bootstrap(); toast(state.serverReady ? 'Server refresh complete.' : 'Server refresh failed or is not configured.'); }

  document.addEventListener('click', function (event) {
    var tabBtn = event.target.closest('[data-tab]');
    if (tabBtn) {
      state.activeTab = tabBtn.getAttribute('data-tab');
      render();
      updateKitchenPolling();
      return;
    }
    var modalBtn = event.target.closest('[data-modal-action]');
    if (modalBtn) {
      var ma = modalBtn.getAttribute('data-modal-action');
      if (ma === 'close') closeModal();
      if (ma === 'add-configured') addConfiguredItem(modalBtn.getAttribute('data-item-id'));
      if (ma === 'confirm-payment') confirmPaymentFromPrompt(modalBtn.getAttribute('data-method'));
      if (ma === 'report-code-digit') editReportClearPasscode('digit', modalBtn.getAttribute('data-digit'));
      if (ma === 'report-code-delete') editReportClearPasscode('delete');
      if (ma === 'report-code-clear') editReportClearPasscode('clear');
      if (ma === 'report-code-submit') submitClearReportsPasscode();
      if (ma === 'option-plus' || ma === 'option-minus') {
        var input = document.querySelector('[data-option-qty="' + cssEscape(modalBtn.getAttribute('data-option-id')) + '"]');
        if (input) {
          var next = Core.toNumber(input.value, 0) + (ma === 'option-plus' ? 1 : -1);
          input.value = Math.max(0, next);
          var card = input.closest('.option-card');
          var radio = card.querySelector('input[type="radio"],input[type="checkbox"]');
          if (radio && next > 0) radio.checked = true;
        }
      }
      return;
    }
    var btn = event.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var id = btn.getAttribute('data-id');
    if (action === 'set-category') { state.activeCategoryId = id; render(); }
    if (action === 'add-item') openItemModal(id);
    if (action === 'line-minus') { var i = +btn.getAttribute('data-index'); Core.setLineQuantity(state.cart[i], Core.toNumber(state.cart[i].Quantity, 1) - 1); state.pendingPaymentRequestId = ''; saveLocal(); render(); }
    if (action === 'line-plus') { var ip = +btn.getAttribute('data-index'); Core.setLineQuantity(state.cart[ip], Core.toNumber(state.cart[ip].Quantity, 1) + 1); state.pendingPaymentRequestId = ''; saveLocal(); render(); }
    if (action === 'remove-line') { state.cart.splice(+btn.getAttribute('data-index'), 1); state.pendingPaymentRequestId = ''; saveLocal(); render(); }
    if (action === 'clear-cart') { state.cart = []; state.pendingPaymentRequestId = ''; state.ticketMeta.CashPaid = ''; state.ticketMeta.StaffDiscountApplied = false; saveLocal(); render(); }
    if (action === 'toggle-staff-discount') { state.ticketMeta.StaffDiscountApplied = !(staffDiscountApplied() && staffDiscountPercent() > 0); state.pendingPaymentRequestId = ''; saveLocal(); render(); }
    if (action === 'toggle-loyalty') { var loyaltyResult = applyLoyaltyToBestEligibleLine(); state.pendingPaymentRequestId = ''; saveLocal(); render(); toast(loyaltyResult.message); }
    if (action === 'pay-cash') takePayment('Cash');
    if (action === 'pay-card') takePayment('Card');
    if (action === 'hold-current') holdCurrent();
    if (action === 'recall-held') recallHeld(id);
    if (action === 'delete-held') deleteHeld(id);
    if (action === 'refresh') refresh();
    if (action === 'report-today') { state.reportFrom = todayDateString(new Date()); state.reportTo = state.reportFrom; render(); }
    if (action === 'export-reports') exportReports();
    if (action === 'clear-reports') openClearReportsKeypad();
    if (action === 'view-ticket') viewTicket(id);
    if (action === 'save-refund') saveRefund();
    if (action === 'complete-kitchen') completeKitchen(id);
    if (action === 'complete-kitchen-section') updateKitchenSection(id, btn.getAttribute('data-section'), 'COMPLETE');
    if (action === 'reopen-kitchen-section') updateKitchenSection(id, btn.getAttribute('data-section'), 'OPEN');
    if (action === 'admin-mode') { state.adminMode = btn.getAttribute('data-mode'); render(); }
    if (action === 'select-admin-item') { state.selectedItemId = id; render(); }
    if (action === 'select-admin-category') { state.selectedCategoryId = id; render(); }
    if (action === 'new-item') { var newCatId = state.adminFilterCategoryId || (categories()[0] || {}).CategoryID || ''; var newItem = { ItemID: Core.uid('I'), CategoryID: newCatId, CategoryName: categoryName(newCatId), ItemName: 'New item', Description: '', Price: 0, Active: true, Sort: 999, LoyaltyEligible: false }; upsertLocal('menuItems', 'ItemID', newItem); state.selectedItemId = newItem.ItemID; render(); }
    if (action === 'new-category') { var newCat = { CategoryID: Core.uid('C'), CategoryName: 'New category', Sort: 999, Active: true, ButtonColour: '', IsDrinkCategory: false }; upsertLocal('categories', 'CategoryID', newCat); state.selectedCategoryId = newCat.CategoryID; render(); }
    if (action === 'save-item') saveItem();
    if (action === 'delete-item') archiveDeleteEntity('MenuItem', state.selectedItemId);
    if (action === 'save-category') saveCategory();
    if (action === 'delete-category') deactivateEntity('categories', 'CategoryID', state.selectedCategoryId, 'saveCategory', 'category');
    if (action === 'add-prompt') { var p = { PromptID: Core.uid('P'), TriggerItemID: id, PromptTitle: 'New prompt', PromptType: 'single', Required: false, Sort: 999, Active: true, AllowNotes: false }; upsertLocal('prompts', 'PromptID', p); render(); }
    if (action === 'copy-prompts') copyPromptsToItem(id);
    if (action === 'save-prompt') savePrompt(id);
    if (action === 'delete-prompt') archiveDeleteEntity('Prompt', id);
    if (action === 'add-option') { var o = { OptionID: Core.uid('O'), PromptID: id, OptionText: 'New option', Action: 'Modifier', Value: '', Price: 0, Sort: 999, Active: true, AllowValue: false }; upsertLocal('promptOptions', 'OptionID', o); render(); }
    if (action === 'save-option') saveOption(id);
    if (action === 'delete-option') archiveDeleteEntity('PromptOption', id);
    if (action === 'save-settings') { setScriptUrl($('scriptUrl').value); toast('Script URL saved.'); bootstrap(); }
    if (action === 'save-staff-discount') saveStaffDiscountSetting();
    if (action === 'copy-confirmed-url') copyTextToClipboard((confirmedUrlInfo().url || getScriptUrl()));
    if (action === 'save-confirmed-url') saveConfirmedUrlManually();
    if (action === 'repair-database') runDatabaseRepair();
    if (action === 'download-backup') downloadBackup();
    if (action === 'clear-local-data') { clearLocalData(); state.cart = []; state.pendingPaymentRequestId = ''; state.ticketMeta.CashPaid = ''; state.ticketMeta.StaffDiscountApplied = false; toast('Local draft/cache cleared.'); bootstrap(); }
  });

  document.addEventListener('input', function (event) {
    var field = event.target.getAttribute('data-field');
    if (field) {
      state.ticketMeta[field] = event.target.value;
      if (field === 'CashPaid') state.pendingPaymentRequestId = '';
      saveLocal();
      if (field === 'CashPaid') updateCashChangeDisplay();
    }
    if (event.target.getAttribute('data-action') === 'line-qty') {
      var idx = +event.target.getAttribute('data-index');
      if (state.cart[idx]) { Core.setLineQuantity(state.cart[idx], event.target.value); state.pendingPaymentRequestId = ''; saveLocal(); render(); }
    }
    if (event.target.id === 'adminFilterCategory') { state.adminFilterCategoryId = event.target.value; state.selectedItemId = ''; render(); }
    if (event.target.id === 'adminSearch') { state.adminSearch = event.target.value; render(); }
    if (event.target.id === 'reportFrom') { state.reportFrom = event.target.value; renderReports(); }
    if (event.target.id === 'reportTo') { state.reportTo = event.target.value; renderReports(); }
  });

  function downloadBackup() {
    var blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: state.data }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nook-epos-backup-' + (CONFIG.frontendVersion || 'unknown') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') runSyncCoordinator();
  });
  window.addEventListener('beforeunload', stopSyncCoordinator);

  bootstrap();
})();

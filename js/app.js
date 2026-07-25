(function () {
  'use strict';

  var Core = window.NookCore;
  var Foundation = window.NookFoundation;
  var Models = window.NookModels;
  var Presentation = window.NookPresentation;
  var Operations = window.NookOperations;
  var AdminSave = window.NookAdminSave;
  var RELEASE = window.NOOK_RELEASE || {};
  var CONFIG = window.NOOK_CONFIG || {};
  if (!Foundation || !Models || !Presentation || !Operations || !AdminSave) throw new Error('Shared ePOS modules must load before app.js');
  var Ui = Foundation.createUi({ modalRootId: 'modalRoot' });
  var CACHE_KEY = 'nook_epos_browser_server_cache';
  var DRAFT_KEY = 'nook_epos_browser_draft';
  var CONFIG_KEY = 'nook_epos_browser_config';
  var LEGACY_CONFIG_KEYS = ['nook_epos_browser_1_0_5_config', 'nook_epos_browser_1_0_4_config', 'nook_epos_browser_1_0_3_config', 'nook_epos_browser_1_0_2_config'];
  var LEGACY_DRAFT_KEYS = ['nook_epos_browser_1_0_5_draft', 'nook_epos_browser_1_0_4_draft', 'nook_epos_browser_1_0_3_draft', 'nook_epos_browser_1_0_2_draft'];
  var NAV_GROUPS = [
    { label: 'Sales', className: 'sales', tabs: [
      { route: 'Till', label: 'Till' },
      { route: 'Held', label: 'Held Orders' },
      { route: 'Live Tickets', label: 'Ticket History' },
      { route: 'Refunds', label: 'Refunds' },
      { route: 'Reports', label: 'Reports' }
    ] },
    { label: 'Administration', className: 'administration', tabs: [
      { route: 'Kitchen', label: 'Kitchen Ticket Display' },
      { route: 'Admin', label: 'Menu Admin' },
      { route: 'Settings', label: 'Settings' }
    ] }
  ];
  var KITCHEN_POLL_INTERVAL_MS = RELEASE.kitchenPollIntervalMs || 3000;
  var MENU_POLL_INTERVAL_MS = RELEASE.menuPollIntervalMs || 5000;
  var SYNC_TICK_INTERVAL_MS = RELEASE.syncTickIntervalMs || 1000;
  var kitchenPollInFlight = false;
  var menuPollInFlight = false;
  var ticketHistoryPollInFlight = false;
  var lastMenuSignature = '';
  var syncCoordinator = Operations.createPollCoordinator({
    tickIntervalMs: SYNC_TICK_INTERVAL_MS,
    jobs: [
      { name: 'kitchen', intervalMs: KITCHEN_POLL_INTERVAL_MS, enabled: function () { return state.serverReady && isConfiguredUrl() && document.visibilityState !== 'hidden' && kitchenDisplayEnabled() && state.activeTab === 'Kitchen'; }, run: function () { return syncKitchenQueue({ silent: true }); } },
      { name: 'menu', intervalMs: MENU_POLL_INTERVAL_MS, enabled: function () { return state.serverReady && isConfiguredUrl() && document.visibilityState !== 'hidden'; }, run: syncMenuData },
      { name: 'ticket-history', intervalMs: 4000, enabled: function () { return state.serverReady && isConfiguredUrl() && document.visibilityState !== 'hidden' && state.activeTab === 'Live Tickets'; }, run: syncTicketHistoryData }
    ],
    onError: function (name, error) { console.warn(name + ' synchronisation retrying', error); }
  });

  var state = {
    activeTab: 'Till',
    activeCategoryId: '',
    adminMode: 'items',
    selectedItemId: '',
    selectedCategoryId: '',
    adminFilterCategoryId: '',
    adminSearch: '',
    dirtyPromptOptions: {},
    adminDirty: { item: {}, category: {}, prompt: {} },
    adminItemBaseline: null,
    adminItemBaselineId: '',
    promptOptionOriginals: {},
    reportFrom: todayDateString(new Date()),
    reportTo: todayDateString(new Date()),
    historyDate: todayDateString(new Date()),
    focusedRefresh: { reports: { inFlight: false, updatedAt: '', error: '' }, history: { inFlight: false, updatedAt: '', error: '' } },
    diagnostics: { running: false, updatedAt: '', error: '', results: null },
    databaseRepairPreview: null,
    kitchenRecentlyCompleted: {},
    kitchenPendingUpdates: {},
    kitchenSeenTickets: {},
    kitchenSeenInitialised: false,
    kitchenArrivalUntil: {},
    lastDatabaseRepair: null,
    paymentInProgress: false,
    pendingOrderTypeItemId: '',
    orderTypeSelectedForEmptyOrder: false,
    awaitingPostPaymentOrderType: false,
    data: Core.clone(window.NOOK_SEED || {}),
    cart: [],
    pendingPaymentRequestId: '',
    tillFeedback: { pendingLineIndex: -1, token: 0 },
    ticketMeta: { OrderType: '', ServerName: '', TableNumber: '', CustomerName: '', CashPaid: '' },
    serverReady: false,
    status: { mode: 'starting', read: 'waiting', write: 'waiting', backendVersion: '', databaseVersion: '', spreadsheetName: '', spreadsheetId: '', message: 'Starting…' }
  };

  function $(id) { return document.getElementById(id); }
  var uiVersionEl = $('uiVersion');
  if (uiVersionEl) uiVersionEl.textContent = CONFIG.frontendVersion || 'unknown';
  var escapeHtml = Presentation.escapeHtml;
  var attr = Presentation.attr;
  function bySort(a, b) { return Presentation.bySort(Core, a, b); }
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

  function emptyData() { return Models.emptyData(); }

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
  function toast(message, type) { Ui.toast(message, type || 'info'); }
  function themedConfirm(config) { return Ui.confirm(config || {}); }

  function themedUnsavedChoice(config) {
    config = config || {};
    return new Promise(function (resolve) {
      var root = $('modalRoot');
      if (!root) { resolve('stay'); return; }
      root.innerHTML = '<div class="modal-backdrop"><div class="modal unsaved-choice-modal"><h2>' + escapeHtml(config.title || 'Unsaved changes') + '</h2><p>' + escapeHtml(config.message || 'You have changes that have not been saved.') + '</p><div class="row unsaved-choice-actions"><button class="secondary" data-unsaved-choice="stay">Stay here</button><button class="danger" data-unsaved-choice="discard">Discard changes</button><button class="primary" data-unsaved-choice="save">Save changes</button></div></div></div>';
      Array.prototype.slice.call(root.querySelectorAll('[data-unsaved-choice]')).forEach(function (button) {
        button.addEventListener('click', function () { var choice = button.getAttribute('data-unsaved-choice'); root.innerHTML = ''; resolve(choice); }, { once: true });
      });
    });
  }

  var ApiClient = Foundation.createApiClient({
    getUrl: getScriptUrl,
    frontendVersion: CONFIG.frontendVersion || 'unknown'
  });

  async function api(action, payload) {
    return ApiClient.request(action, payload);
  }

  async function bootstrap(options) {
    options = options || {};
    var preserveData = !!options.preserveData && state.serverReady;
    var previousData = state.data;
    var previousServerReady = state.serverReady;
    if (!preserveData) {
      state.serverReady = false;
      state.data = canUseLocalTestMode() ? Core.clone(window.NOOK_SEED || {}) : emptyData();
      loadLocal();
      ensureActiveCategory();
      render();
    }

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
      if (preserveData && previousServerReady) {
        state.serverReady = true;
        state.data = previousData;
        state.status.mode = 'warn';
        state.status.read = 'refresh failed';
        state.status.write = 'ready';
        state.status.message = 'Refresh failed — continuing with the last confirmed data: ' + err.message;
        renderStatus();
      } else {
        state.serverReady = false;
        state.data = emptyData();
        state.status = { mode: 'error', read: 'failed', write: 'blocked', backendVersion: '', databaseVersion: '', spreadsheetName: '', spreadsheetId: '', message: 'Server read failed: ' + err.message };
        stopSyncCoordinator();
        render();
      }
    }
  }


  function kitchenQueueSignature(queue) {
    return (queue || []).map(function (k) {
      return [k.KitchenID || '', k.Status || '', k.PayloadJSON || '', k.CreatedAt || ''].join('|');
    }).join('~');
  }

  async function syncKitchenQueue(options) {
    options = options || {};
    if (!kitchenDisplayEnabled() || kitchenPollInFlight || !isConfiguredUrl() || !state.serverReady) return;
    kitchenPollInFlight = true;
    try {
      var before = kitchenQueueSignature(state.data.kitchenQueue);
      var res = await api('kitchenSnapshot');
      var queue = res.data && Array.isArray(res.data.kitchenQueue) ? res.data.kitchenQueue : [];
      // Never let a polling response overwrite a ticket while its completion update is still pending.
      // The server response may have been generated immediately before the write acquired its lock.
      var currentById = {};
      (state.data.kitchenQueue || []).forEach(function (row) { currentById[row.KitchenID] = row; });
      queue = queue.map(function (row) {
        return state.kitchenPendingUpdates[row.KitchenID] && currentById[row.KitchenID] ? currentById[row.KitchenID] : row;
      });
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

  function runSyncCoordinator() { syncCoordinator.tick(); }

  function startSyncCoordinator() {
    syncCoordinator.stop();
    if (!state.serverReady || !isConfiguredUrl()) return;
    lastMenuSignature = menuSignature(state.data);
    syncCoordinator.start();
  }

  function stopSyncCoordinator() { syncCoordinator.stop(); }

  function updateKitchenPolling() {
    if (state.activeTab === 'Kitchen') syncKitchenQueue({ silent: true });
    syncCoordinator.tick();
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



  async function syncTicketHistoryData() {
    if (ticketHistoryPollInFlight || !state.serverReady || !isConfiguredUrl() || state.activeTab !== 'Live Tickets' || document.visibilityState === 'hidden') return;
    ticketHistoryPollInFlight = true;
    try {
      var result = await api('ticketHistorySnapshot', { date: state.historyDate || todayDateString(new Date()) });
      var incoming = result.data || {};
      var before = JSON.stringify([state.data.tickets || [], state.data.ticketItems || [], state.data.ticketAddOns || [], state.data.refunds || [], state.data.refundItems || []]);
      var after = JSON.stringify([incoming.tickets || [], incoming.ticketItems || [], incoming.ticketAddOns || [], incoming.refunds || [], incoming.refundItems || []]);
      if (before !== after) {
        mergeTransactionData(incoming);
        state.focusedRefresh.history.updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        state.focusedRefresh.history.error = '';
        if (state.activeTab === 'Live Tickets') renderLiveTickets();
      }
    } catch (err) {
      state.focusedRefresh.history.error = err.message || String(err);
      if (state.activeTab === 'Live Tickets') renderStatus();
    } finally {
      ticketHistoryPollInFlight = false;
    }
  }

  function versionDiagnostics(versions) {
    versions = versions || state.status || {};
    var expectedApp = CONFIG.appVersion || CONFIG.frontendVersion || 'unknown';
    var expectedDatabase = CONFIG.databaseVersion || 'unknown';
    var backend = versions.BackendVersion || versions.backendVersion || 'unknown';
    var database = versions.DatabaseVersion || versions.databaseVersion || 'unknown';
    return [
      { component: 'Browser application', expected: expectedApp, actual: CONFIG.frontendVersion || expectedApp, ok: (CONFIG.frontendVersion || expectedApp) === expectedApp },
      { component: 'Apps Script backend', expected: expectedApp, actual: backend, ok: backend === expectedApp },
      { component: 'Database schema', expected: expectedDatabase, actual: database, ok: database === expectedDatabase }
    ];
  }

  function versionDiagnosticsHtml() {
    var rows = versionDiagnostics(state.status).map(function (item) {
      return '<tr><td>' + escapeHtml(item.component) + '</td><td>' + escapeHtml(item.expected) + '</td><td>' + escapeHtml(item.actual) + '</td><td class="version-status ' + (item.ok ? 'version-ok' : 'version-error') + '">' + (item.ok ? 'MATCH' : 'MISMATCH') + '</td></tr>';
    }).join('');
    return '<div class="version-diagnostics"><table><thead><tr><th>Component</th><th>Expected</th><th>Reported</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function versionMode(versions) {
    var expectedBackend = CONFIG.backendVersion || CONFIG.frontendVersion || 'unknown';
    var expectedDatabase = CONFIG.databaseVersion || expectedBackend;
    if (versions.BackendVersion && versions.BackendVersion !== expectedBackend) return 'error';
    if (versions.DatabaseVersion && versions.DatabaseVersion !== expectedDatabase) return 'error';
    return 'live';
  }

  function normaliseData(data) { return Models.normaliseData(data); }

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
    $('topNav').innerHTML = NAV_GROUPS.map(function (group) {
      return '<div class="nav-group nav-group-' + attr(group.className) + '">' +
        '<div class="nav-group-label">' + escapeHtml(group.label) + '</div>' +
        '<div class="nav-group-buttons">' + group.tabs.map(function (tab) {
          return '<button class="nav-btn' + (state.activeTab === tab.route ? ' active' : '') + '" data-tab="' + attr(tab.route) + '">' + escapeHtml(tab.label) + '</button>';
        }).join('') + '</div></div>';
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
    if (state.activeTab === 'Till') scheduleTillAddFeedback();
  }



  function queueTillAddFeedback(lineIndex) {
    state.tillFeedback.pendingLineIndex = Number(lineIndex);
    state.tillFeedback.token += 1;
  }

  function scheduleTillAddFeedback() {
    var lineIndex = state.tillFeedback.pendingLineIndex;
    if (lineIndex < 0) return;
    var token = state.tillFeedback.token;
    state.tillFeedback.pendingLineIndex = -1;
    window.requestAnimationFrame(function () {
      if (state.activeTab !== 'Till' || token !== state.tillFeedback.token) return;
      var line = document.querySelector('.cart-line[data-cart-index="' + lineIndex + '"]');
      var scroller = document.querySelector('.ticket-items-scroll');
      var total = document.querySelector('.total-row.big');
      if (line && scroller) {
        var lineRect = line.getBoundingClientRect();
        var scrollerRect = scroller.getBoundingClientRect();
        var fullyVisible = lineRect.top >= scrollerRect.top && lineRect.bottom <= scrollerRect.bottom;
        if (!fullyVisible) line.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        line.classList.remove('cart-line-added');
        void line.offsetWidth;
        line.classList.add('cart-line-added');
        window.setTimeout(function () { line.classList.remove('cart-line-added'); }, 700);
      }
      if (total) {
        total.classList.remove('ticket-total-pulse');
        void total.offsetWidth;
        total.classList.add('ticket-total-pulse');
        window.setTimeout(function () { total.classList.remove('ticket-total-pulse'); }, 420);
      }
    });
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

  function kitchenDisplayEnabled() {
    var value = (state.data.settings || {}).KitchenDisplayEnabled;
    return value === undefined || value === null || value === '' ? true : Core.truthy(value);
  }

  function kitchenAgeEnabled() {
    var value = (state.data.settings || {}).KitchenAgeEnabled;
    return value === undefined || value === null || value === '' ? true : Core.truthy(value);
  }

  function kitchenPromptTitlesEnabled() {
    var value = (state.data.settings || {}).KitchenPromptTitlesEnabled;
    return value === undefined || value === null || value === '' ? true : Core.truthy(value);
  }

  function promptShowsTitleOnKds(promptId) {
    var prompt = (state.data.prompts || []).find(function (entry) { return String(entry.PromptID) === String(promptId || ''); });
    if (!prompt) return true;
    var value = prompt.ShowTitleOnKDS;
    return value === undefined || value === null || value === '' ? true : Core.truthy(value);
  }

  function kitchenAgeWarningMinutes() {
    return Math.max(1, Core.toNumber((state.data.settings || {}).KitchenAgeWarningMinutes, 10));
  }

  function kitchenAgeOverdueMinutes() {
    return Math.max(kitchenAgeWarningMinutes() + 1, Core.toNumber((state.data.settings || {}).KitchenAgeOverdueMinutes, 15));
  }

  function kitchenAgeFormat() {
    return String((state.data.settings || {}).KitchenAgeFormat || 'seconds') === 'minutes' ? 'minutes' : 'seconds';
  }

  function kitchenCreatedTime(value) {
    var time = new Date(value || '').getTime();
    return Number.isFinite(time) ? time : Date.now();
  }

  function kitchenAgeState(createdAt) {
    var elapsedMs = Math.max(0, Date.now() - kitchenCreatedTime(createdAt));
    var minutes = elapsedMs / 60000;
    return { elapsedMs: elapsedMs, level: minutes >= kitchenAgeOverdueMinutes() ? 'overdue' : (minutes >= kitchenAgeWarningMinutes() ? 'warning' : 'normal') };
  }

  function formatKitchenAge(elapsedMs) {
    var totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    if (totalSeconds >= 3600) return Math.floor(totalSeconds / 3600) + 'h ' + Math.floor((totalSeconds % 3600) / 60) + 'm';
    var minutes = Math.floor(totalSeconds / 60);
    if (kitchenAgeFormat() === 'minutes') return minutes + 'm';
    return String(minutes).padStart(2, '0') + ':' + String(totalSeconds % 60).padStart(2, '0');
  }

  function updateKitchenAgeIndicators() {
    if (state.activeTab !== 'Kitchen' || !kitchenAgeEnabled()) return;
    document.querySelectorAll('[data-kitchen-created]').forEach(function (el) {
      var age = kitchenAgeState(el.getAttribute('data-kitchen-created'));
      el.textContent = formatKitchenAge(age.elapsedMs);
      var ticket = el.closest('.kitchen-ticket');
      if (ticket && !ticket.classList.contains('complete')) {
        ticket.classList.toggle('age-warning', age.level === 'warning');
        ticket.classList.toggle('age-overdue', age.level === 'overdue');
      }
    });
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

  function loyaltyStampQuantity() {
    return loyaltyLines().reduce(function (sum, line) {
      return sum + Math.max(1, Core.toNumber(line.Quantity, 1));
    }, 0);
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
          return '<button class="item-card' + (Core.truthy(item.LoyaltyEligible) ? ' loyalty-item-card' : '') + '" data-action="add-item" data-id="' + attr(item.ItemID) + '">' +
            (Core.truthy(item.LoyaltyEligible) ? '<span class="loyalty-menu-badge">LOYALTY</span>' : '') +
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
        '<select class="select" data-field="OrderType"><option value=""' + (!state.ticketMeta.OrderType ? ' selected' : '') + '>Select order type</option><option' + (state.ticketMeta.OrderType === 'Takeaway' ? ' selected' : '') + '>Takeaway</option><option' + (state.ticketMeta.OrderType === 'Eat in' ? ' selected' : '') + '>Eat in</option></select>' +
      '</div>' +
      '<div class="ticket-items-scroll">' +
        '<div class="cart-box">' + (state.cart.length ? state.cart.map(renderCartLine).join('') : '<div class="empty-cart">Tap an item to start</div>') + '</div>' +
      '</div>' +
      '<div class="ticket-controls-static">' +
        '<div class="ticket-secondary-controls">' +
          '<button class="loyalty-btn' + (appliedLoyaltyLine() ? ' active' : '') + '" data-action="toggle-loyalty"' + (!loyaltyLines().length ? ' disabled' : '') + '>' + (appliedLoyaltyLine() ? 'Remove loyalty' : 'Apply loyalty') + '</button>' +
          '<button class="staff-discount-btn' + (discountActive ? ' active' : '') + '" data-action="toggle-staff-discount"' + (!discountPercent ? ' disabled' : '') + '>' + escapeHtml(discountButtonText) + (discountActive ? ' applied' : '') + '</button>' +
        '</div>' +
        '<div class="ticket-action-footer">' +
          '<div class="totals">' +
            '<div class="total-row"><span>Items</span><strong>' + Core.money(totals.subtotal) + '</strong></div>' +
            '<div class="total-row"><span>Additional items</span><strong>' + Core.money(totals.addOnTotal) + '</strong></div>' +
            (totals.loyaltyTotal ? '<div class="total-row loyalty-row"><span>Loyalty</span><strong>- ' + Core.money(totals.loyaltyTotal) + '</strong></div>' : '') +
            (discountActive ? '<div class="total-row discount-row"><span>Staff discount ' + escapeHtml(discountPercent) + '%</span><strong>- ' + Core.money(totals.discountTotal) + '</strong></div>' : '') +
            '<div class="total-row big"><span>Total to pay</span><span>' + Core.money(totals.total) + '</span></div>' +
          '</div>' +
          '<button type="button" class="cash-paid-display" data-action="open-cash-keypad" aria-label="Enter cash paid"><span>Cash paid</span><strong>' + (state.ticketMeta.CashPaid === '' || state.ticketMeta.CashPaid == null ? '£0.00' : Core.money(Core.toNumber(state.ticketMeta.CashPaid, 0))) + '</strong></button>' +
          '<div id="cashChangePreview" class="' + changeInfo.className + '">' + escapeHtml(changeInfo.text) + '</div>' +
          '<div class="row ticket-payment-actions"><button class="pay-cash half" data-action="pay-cash">Cash</button><button class="pay-card half" data-action="pay-card">Card</button></div>' +
          '<div class="row ticket-order-actions"><button class="secondary half" data-action="hold-current">Hold order</button><button class="danger half" data-action="clear-cart">Clear</button></div>' +
        '</div>' +
      '</div>' +
    '</aside>';
  }

  function addOnUsesVariableQuantity(addOn) {
    return Models.addOnUsesVariableQuantity(addOn, state.data.promptOptions || [], Core.truthy);
  }

  function addOnDisplayText(addOn, includePrice) {
    return Presentation.addOnDisplayText(addOn, { core: Core, models: Models, promptOptions: state.data.promptOptions || [], includePrice: includePrice });
  }

  function renderCartLine(line, index) {
    Core.setLineQuantity(line, line.Quantity);
    var loyaltyDiscount = Core.lineLoyaltyDiscount(line);
    var netLineTotal = Core.lineNetTotal(line);
    var loyaltyLabel = loyaltyDiscount ? '<div class="loyalty-chip">LOYALTY - ' + Core.money(loyaltyDiscount) + '</div>' : (Core.truthy(line.LoyaltyEligible) ? '<div class="loyalty-eligible-chip">LOYALTY ITEM</div>' : '');
    var lineCategory = line.CategoryName || categoryName(line.CategoryID) || 'Uncategorised';
    return '<div data-cart-index="' + index + '" class="cart-line' + (loyaltyDiscount ? ' loyalty-applied' : '') + (Core.truthy(line.LoyaltyEligible) ? ' loyalty-eligible-line' : '') + '">' +
      '<div class="line-top"><div><div class="line-title">' + escapeHtml(line.ItemName) + '</div><div class="ticket-category">' + escapeHtml(lineCategory) + '</div><div class="help">' + Core.money(line.BasePrice) + ' base + ' + Core.money(line.UnitAddOnTotal) + ' add-ons</div>' + loyaltyLabel + '</div><div class="line-money">' + (loyaltyDiscount ? '<span class="old-money">' + Core.money(line.LineTotal) + '</span><br>' : '') + Core.money(netLineTotal) + '</div></div>' +
      Presentation.renderAddOnList(line.AddOns || [], { core: Core, models: Models, promptOptions: state.data.promptOptions || [], includePrice: true }) +
      (line.Note ? '<div class="note-chip">Note: ' + escapeHtml(line.Note) + '</div>' : '') +
      '<div class="qty-row"><button class="qty-btn" data-action="line-minus" data-index="' + index + '">−</button><input class="small-input" data-action="line-qty" data-index="' + index + '" inputmode="numeric" value="' + attr(line.Quantity) + '"><button class="qty-btn" data-action="line-plus" data-index="' + index + '">+</button><button class="ghost" data-action="remove-line" data-index="' + index + '">Remove</button></div>' +
    '</div>';
  }

  function hasSelectedOrderType() {
    return state.ticketMeta.OrderType === 'Eat in' || state.ticketMeta.OrderType === 'Takeaway';
  }

  function resetCurrentOrderState(options) {
    options = options || {};
    state.cart = [];
    state.pendingOrderTypeItemId = '';
    state.orderTypeSelectedForEmptyOrder = false;
    state.pendingPaymentRequestId = '';
    state.ticketMeta.OrderType = '';
    state.ticketMeta.TableNumber = '';
    state.ticketMeta.CustomerName = '';
    state.ticketMeta.CashPaid = '';
    state.ticketMeta.StaffDiscountApplied = false;
    if (!options.keepServerName) state.ticketMeta.ServerName = state.ticketMeta.ServerName || '';
  }

  function normaliseEmptyOrderState() {
    if (state.cart.length) {
      state.orderTypeSelectedForEmptyOrder = false;
      return;
    }
    if (!state.orderTypeSelectedForEmptyOrder) {
      state.ticketMeta.OrderType = '';
      state.pendingOrderTypeItemId = '';
    }
  }

  function showOrderTypePrompt(context, pendingItemId) {
    context = context || 'till';
    state.pendingOrderTypeItemId = pendingItemId || '';
    var message = context === 'first-item'
      ? 'Choose the order type before this item is added to the basket.'
      : (context === 'post-payment'
        ? 'Choose the order type for the next customer, or cancel and select it when the first item is added.'
        : 'Choose the order type now, or cancel and select it when the first item is added.');
    $('modalRoot').innerHTML = '<div class="modal-backdrop"><div class="modal order-type-modal">' +
      '<h2>Eat in or Takeaway?</h2>' +
      '<div class="help">' + escapeHtml(message) + '</div>' +
      '<div class="order-type-choice-grid">' +
        '<button class="primary order-type-choice" data-modal-action="select-order-type" data-order-type="Eat in"><strong>Eat in</strong><span>Customer is staying at The Nook</span></button>' +
        '<button class="secondary order-type-choice" data-modal-action="select-order-type" data-order-type="Takeaway"><strong>Takeaway</strong><span>Customer is taking the order away</span></button>' +
      '</div>' +
      '<div class="row"><button class="ghost" data-modal-action="cancel-order-type">Cancel</button></div>' +
    '</div></div>';
  }

  function selectOrderType(orderType) {
    if (orderType !== 'Eat in' && orderType !== 'Takeaway') return;
    var pendingItemId = state.pendingOrderTypeItemId;
    state.pendingOrderTypeItemId = '';
    state.ticketMeta.OrderType = orderType;
    state.orderTypeSelectedForEmptyOrder = state.cart.length === 0;
    state.pendingPaymentRequestId = '';
    saveLocal();
    Ui.closeModal();
    render();
    if (pendingItemId) openItemModal(pendingItemId);
  }

  function cancelOrderTypePrompt() {
    state.pendingOrderTypeItemId = '';
    Ui.closeModal();
  }

  function requestAddItem(itemId) {
    normaliseEmptyOrderState();
    if (!hasSelectedOrderType()) {
      showOrderTypePrompt('first-item', itemId);
      return;
    }
    openItemModal(itemId);
  }

  function openItemModal(itemId) {
    var item = (state.data.menuItems || []).find(function (x) { return x.ItemID === itemId; });
    if (!item) return;
    var prompts = (state.data.prompts || []).filter(function (p) { return p.TriggerItemID === item.ItemID && Core.active(p.Active); }).sort(bySort);
    if (!prompts.length) {
      state.cart.push(Core.makeCartLine(item, [], ''));
      state.orderTypeSelectedForEmptyOrder = false;
      queueTillAddFeedback(state.cart.length - 1);
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
    var choice = allowValue
      ? '<div class="option-left option-variable-label"><span><strong>' + escapeHtml(option.OptionText) + '</strong><div class="option-price">' + (Core.toNumber(option.Price, 0) ? Core.money(option.Price) + ' each' : 'No extra charge') + '</div></span></div>'
      : '<label class="option-left option-select-all"><input type="' + inputType + '" name="prompt_' + attr(prompt.PromptID) + '" value="' + attr(option.OptionID) + '"><span><strong>' + escapeHtml(option.OptionText) + '</strong><div class="option-price">' + (Core.toNumber(option.Price, 0) ? Core.money(option.Price) + ' each' : 'No extra charge') + '</div></span></label>';
    return '<div class="option-card' + (allowValue ? ' option-card-variable' : ' option-card-selectable') + '" data-option-id="' + attr(option.OptionID) + '" data-allow-value="' + (allowValue ? '1' : '0') + '">' +
      choice +
      (allowValue ? '<div class="row variable-qty-control"><button class="qty-btn" data-modal-action="option-minus" data-option-id="' + attr(option.OptionID) + '">−</button><input class="small-input" inputmode="numeric" data-option-qty="' + attr(option.OptionID) + '" value="0" aria-label="Quantity for ' + attr(option.OptionText) + '"><button class="qty-btn" data-modal-action="option-plus" data-option-id="' + attr(option.OptionID) + '">+</button></div>' : '') +
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
              UnitPrice: Core.toNumber(option.Price, 0),
              AllowValue: Core.truthy(option.AllowValue)
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
    state.orderTypeSelectedForEmptyOrder = false;
    queueTillAddFeedback(state.cart.length - 1);
    state.pendingPaymentRequestId = '';
    closeModal();
    saveLocal();
    render();
  }

  function closeModal() {
    Ui.closeModal();
    if (state.awaitingPostPaymentOrderType && state.activeTab === 'Till' && !state.cart.length) {
      state.awaitingPostPaymentOrderType = false;
      window.setTimeout(function () { showOrderTypePrompt('post-payment'); }, 0);
    }
  }

  function showBusyMessage(title, message) { Ui.showBusy(title, message); }

  function hideBusyMessage() { Ui.hideBusy(); }


  function cashKeypadDigits() {
    var raw = String(state.ticketMeta.CashPaid == null ? '' : state.ticketMeta.CashPaid).replace(/[^0-9]/g, '');
    if (!raw) return '';
    return String(Math.round(Core.toNumber(state.ticketMeta.CashPaid, 0) * 100));
  }

  function cashDigitsToValue(digits) {
    digits = String(digits || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (!digits) return '';
    return (Core.toNumber(digits, 0) / 100).toFixed(2);
  }

  function renderCashKeypadAmount(digits) {
    var value = cashDigitsToValue(digits);
    return Core.money(value === '' ? 0 : Core.toNumber(value, 0));
  }

  function openCashKeypad() {
    var digits = cashKeypadDigits();
    $('modalRoot').innerHTML = '<div class="modal-backdrop"><div class="modal cash-keypad-modal"><h2>Cash paid</h2><div class="help">Enter the notes and coins received. Pence is filled automatically: 1 becomes £0.01, 100 becomes £1.00.</div><div class="cash-keypad-display" id="cashKeypadDisplay" data-cash-digits="' + attr(digits) + '">' + renderCashKeypadAmount(digits) + '</div><div class="pos-keypad cash-pos-keypad" aria-label="Cash amount keypad">' + [1,2,3,4,5,6,7,8,9].map(function (d) { return '<button type="button" class="keypad-key" data-modal-action="cash-digit" data-digit="' + d + '">' + d + '</button>'; }).join('') + '<button type="button" class="keypad-key keypad-clear" data-modal-action="cash-clear">Clear</button><button type="button" class="keypad-key" data-modal-action="cash-digit" data-digit="0">0</button><button type="button" class="keypad-key keypad-delete" data-modal-action="cash-delete">⌫</button></div><div class="row keypad-actions"><button class="secondary" data-modal-action="close">Cancel</button><button class="primary" data-modal-action="cash-accept">Use amount</button></div></div></div>';
  }

  function editCashKeypad(action, digit) {
    var display = $('cashKeypadDisplay');
    if (!display) return;
    var digits = display.getAttribute('data-cash-digits') || '';
    if (action === 'digit' && digits.length < 9) digits += String(digit || '');
    if (action === 'delete') digits = digits.slice(0, -1);
    if (action === 'clear') digits = '';
    display.setAttribute('data-cash-digits', digits);
    display.textContent = renderCashKeypadAmount(digits);
  }

  function acceptCashKeypad() {
    var display = $('cashKeypadDisplay');
    if (!display) return;
    state.ticketMeta.CashPaid = cashDigitsToValue(display.getAttribute('data-cash-digits') || '');
    state.pendingPaymentRequestId = '';
    saveLocal();
    closeModal();
    render();
  }

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
    var stampQty = loyaltyStampQuantity();
    var loyaltyReminder = stampQty ? '<div class="loyalty-stamp-reminder"><strong>LOYALTY STAMP REMINDER</strong><span>Add ' + escapeHtml(stampQty) + ' loyalty stamp' + (stampQty === 1 ? '' : 's') + ' for the eligible item' + (stampQty === 1 ? '' : 's') + ' on this ticket.</span></div>' : '';
    var html = '<div class="modal-backdrop"><div class="modal">' +
      '<h2>' + escapeHtml(method) + ' payment</h2>' + loyaltyReminder +
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
      resetCurrentOrderState({ keepServerName: true });
      state.paymentInProgress = false;
      state.awaitingPostPaymentOrderType = true;
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
        CategoryName: line.CategoryName || categoryName(line.CategoryID),
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
          Action: a.Action || 'Modifier',
          AllowValue: Core.truthy(a.AllowValue)
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
        CategoryName: line.CategoryName || categoryName(line.CategoryID),
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
          Action: a.Action || 'Modifier',
          AllowValue: Core.truthy(a.AllowValue)
        });
      });
    });
    var kitchen = kitchenDisplayEnabled() ? {
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
    } : null;
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
      : ((options.state === 'saved' && ticket.TicketID)
        ? '<button class="secondary" data-modal-action="email-saved-receipt" data-ticket-id="' + attr(ticket.TicketID) + '">Email receipt</button><button class="primary" data-modal-action="close">Close</button>'
        : '<button class="primary" data-modal-action="close">Close</button>');
    var html = '<div class="modal-backdrop"><div class="modal">' +
      '<h2>' + escapeHtml(title) + '</h2>' + banner +
      '<div class="cards"><div class="card"><h3>Total to pay</h3><div class="item-price">' + Core.money(ticket.Total) + '</div><div>' + escapeHtml(ticket.PaymentMethod) + (ticket.PaymentMethod === 'Cash' ? ' • Change ' + Core.money(ticket.ChangeDue) : '') + '</div>' +
        '<div class="receipt-money-lines"><div>Items: ' + Core.money(ticket.Subtotal) + '</div><div>Additional items: ' + Core.money(ticket.AddOnTotal) + '</div>' + (Core.toNumber(ticket.LoyaltyTotal, 0) ? '<div class="loyalty-text">Loyalty: -' + Core.money(ticket.LoyaltyTotal) + '</div>' : '') + (Core.toNumber(ticket.DiscountTotal, 0) ? '<div class="discount-text">Staff discount: -' + Core.money(ticket.DiscountTotal) + '</div>' : '') + '</div></div><div class="card"><h3>Ticket</h3><div class="item-price">#' + escapeHtml(ticket.TicketNumber) + '</div><div>' + escapeHtml(ticket.Status || '') + '</div><div class="receipt-money-lines">' + (ticket.CustomerName ? '<div>Customer: ' + escapeHtml(ticket.CustomerName) + '</div>' : '') + (ticket.TableNumber ? '<div>Table: ' + escapeHtml(ticket.TableNumber) + '</div>' : '') + '</div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Qty</th><th>Item</th><th>Configuration</th><th>Total</th></tr></thead><tbody>' +
      (items || []).map(function (it) {
        var rowAddons = (addons || []).filter(function (a) { return a.TicketItemID === it.TicketItemID; });
        var loyalty = Core.toNumber(it.LoyaltyDiscount, 0);
        var rowTotal = Core.roundMoney(Core.toNumber(it.LineTotal, 0) - loyalty);
        var itemCategory = it.CategoryName || categoryName(it.CategoryID) || 'Uncategorised';
        return '<tr><td>' + escapeHtml(it.Quantity) + '</td><td>' + escapeHtml(it.ItemName) + '<div class="ticket-category">' + escapeHtml(itemCategory) + '</div>' + (loyalty ? '<div class="loyalty-chip">LOYALTY - ' + Core.money(loyalty) + '</div>' : '') + (it.Note ? '<div class="note-chip">' + escapeHtml(it.Note) + '</div>' : '') + '</td><td>' + rowAddons.map(function (a) { return escapeHtml(addOnDisplayText(a, false)); }).join('<br>') + '</td><td>' + Core.money(rowTotal) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="row" style="margin-top:12px">' + closeButton + '</div>' +
    '</div></div>';
    $('modalRoot').innerHTML = html;
  }

  function renderHeldOrderItems(payload) {
    var items = (payload && payload.cart) || [];
    if (!items.length) return '<div class="held-order-empty help">No item details are available for this held order.</div>';
    return '<div class="held-order-items">' + items.map(function (line) {
      var quantity = Math.max(1, Core.toNumber(line.Quantity, 1));
      var category = line.CategoryName || categoryName(line.CategoryID) || '';
      var addOns = (line.AddOns || []).map(function (addOn) {
        return '<li>' + escapeHtml(addOnDisplayText(addOn, false)) + '</li>';
      }).join('');
      return '<div class="held-order-line">' +
        '<div class="held-order-line-main"><strong>' + escapeHtml(quantity) + ' × ' + escapeHtml(line.ItemName || 'Item') + '</strong><span>' + Core.money(Core.lineNetTotal(line)) + '</span></div>' +
        (category ? '<div class="ticket-category">' + escapeHtml(category) + '</div>' : '') +
        (addOns ? '<ul class="addon-list">' + addOns + '</ul>' : '') +
        (line.Note ? '<div class="note-chip">Note: ' + escapeHtml(line.Note) + '</div>' : '') +
      '</div>';
    }).join('') + '</div>';
  }

  function renderHeld() {
    var held = state.data.heldOrders || [];
    $('main').innerHTML = '<section class="panel"><div class="loader-header"><h2>Held orders</h2><button class="primary" data-action="hold-current">Hold current ticket</button></div>' +
      (held.length ? '<div class="cards">' + held.map(function (h) {
        var payload = safeJson(h.PayloadJSON);
        var total = h.Total || (payload.totals || {}).total || 0;
        return '<div class="card held-order-card"><h3>' + escapeHtml(h.CustomerName || h.TableNumber || h.OrderType || 'Held order') + '</h3><div class="help">' + escapeHtml(h.CreatedAt || '') + '</div>' + renderHeldOrderItems(payload) + '<div class="held-order-total"><span>Total</span><strong>' + Core.money(total) + '</strong></div><div class="row"><button class="primary" data-action="recall-held" data-id="' + attr(h.HoldID) + '">Recall</button><button class="danger" data-action="delete-held" data-id="' + attr(h.HoldID) + '">Delete</button></div></div>';
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
      resetCurrentOrderState({ keepServerName: true });
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
    showBusyMessage('Loading — Please wait', 'Retrieving the held order and returning it to the till.');
    try {
      if (isConfiguredUrl()) await api('deleteHeldOrder', { HoldID: id });
      else if (!canUseLocalTestMode()) throw new Error('Google Script URL is not configured.');
      var payload = safeJson(held.PayloadJSON);
      state.cart = payload.cart || [];
      state.orderTypeSelectedForEmptyOrder = false;
      state.pendingPaymentRequestId = '';
      state.ticketMeta = Object.assign(state.ticketMeta, payload.meta || {}, { CashPaid: '' });
      state.data.heldOrders = (state.data.heldOrders || []).filter(function (h) { return h.HoldID !== id; });
      state.activeTab = 'Till';
      saveLocal();
      saveServerCache();
      hideBusyMessage();
      render();
    } catch (err) {
      hideBusyMessage();
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

  function refreshStatusMarkup(kind) {
    var entry = state.focusedRefresh[kind] || {};
    if (entry.inFlight) return '<span class="screen-refresh-status refreshing">Refreshing…</span>';
    if (entry.error) return '<span class="screen-refresh-status error">Refresh failed — showing previous data' + (entry.updatedAt ? ' from ' + escapeHtml(entry.updatedAt) : '') + '</span>';
    if (entry.updatedAt) return '<span class="screen-refresh-status">Updated ' + escapeHtml(entry.updatedAt) + '</span>';
    return '<span class="screen-refresh-status">Not refreshed yet</span>';
  }

  function mergeTransactionData(data) {
    data = data || {};
    ['tickets', 'ticketItems', 'ticketAddOns', 'refunds', 'refundItems'].forEach(function (key) {
      if (Array.isArray(data[key])) state.data[key] = data[key];
    });
    saveServerCache();
  }

  async function refreshReportsData(options) {
    options = options || {};
    var entry = state.focusedRefresh.reports;
    if (entry.inFlight) return;
    entry.inFlight = true;
    entry.error = '';
    if (state.activeTab === 'Reports') renderReports();
    try {
      var result = await api('reportsSnapshot', { fromDate: state.reportFrom, toDate: state.reportTo });
      mergeTransactionData(result.data || {});
      entry.updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (err) {
      entry.error = err.message || String(err);
      if (!options.silent) toast('Reports refresh failed. Previous report data is still displayed.');
    } finally {
      entry.inFlight = false;
      if (state.activeTab === 'Reports') renderReports();
    }
  }

  async function refreshTicketHistoryData(options) {
    options = options || {};
    var entry = state.focusedRefresh.history;
    if (entry.inFlight) return;
    entry.inFlight = true;
    entry.error = '';
    if (state.activeTab === 'Live Tickets') renderLiveTickets();
    try {
      var result = await api('ticketHistorySnapshot', { date: state.historyDate });
      mergeTransactionData(result.data || {});
      entry.updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (err) {
      entry.error = err.message || String(err);
      if (!options.silent) toast('Ticket History refresh failed. Previous ticket data is still displayed.');
    } finally {
      entry.inFlight = false;
      if (state.activeTab === 'Live Tickets') renderLiveTickets();
    }
  }

  async function openFocusedTab(tab) {
    var today = todayDateString(new Date());
    if (tab === 'Reports') {
      state.reportFrom = today;
      state.reportTo = today;
      render();
      await refreshReportsData({ silent: true });
      return;
    }
    if (tab === 'Live Tickets') {
      state.historyDate = today;
      render();
      await refreshTicketHistoryData({ silent: true });
      return;
    }
    if (tab === 'Till' && !state.cart.length) {
      resetCurrentOrderState({ keepServerName: true });
      saveLocal();
    }
    render();
    if (tab === 'Till' && !state.cart.length) showOrderTypePrompt('till');
  }

  function renderLiveTickets() {
    var selectedDay = state.historyDate || todayDateString(new Date());
    var tickets = (state.data.tickets || []).filter(function (ticket) { return ticketDateString(ticket.CreatedAt) === selectedDay; }).slice().sort(function (a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); });
    $('main').innerHTML = '<section class="panel"><div class="loader-header"><div><h2>Ticket History</h2><div class="help">Showing tickets for ' + escapeHtml(selectedDay) + '</div></div><div class="screen-refresh-actions">' + refreshStatusMarkup('history') + '<button class="secondary" data-action="refresh-ticket-history">Refresh</button></div></div>' +
      '<div class="report-filters"><label><span>Date</span><input class="input" type="date" id="historyDate" value="' + attr(selectedDay) + '"></label><button class="secondary" data-action="history-today">Today</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Time</th><th>Type</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>' +
      (tickets.length ? tickets.map(function (t) {
        return '<tr><td>#' + escapeHtml(t.TicketNumber) + '</td><td>' + escapeHtml(formatDate(t.CreatedAt)) + '</td><td>' + escapeHtml(t.OrderType) + '</td><td>' + Core.money(t.Total) + '</td><td>' + escapeHtml(t.PaymentMethod) + '</td><td>' + escapeHtml(t.Status || 'PAID') + '</td><td><div class="row compact-actions"><button class="secondary" data-action="view-ticket" data-id="' + attr(t.TicketID) + '">View</button><button class="primary" data-action="email-ticket" data-id="' + attr(t.TicketID) + '">Email receipt</button><button class="danger" data-action="refund-ticket" data-id="' + attr(t.TicketID) + '">Refund</button></div></td></tr>';
      }).join('') : '<tr><td colspan="7">No tickets found for this date.</td></tr>') + '</tbody></table></div></section>';
  }

  function viewTicket(ticketId) {
    var t = (state.data.tickets || []).find(function (x) { return x.TicketID === ticketId; });
    if (!t) return;
    var items = (state.data.ticketItems || []).filter(function (x) { return x.TicketID === ticketId; });
    var addons = (state.data.ticketAddOns || []).filter(function (x) { return x.TicketID === ticketId; });
    showReceipt(t, items, addons);
  }

  function openEmailReceiptModal(ticketId) {
    var ticket = (state.data.tickets || []).find(function (x) { return x.TicketID === ticketId; });
    if (!ticket) { toast('Ticket could not be found.'); return; }
    $('modalRoot').innerHTML = '<div class="modal-backdrop"><div class="modal email-receipt-modal">' +
      '<h2>Email receipt</h2>' +
      '<div class="receipt-banner"><strong>Ticket #' + escapeHtml(ticket.TicketNumber) + '</strong><span>The receipt will be rebuilt from the saved Google Sheets ticket before it is sent.</span></div>' +
      '<label><span>Customer email address</span><input class="input" id="receiptEmailAddress" type="email" inputmode="email" autocomplete="email" placeholder="customer@example.com"></label>' +
      '<label><span>Optional message</span><textarea class="textarea" id="receiptEmailMessage" placeholder="Thank you for visiting The Nook."></textarea></label>' +
      '<div id="receiptEmailStatus" class="help">Google Apps Script email quota applies.</div>' +
      '<div class="row"><button class="secondary" data-modal-action="close">Cancel</button><button class="primary" data-modal-action="send-receipt-email" data-ticket-id="' + attr(ticketId) + '">Send receipt</button></div>' +
    '</div></div>';
    setTimeout(function () { var el = $('receiptEmailAddress'); if (el) el.focus(); }, 0);
  }

  async function sendReceiptEmail(ticketId, button) {
    var emailEl = $('receiptEmailAddress');
    var messageEl = $('receiptEmailMessage');
    var statusEl = $('receiptEmailStatus');
    var email = String(emailEl && emailEl.value || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { if (statusEl) statusEl.textContent = 'Enter a valid email address.'; return; }
    if (button) { button.disabled = true; button.textContent = 'Sending…'; }
    if (statusEl) statusEl.textContent = 'Sending receipt securely from Google Sheets…';
    try {
      var result = await api('emailReceipt', { ticketId: ticketId, email: email, message: String(messageEl && messageEl.value || '').trim() });
      closeModal();
      toast('Receipt emailed to ' + email + '. Remaining daily quota: ' + escapeHtml(result.remainingQuota));
    } catch (err) {
      if (button) { button.disabled = false; button.textContent = 'Send receipt'; }
      if (statusEl) statusEl.textContent = 'Receipt was not sent: ' + err.message;
    }
  }

  function refundInReportRange(refund) {
    if (!refund || !refund.CreatedAt) return false;
    var day = todayDateString(new Date(refund.CreatedAt));
    return (!state.reportFrom || day >= state.reportFrom) && (!state.reportTo || day <= state.reportTo);
  }

  function renderReports() {
    var tickets = (state.data.tickets || []).filter(function (t) { return (t.Status || 'PAID') !== 'VOID' && ticketInReportRange(t); });
    var refunds = (state.data.refunds || []).filter(refundInReportRange);
    var ticketIdMap = {};
    tickets.forEach(function (t) { ticketIdMap[t.TicketID] = true; });
    var grossSales = tickets.reduce(function (sum, t) { return sum + Core.toNumber(t.Total, 0); }, 0);
    var refundTotal = refunds.reduce(function (sum, r) { return sum + Core.toNumber(r.Amount, 0); }, 0);
    var netSales = Core.roundMoney(grossSales - refundTotal);
    var loyaltyGiven = tickets.reduce(function (sum, t) { return sum + Core.toNumber(t.LoyaltyTotal, 0); }, 0);
    var staffDiscountGiven = tickets.reduce(function (sum, t) { return sum + Core.toNumber(t.DiscountTotal, 0); }, 0);
    var cashSales = tickets.filter(function (t) { return t.PaymentMethod === 'Cash'; }).reduce(function (sum, t) { return sum + Core.toNumber(t.Total, 0); }, 0);
    var cardSales = tickets.filter(function (t) { return t.PaymentMethod === 'Card'; }).reduce(function (sum, t) { return sum + Core.toNumber(t.Total, 0); }, 0);
    var itemRows = itemReportRows(ticketIdMap);
    $('main').innerHTML = '<section class="panel"><div class="loader-header"><div><h2>Reports</h2><div class="help">Current view: ' + escapeHtml(reportRangeLabel()) + '. Refunds are deducted from net sales and exports.</div></div><div class="screen-refresh-actions">' + refreshStatusMarkup('reports') + '<button class="secondary" data-action="refresh-reports">Refresh</button></div></div>' +
      '<div class="report-filters"><label><span>From</span><input class="input" type="date" id="reportFrom" value="' + attr(state.reportFrom) + '"></label><label><span>To</span><input class="input" type="date" id="reportTo" value="' + attr(state.reportTo) + '"></label><button class="secondary" data-action="report-today">Today</button><button class="secondary" data-action="export-reports">Export selected period</button><button class="danger" data-action="clear-reports">Clear all reports</button></div>' +
      '<div class="cards"><div class="card"><h3>Gross sales</h3><div class="item-price">' + Core.money(grossSales) + '</div></div><div class="card refund-card"><h3>Refunds</h3><div class="item-price refund-value">−' + Core.money(refundTotal) + '</div><div class="help">' + refunds.length + ' refund transaction(s)</div></div><div class="card"><h3>Net sales</h3><div class="item-price">' + Core.money(netSales) + '</div><div class="help">Gross sales less refunds</div></div><div class="card"><h3>Loyalty given</h3><div class="item-price loyalty-text">' + Core.money(loyaltyGiven) + '</div></div><div class="card"><h3>Staff discount</h3><div class="item-price discount-text">' + Core.money(staffDiscountGiven) + '</div></div><div class="card"><h3>Cash sales</h3><div class="item-price">' + Core.money(cashSales) + '</div></div><div class="card"><h3>Card sales</h3><div class="item-price">' + Core.money(cardSales) + '</div></div><div class="card"><h3>Tickets</h3><div class="item-price">' + tickets.length + '</div></div></div>' +
      '<h3>Sales</h3><div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Time</th><th>Payment</th><th>Total</th></tr></thead><tbody>' + tickets.slice().sort(function (a,b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); }).map(function (t) { return '<tr><td>#' + escapeHtml(t.TicketNumber) + '</td><td>' + escapeHtml(formatDate(t.CreatedAt)) + '</td><td>' + escapeHtml(t.PaymentMethod) + '</td><td>' + Core.money(t.Total) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<h3>Refunds</h3><div class="table-wrap"><table><thead><tr><th>Refund</th><th>Original ticket</th><th>Time</th><th>Items</th><th>Reason</th><th>Staff</th><th>Deduction</th></tr></thead><tbody>' + (refunds.length ? refunds.slice().sort(function (a,b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); }).map(function (r) { var lines=(state.data.refundItems||[]).filter(function (x) { return x.RefundID===r.RefundID; }); return '<tr class="refund-row"><td>' + escapeHtml(r.RefundNumber || (String(r.TicketNumber)+'-R')) + '</td><td>#' + escapeHtml(r.TicketNumber) + '</td><td>' + escapeHtml(formatDate(r.CreatedAt)) + '</td><td>' + escapeHtml(lines.map(function(x){return x.ItemName+' x'+x.Quantity;}).join(', ')) + '</td><td>' + escapeHtml(r.Reason) + '</td><td>' + escapeHtml(r.StaffName) + '</td><td>−' + Core.money(r.Amount) + '</td></tr>'; }).join('') : '<tr><td colspan="7">No refunds in this period.</td></tr>') + '</tbody></table></div>' +
      '<h3>Item sales</h3><div class="table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Gross item value</th><th>Loyalty value</th><th>Net item value</th></tr></thead><tbody>' + itemRows.map(function (r) { return '<tr><td>' + escapeHtml(r.name) + '</td><td>' + escapeHtml(r.qty) + '</td><td>' + Core.money(r.sales) + '</td><td>' + Core.money(r.loyalty) + '</td><td>' + Core.money(r.net) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
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
    return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a,b) { return b.qty-a.qty; });
  }

  function csvCell(value) { var text=String(value==null?'':value); return '"'+text.replace(/"/g,'""')+'"'; }

  function exportMenuItemsByCategory() {
    var categoryMap={}; (state.data.categories||[]).forEach(function(c){categoryMap[c.CategoryID]=c.CategoryName||'Uncategorised';});
    var items=(state.data.menuItems||[]).slice().sort(function(a,b){var ca=categoryMap[a.CategoryID]||a.CategoryName||'Uncategorised';var cb=categoryMap[b.CategoryID]||b.CategoryName||'Uncategorised';return String(ca).localeCompare(String(cb))||bySort(a,b)||String(a.ItemName||'').localeCompare(String(b.ItemName||''));});
    var rows = [['Category', 'Item', 'Description', 'Price', 'Active', 'Loyalty eligible', 'Sort order']];
    items.forEach(function(item){rows.push([categoryMap[item.CategoryID]||item.CategoryName||'Uncategorised',item.ItemName||'',item.Description||'',Core.toNumber(item.Price,0).toFixed(2),Core.active(item.Active)?'Yes':'No',Core.truthy(item.LoyaltyEligible)?'Yes':'No',Core.toNumber(item.Sort,0)]);});
    var csv=rows.map(function(row){return row.map(csvCell).join(',');}).join('\r\n'); var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); var url=URL.createObjectURL(blob); var a=document.createElement('a');a.href=url;a.download='nook-menu-items-by-category-'+todayDateString(new Date())+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Menu item list downloaded.');
  }

  function exportReports() {
    var tickets=(state.data.tickets||[]).filter(function(t){return (t.Status||'PAID')!=='VOID'&&ticketInReportRange(t);});
    var refunds=(state.data.refunds||[]).filter(refundInReportRange); var ids={}; tickets.forEach(function(t){ids[t.TicketID]=true;});
    var gross=tickets.reduce(function(sum,t){return sum+Core.toNumber(t.Total,0);},0); var refundTotal=refunds.reduce(function(sum,r){return sum+Core.toNumber(r.Amount,0);},0);
    var rows=[['SUMMARY'],['Gross Sales',gross.toFixed(2)],['Refunds',(-refundTotal).toFixed(2)],['Net Sales',Core.roundMoney(gross-refundTotal).toFixed(2)],[],['SALES'],['Ticket Number','Created At','Order Type','Server','Table','Customer','Payment Method','Total','Status']];
    tickets.forEach(function(t){rows.push([t.TicketNumber,t.CreatedAt,t.OrderType,t.ServerName,t.TableNumber,t.CustomerName,t.PaymentMethod,t.Total,t.Status||'PAID']);});
    rows.push([],['REFUNDS'],['Refund Number','Original Ticket','Created At','Item','Quantity','Refund Amount','Reason','Staff']);
    refunds.forEach(function(r){var lines=(state.data.refundItems||[]).filter(function(x){return x.RefundID===r.RefundID;}); if(!lines.length) rows.push([r.RefundNumber||String(r.TicketNumber)+'-R',r.TicketNumber,r.CreatedAt,'', '',(-Core.toNumber(r.Amount,0)).toFixed(2),r.Reason,r.StaffName]); else lines.forEach(function(line){rows.push([r.RefundNumber||String(r.TicketNumber)+'-R',r.TicketNumber,r.CreatedAt,line.ItemName,line.Quantity,(-Core.toNumber(line.LineRefundTotal,0)).toFixed(2),r.Reason,r.StaffName]);});});
    rows.push([],['ITEM LINES'],['Ticket Number','Item','Quantity','Base Price','Line Total','Loyalty Discount','Notes']);
    (state.data.ticketItems||[]).filter(function(i){return ids[i.TicketID];}).forEach(function(i){var ticket=tickets.find(function(t){return t.TicketID===i.TicketID;})||{};rows.push([ticket.TicketNumber,i.ItemName,i.Quantity,i.BasePrice,i.LineTotal,i.LoyaltyDiscount,i.Notes||'']);});
    var csv=rows.map(function(row){return row.map(csvCell).join(',');}).join('\r\n');var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nook-reports-'+(state.reportFrom||'start')+'-to-'+(state.reportTo||'today')+'.csv';a.click();URL.revokeObjectURL(a.href);toast('Report export created for '+reportRangeLabel()+'.');
  }

  function openClearReportsKeypad() {
    var html = '<div class="modal-backdrop"><div class="modal report-clear-modal"><h2>Clear all reports</h2><div class="danger-panel"><strong>Warning</strong><div>This permanently clears all tickets, ticket items, add-ons, refunds and kitchen records, then resets the ticket counter to 0.</div></div><div class="keypad-hint">Passcode hint: <strong>Wiesheu</strong></div><div class="passcode-display" id="reportClearPasscodeDisplay" aria-label="Report clear passcode">••••</div><input type="hidden" id="reportClearPasscode" value=""><div class="pos-keypad" aria-label="Numeric keypad">' + [1,2,3,4,5,6,7,8,9].map(function(d){return '<button type="button" class="keypad-key" data-modal-action="report-code-digit" data-digit="'+d+'">'+d+'</button>';}).join('') + '<button type="button" class="keypad-key keypad-clear" data-modal-action="report-code-clear">Clear</button><button type="button" class="keypad-key" data-modal-action="report-code-digit" data-digit="0">0</button><button type="button" class="keypad-key keypad-delete" data-modal-action="report-code-delete">⌫</button></div><div class="row keypad-actions"><button class="secondary" data-modal-action="close">Cancel</button><button class="danger" data-modal-action="report-code-submit">Clear reports</button></div></div></div>';
    $('modalRoot').innerHTML=html; updateReportClearPasscodeDisplay();
  }

  function updateReportClearPasscodeDisplay(){var value=String(($('reportClearPasscode')||{}).value||'');var display=$('reportClearPasscodeDisplay');if(display)display.textContent=(value?'●'.repeat(value.length):'')+'○'.repeat(Math.max(0,4-value.length));}
  function editReportClearPasscode(action,digit){var input=$('reportClearPasscode');if(!input)return;var value=String(input.value||'');if(action==='digit'&&value.length<4)value+=String(digit||'').replace(/\D/g,'').slice(0,1);if(action==='delete')value=value.slice(0,-1);if(action==='clear')value='';input.value=value.replace(/\D/g,'').slice(0,4);updateReportClearPasscodeDisplay();}
  async function submitClearReportsPasscode(){var passcode=String((($('reportClearPasscode')||{}).value)||'').trim();if(passcode.length!==4){toast('Enter the four-digit passcode.');return;}if(!(await themedConfirm({title:'Clear all reports?',message:'This permanently clears saved reports and resets the ticket counter to 0.',confirmLabel:'Clear reports',cancelLabel:'Cancel',tone:'danger'})))return;try{state.status.write='clearing reports';renderStatus();await api('clearReports', { passcode: passcode });closeModal();await bootstrap();toast('All report data cleared. Ticket counter reset to 0.');}catch(err){editReportClearPasscode('clear');persistFailed('Reports were not cleared',err);}}

  function refundedQuantityForTicketItem(ticketItemId) {
    return (state.data.refundItems || []).filter(function (line) { return String(line.TicketItemID) === String(ticketItemId); }).reduce(function (sum,line) { return sum + Core.toNumber(line.Quantity,0); },0);
  }

  function openRefundModal(ticketId) {
    var ticket=(state.data.tickets||[]).find(function(t){return String(t.TicketID)===String(ticketId);}); if(!ticket){toast('Ticket could not be found.');return;}
    var items=(state.data.ticketItems||[]).filter(function(i){return String(i.TicketID)===String(ticketId);});
    if(!items.length){toast('This ticket has no refundable item lines.');return;}
    var rows=items.map(function(item){var sold=Core.toNumber(item.Quantity,0);var refunded=refundedQuantityForTicketItem(item.TicketItemID);var remaining=Math.max(0,sold-refunded);var unit=remaining?Core.roundMoney((Core.toNumber(item.LineTotal,0)-Core.toNumber(item.LoyaltyDiscount,0))/Math.max(1,sold)):0;var itemCategory=item.CategoryName||categoryName(item.CategoryID)||'Uncategorised';return '<div class="refund-item-row '+(remaining?'':'fully-refunded')+'"><div><strong>'+escapeHtml(item.ItemName)+'</strong><div class="ticket-category">'+escapeHtml(itemCategory)+'</div><div class="help">Sold: '+sold+' · Already refunded: '+refunded+' · Remaining: '+remaining+' · '+Core.money(unit)+' each</div></div><div class="refund-qty-controls"><button type="button" class="qty-btn" data-modal-action="refund-minus" data-ticket-item-id="'+attr(item.TicketItemID)+'" '+(remaining?'':'disabled')+'>−</button><input class="small-input" inputmode="numeric" data-refund-qty="'+attr(item.TicketItemID)+'" data-max="'+remaining+'" value="0" '+(remaining?'':'disabled')+'><button type="button" class="qty-btn" data-modal-action="refund-plus" data-ticket-item-id="'+attr(item.TicketItemID)+'" '+(remaining?'':'disabled')+'>+</button></div></div>';}).join('');
    $('modalRoot').innerHTML='<div class="modal-backdrop"><div class="modal refund-modal"><h2>Refund ticket #'+escapeHtml(ticket.TicketNumber)+'</h2><div class="help">Select the quantity of each item to refund. The server will verify quantities and calculate the final amount.</div><div class="refund-items">'+rows+'</div><label><span>Reason</span><select class="select" id="refundReason"><option value="">Select reason</option><option>Customer complaint</option><option>Wrong order</option><option>Cancelled</option><option>Staff error</option><option>Other</option></select></label><label><span>Staff name</span><input class="input" id="refundStaff" placeholder="Staff processing refund"></label><div class="refund-total-line"><strong>Estimated refund</strong><span id="refundEstimatedTotal">£0.00</span></div><div id="refundStatus" class="help"></div><div class="row"><button class="secondary" data-modal-action="close">Cancel</button><button class="danger" data-modal-action="process-item-refund" data-ticket-id="'+attr(ticketId)+'">Process refund</button></div></div></div>';
    updateRefundEstimate(ticketId);
  }

  function editRefundQuantity(ticketItemId,delta){var input=document.querySelector('[data-refund-qty="'+cssEscape(ticketItemId)+'"]');if(!input)return;var max=Core.toNumber(input.getAttribute('data-max'),0);input.value=Math.max(0,Math.min(max,Core.toNumber(input.value,0)+delta));var modal=document.querySelector('[data-modal-action="process-item-refund"]');if(modal)updateRefundEstimate(modal.getAttribute('data-ticket-id'));}
  function updateRefundEstimate(ticketId){var total=0;(state.data.ticketItems||[]).filter(function(i){return String(i.TicketID)===String(ticketId);}).forEach(function(item){var input=document.querySelector('[data-refund-qty="'+cssEscape(item.TicketItemID)+'"]');var qty=Core.toNumber(input&&input.value,0);var sold=Math.max(1,Core.toNumber(item.Quantity,1));var unit=(Core.toNumber(item.LineTotal,0)-Core.toNumber(item.LoyaltyDiscount,0))/sold;total+=qty*unit;});var el=$('refundEstimatedTotal');if(el)el.textContent=Core.money(Core.roundMoney(total));}
  async function processItemRefund(ticketId,button){var reason=String((($('refundReason')||{}).value)||'').trim();var staff=String((($('refundStaff')||{}).value)||'').trim();var items=[];document.querySelectorAll('[data-refund-qty]').forEach(function(input){var qty=Core.toNumber(input.value,0);if(qty>0)items.push({TicketItemID:input.getAttribute('data-refund-qty'),Quantity:qty});});var status=$('refundStatus');if(!items.length){if(status)status.textContent='Select at least one item quantity.';return;}if(!reason){if(status)status.textContent='Select a refund reason.';return;}if(!staff){if(status)status.textContent='Enter the staff name.';return;}if(!(await themedConfirm({title:'Process this refund?',message:'The selected items will be refunded while the original sale remains unchanged.',confirmLabel:'Process refund',cancelLabel:'Cancel',tone:'danger'})))return;showBusyMessage('Saving — Please wait', 'Saving this refund to Google Sheets.');try{var result=await api('refundTicket',{ticketId:ticketId,items:items,reason:reason,staffName:staff});state.data.refunds=state.data.refunds||[];state.data.refundItems=state.data.refundItems||[];state.data.refunds.push(result.refund);(result.refundItems||[]).forEach(function(line){state.data.refundItems.push(line);});hideBusyMessage();render();toast('Refund '+result.refund.RefundNumber+' saved: '+Core.money(result.refund.Amount));}catch(err){hideBusyMessage();openRefundModal(ticketId);var reasonInput=$('refundReason');var staffInput=$('refundStaff');if(reasonInput)reasonInput.value=reason;if(staffInput)staffInput.value=staff;items.forEach(function(item){var input=document.querySelector('[data-refund-qty="'+cssEscape(item.TicketItemID)+'"]');if(input)input.value=item.Quantity;});updateRefundEstimate(ticketId);var restoredStatus=$('refundStatus');if(restoredStatus)restoredStatus.textContent='Refund was not saved: '+err.message;}}

  function renderRefunds() {
    var refunds=(state.data.refunds||[]).slice().sort(function(a,b){return String(b.CreatedAt).localeCompare(String(a.CreatedAt));});
    $('main').innerHTML='<section class="panel"><h2>Refunds</h2><div class="help">Refunds are started from Ticket History so the exact sold items and remaining quantities can be verified.</div><div class="table-wrap"><table><thead><tr><th>Refund</th><th>Original ticket</th><th>Time</th><th>Items</th><th>Amount</th><th>Reason</th><th>Staff</th></tr></thead><tbody>'+(refunds.length?refunds.map(function(r){var lines=(state.data.refundItems||[]).filter(function(x){return x.RefundID===r.RefundID;});return '<tr><td>'+escapeHtml(r.RefundNumber||'Refund')+'</td><td>#'+escapeHtml(r.TicketNumber)+'</td><td>'+escapeHtml(formatDate(r.CreatedAt))+'</td><td>'+escapeHtml(lines.map(function(x){return x.ItemName+' x'+x.Quantity;}).join(', '))+'</td><td>−'+Core.money(r.Amount)+'</td><td>'+escapeHtml(r.Reason)+'</td><td>'+escapeHtml(r.StaffName)+'</td></tr>';}).join(''):'<tr><td colspan="7">No refunds saved.</td></tr>')+'</tbody></table></div></section>';
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
    if (!kitchenDisplayEnabled()) {
      $('main').innerHTML = '<section class="panel"><h2>Kitchen Ticket Display</h2><div class="card"><h3>Kitchen display is switched off</h3><p class="help">Turn it back on from Settings when kitchen tickets are required. New paid transactions are not added to the kitchen queue while it is off.</p></div></section>';
      return;
    }
    var allQueue = state.data.kitchenQueue || [];
    var counts = kitchenOpenTicketCounts(allQueue);
    var queue = allQueue.filter(function (k) {
      return (k.Status || 'OPEN') !== 'COMPLETE' || state.kitchenRecentlyCompleted[k.KitchenID];
    }).sort(function (a, b) { return String(a.CreatedAt).localeCompare(String(b.CreatedAt)); });
    var now = Date.now();
    if (!state.kitchenSeenInitialised) {
      queue.forEach(function (k) { state.kitchenSeenTickets[k.KitchenID] = true; });
      state.kitchenSeenInitialised = true;
    } else {
      queue.forEach(function (k) {
        if (!state.kitchenSeenTickets[k.KitchenID]) {
          state.kitchenSeenTickets[k.KitchenID] = true;
          state.kitchenArrivalUntil[k.KitchenID] = now + 2200;
        }
      });
    }
    $('main').innerHTML = '<section class="panel"><div class="loader-header"><div><h2>Kitchen Ticket Display</h2><div class="help">New tickets load automatically from Google Sheets while this screen is open. Food and drinks are split by the Drink category tick box in Menu Admin. Completed sections stay greyed out on every device after the server confirms the update.</div></div><div class="kitchen-header-actions"><div class="kitchen-open-counts" aria-label="Open kitchen ticket counts"><span class="kitchen-count food"><strong>' + counts.food + '</strong> Open Food</span><span class="kitchen-count drinks"><strong>' + counts.drinks + '</strong> Open Drinks</span></div><button class="secondary" data-action="refresh-kitchen">Refresh from server</button></div></div>' +
      '<div class="kitchen-grid">' + (queue.length ? queue.map(renderKitchenTicket).join('') : '<div class="card">No open kitchen tickets.</div>') + '</div></section>';
    updateKitchenAgeIndicators();
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
    var createdAt = k.CreatedAt || payload.CreatedAt || '';
    var age = kitchenAgeState(createdAt);
    var arriving = !complete && state.kitchenArrivalUntil[k.KitchenID] > Date.now();
    var ageClass = !complete && kitchenAgeEnabled() ? (age.level === 'overdue' ? ' age-overdue' : (age.level === 'warning' ? ' age-warning' : '')) : '';
    return '<div class="kitchen-ticket' + (complete ? ' complete' : '') + (arriving ? ' kitchen-ticket-arriving' : '') + ageClass + '" data-kitchen-id="' + attr(k.KitchenID) + '"><div class="stamp">COMPLETED</div><div class="kitchen-header"><div><div class="ticket-last4">#' + escapeHtml(ticketNumber) + '</div><strong>' + escapeHtml(k.OrderType || payload.OrderType || '') + '</strong><div class="help">' + escapeHtml(formatDate(createdAt)) + '</div>' + (meta.length ? '<div class="help">' + escapeHtml(meta.join(' • ')) + '</div>' : '') + '</div><div class="kitchen-ticket-actions">' + (kitchenAgeEnabled() ? '<div class="kitchen-age" data-kitchen-created="' + attr(createdAt) + '" aria-label="Ticket age">' + escapeHtml(formatKitchenAge(age.elapsedMs)) + '</div>' : '') + (!complete ? '<button class="danger kitchen-complete-all" data-action="complete-kitchen" data-id="' + attr(k.KitchenID) + '"' + (state.kitchenPendingUpdates[k.KitchenID] ? ' disabled' : '') + '>' + (state.kitchenPendingUpdates[k.KitchenID] ? 'Saving…' : 'Complete both') + '</button>' : '') + '</div></div>' +
      renderKitchenSection(k, 'food', 'Food', groups.food, sectionState.FoodStatus) +
      renderKitchenSection(k, 'drinks', 'Drinks', groups.drinks, sectionState.DrinksStatus) +
      '</div>';
  }

  function renderKitchenAddOns(addOns) {
    addOns = addOns || [];
    if (!addOns.length) return '';
    if (!kitchenPromptTitlesEnabled()) {
      return Presentation.renderAddOnList(addOns, { core: Core, models: Models, promptOptions: state.data.promptOptions || [], includePrice: false });
    }
    var groups = [];
    var byKey = {};
    addOns.forEach(function (addOn, index) {
      var promptId = String(addOn.PromptID || '');
      var showTitle = promptShowsTitleOnKds(promptId);
      var title = String(addOn.PromptTitle || '').trim();
      var key = showTitle && title ? ('prompt:' + (promptId || title)) : ('plain:' + index);
      if (!byKey[key]) {
        byKey[key] = { title: showTitle ? title : '', addOns: [] };
        groups.push(byKey[key]);
      }
      byKey[key].addOns.push(addOn);
    });
    return '<div class="kds-addon-groups">' + groups.map(function (group) {
      var list = Presentation.renderAddOnList(group.addOns, { core: Core, models: Models, promptOptions: state.data.promptOptions || [], includePrice: false });
      return '<div class="kds-addon-group">' + (group.title ? '<div class="kds-prompt-title">' + escapeHtml(group.title) + ':</div>' : '') + list + '</div>';
    }).join('') + '</div>';
  }

  function renderKitchenSection(k, sectionName, title, items, status) {
    if (!items.length) return '';
    var done = status === 'COMPLETE';
    var pending = !!state.kitchenPendingUpdates[k.KitchenID];
    return '<div class="kitchen-section' + (done ? ' done' : '') + '"><div class="kitchen-section-head"><div><h3>' + escapeHtml(title) + '</h3><span class="badge ' + (done ? 'ok' : 'warn') + '">' + (done ? 'Completed' : 'Open') + '</span></div>' +
      (done ? '<button class="secondary" data-action="reopen-kitchen-section" data-id="' + attr(k.KitchenID) + '" data-section="' + attr(sectionName) + '"' + (pending ? ' disabled' : '') + '>' + (pending ? 'Saving…' : 'Reopen') + '</button>' : '<button class="primary" data-action="complete-kitchen-section" data-id="' + attr(k.KitchenID) + '" data-section="' + attr(sectionName) + '"' + (pending ? ' disabled' : '') + '>' + (pending ? 'Saving…' : 'Complete ' + escapeHtml(title)) + '</button>') +
      '</div>' + items.map(function (item) {
        var loyalty = Core.toNumber(item.LoyaltyDiscount, 0);
        var itemCategory = item.CategoryName || categoryName(item.CategoryID) || 'Uncategorised';
        return '<div class="kitchen-item"><strong>' + escapeHtml(item.Quantity) + ' x ' + escapeHtml(item.ItemName) + '</strong>' +
          '<div class="kitchen-item-category">' + escapeHtml(itemCategory) + '</div>' +
          (loyalty ? '<div class="loyalty-chip">LOYALTY</div>' : '') +
          renderKitchenAddOns(item.AddOns || []) +
          (item.Note ? '<div class="note-chip">' + escapeHtml(item.Note) + '</div>' : '') + '</div>';
      }).join('') + '</div>';
  }

  async function updateKitchenSection(id, sectionName, status) {
    if (state.kitchenPendingUpdates[id]) return;
    var k = (state.data.kitchenQueue || []).find(function (x) { return x.KitchenID === id; });
    if (!k) return;
    var previousStatus = k.Status;
    var previousPayloadJSON = k.PayloadJSON;
    var payload = safeJson(k.PayloadJSON);
    var groups = kitchenGroups(payload.Items || []);
    var sectionState = kitchenSectionState(payload);
    if (sectionName === 'food') sectionState.FoodStatus = status;
    if (sectionName === 'drinks') sectionState.DrinksStatus = status;
    var overall = kitchenOverallStatus(sectionState, groups);
    if (overall === 'COMPLETE') sectionState.CompletedAt = new Date().toISOString();
    else sectionState.CompletedAt = '';
    payload.Sections = sectionState;

    // Optimistically update this device, but protect the row from the polling loop until
    // the Apps Script write has returned the authoritative merged row.
    state.kitchenPendingUpdates[id] = true;
    k.Status = overall;
    k.PayloadJSON = JSON.stringify(payload);
    if (overall === 'COMPLETE') state.kitchenRecentlyCompleted[id] = true;
    else delete state.kitchenRecentlyCompleted[id];
    renderKitchen();
    try {
      var result = null;
      if (isConfiguredUrl()) result = await api('kitchenUpdate', {
        KitchenID: id,
        SectionName: sectionName,
        SectionStatus: status
      });
      else if (!canUseLocalTestMode()) throw new Error('Google Script URL is not configured.');
      if (result && result.saved) {
        k.Status = result.saved.Status || overall;
        k.PayloadJSON = result.saved.PayloadJSON || JSON.stringify(payload);
        overall = k.Status;
      }
      state.status.write = 'OK';
      state.status.message = isConfiguredUrl() ? 'Kitchen section updated in Google Sheets' : 'Kitchen section updated locally for testing only';
      saveLocal();
      saveServerCache();
      if (overall === 'COMPLETE') {
        setTimeout(function () {
          delete state.kitchenRecentlyCompleted[id];
          if (state.activeTab === 'Kitchen') render();
        }, 1800);
      } else delete state.kitchenRecentlyCompleted[id];
    } catch (err) {
      k.Status = previousStatus;
      k.PayloadJSON = previousPayloadJSON;
      delete state.kitchenRecentlyCompleted[id];
      state.status.mode = 'error';
      state.status.write = 'failed';
      state.status.message = 'Kitchen update failed: ' + err.message;
      toast('Kitchen update failed. Ticket remains open.');
    } finally {
      delete state.kitchenPendingUpdates[id];
      if (state.activeTab === 'Kitchen') render();
      renderStatus();
      // Pull the authoritative row after the pending guard has been removed.
      if (isConfiguredUrl()) syncKitchenQueue({ silent: true });
    }
  }

  async function completeKitchen(id) {
    if (state.kitchenPendingUpdates[id]) return;
    var k = (state.data.kitchenQueue || []).find(function (x) { return x.KitchenID === id; });
    if (!k) return;
    var previousStatus = k.Status;
    var previousPayloadJSON = k.PayloadJSON;
    state.kitchenPendingUpdates[id] = true;
    k.Status = 'COMPLETE';
    state.kitchenRecentlyCompleted[id] = true;
    renderKitchen();
    try {
      var result = null;
      if (isConfiguredUrl()) result = await api('kitchenUpdate', { KitchenID: id, CompleteAll: true });
      else if (!canUseLocalTestMode()) throw new Error('Google Script URL is not configured.');
      if (result && result.saved) {
        k.Status = result.saved.Status || 'COMPLETE';
        k.PayloadJSON = result.saved.PayloadJSON || k.PayloadJSON;
      }
      state.status.write = 'OK';
      state.status.message = isConfiguredUrl() ? 'Kitchen ticket updated in Google Sheets' : 'Kitchen ticket updated locally for testing only';
      saveLocal();
      saveServerCache();
      setTimeout(function () {
        delete state.kitchenRecentlyCompleted[id];
        if (state.activeTab === 'Kitchen') render();
      }, 1800);
    } catch (err) {
      k.Status = previousStatus;
      k.PayloadJSON = previousPayloadJSON;
      delete state.kitchenRecentlyCompleted[id];
      state.status.mode = 'error';
      state.status.write = 'failed';
      state.status.message = 'Kitchen update failed: ' + err.message;
      toast('Kitchen update failed. Ticket remains open.');
    } finally {
      delete state.kitchenPendingUpdates[id];
      if (state.activeTab === 'Kitchen') render();
      renderStatus();
      if (isConfiguredUrl()) syncKitchenQueue({ silent: true });
    }
  }

  function renderAdmin() {
    var totalItems = (state.data.menuItems || []).length;
    var activeItems = (state.data.menuItems || []).filter(function (i) { return Core.active(i.Active); }).length;
    var totalCats = (state.data.categories || []).length;
    var totalPrompts = (state.data.prompts || []).length;
    $('main').innerHTML = '<section class="panel admin-page"><div class="admin-hero"><div><h2>Menu admin</h2><p class="help">Edit items, categories and item configuration from one cleaner screen. Saves still require Google Sheets confirmation.</p></div><div class="admin-summary"><div><strong>' + activeItems + '</strong><span>active items</span></div><div><strong>' + totalItems + '</strong><span>total items</span></div><div><strong>' + totalCats + '</strong><span>categories</span></div><div><strong>' + totalPrompts + '</strong><span>prompts</span></div></div></div>' +
      '<div class="admin-tabs"><button class="pill-btn' + (state.adminMode === 'items' ? ' active' : '') + '" data-action="admin-mode" data-mode="items">Menu items</button><button class="pill-btn' + (state.adminMode === 'categories' ? ' active' : '') + '" data-action="admin-mode" data-mode="categories">Categories</button><button class="pill-btn' + (state.adminMode === 'deleted' ? ' active' : '') + '" data-action="admin-mode" data-mode="deleted">Deleted items</button><button class="secondary" data-action="export-menu-items">Download item list</button><button class="secondary" data-action="refresh-kitchen">Refresh from server</button></div>' +
      (state.adminMode === 'categories' ? renderCategoryLoader() : state.adminMode === 'deleted' ? renderDeletedItemsAdmin() : renderItemLoader()) + '</section>';
    if (state.adminMode === 'items') setTimeout(updateConfigurationSaveState, 0);
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
    if (selected && state.adminItemBaselineId !== selected.ItemID) captureAdminItemBaseline(selected.ItemID);
    return '<div class="admin-layout"><aside class="list-panel admin-sidebar"><div class="admin-sidebar-title"><strong>Find item</strong><button class="primary compact" data-action="new-item">+ New</button></div>' +
      '<select class="select" id="adminFilterCategory"><option value="">All categories</option>' + cats.map(function (c) { return '<option value="' + attr(c.CategoryID) + '"' + (state.adminFilterCategoryId === c.CategoryID ? ' selected' : '') + '>' + escapeHtml(c.CategoryName) + '</option>'; }).join('') + '</select>' +
      '<input class="input" id="adminSearch" placeholder="Search item name or description" value="' + attr(state.adminSearch) + '">' +
      '<div class="help">Showing ' + items.length + ' item' + (items.length === 1 ? '' : 's') + '</div>' +
      '<div class="admin-list-scroll">' + items.map(function (item) { var inactive = !Core.active(item.Active); return '<button class="list-btn' + (state.selectedItemId === item.ItemID ? ' active' : '') + (inactive ? ' inactive-admin-tile' : '') + '" data-action="select-admin-item" data-id="' + attr(item.ItemID) + '"><div class="not-active-sticker">NOT ACTIVE</div><div class="list-title">' + escapeHtml(item.ItemName) + '</div><div class="help">' + escapeHtml(categoryName(item.CategoryID) || 'No category') + ' • ' + Core.money(item.Price) + ' • ' + (Core.active(item.Active) ? 'Active' : 'Inactive') + '</div></button>'; }).join('') + '</div>' +
      '</aside><div class="admin-editor">' + (selected ? renderItemForm(selected) + renderItemConfiguration(selected) + renderItemConfigurationFooter() : '<div class="card empty-admin"><h3>Select or create an item</h3><p class="help">Choose an item from the left to edit its price, category and prompts.</p></div>') + '</div></div>';
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
      '<div class="row span2 admin-save-row"><button class="danger" data-action="delete-item">Delete item</button></div>' +
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

  function nextScopedSort(list, predicate) {
    var values = (list || []).filter(predicate).map(function (entry) { return Core.toNumber(entry.Sort, 0); });
    var maximum = values.length ? Math.max.apply(Math, values) : 0;
    return maximum + 10;
  }

  function orderControlButtons(kind, id, index, total) {
    return '<div class="order-controls" aria-label="Reorder ' + kind + '">' +
      '<button class="secondary compact order-button" data-action="move-' + kind + '-up" data-id="' + attr(id) + '"' + (index === 0 ? ' disabled' : '') + ' title="Move up">↑</button>' +
      '<span class="order-position">' + (index + 1) + ' of ' + total + '</span>' +
      '<button class="secondary compact order-button" data-action="move-' + kind + '-down" data-id="' + attr(id) + '"' + (index === total - 1 ? ' disabled' : '') + ' title="Move down">↓</button>' +
    '</div>';
  }

  function dirtyPromptOptionCount(promptId) {
    return Object.keys(state.dirtyPromptOptions || {}).filter(function (optionId) {
      var option = (state.data.promptOptions || []).find(function (entry) { return entry.OptionID === optionId; });
      return option && (!promptId || option.PromptID === promptId);
    }).length;
  }

  function hasDirtyPromptOptions() {
    return dirtyPromptOptionCount('') > 0;
  }

  function markPromptOptionDirty(optionId, original) {
    state.dirtyPromptOptions = state.dirtyPromptOptions || {};
    state.promptOptionOriginals = state.promptOptionOriginals || {};
    if (!Object.prototype.hasOwnProperty.call(state.promptOptionOriginals, optionId)) {
      state.promptOptionOriginals[optionId] = original ? Core.clone(original) : null;
    }
    state.dirtyPromptOptions[optionId] = true;
    var row = document.querySelector('[data-option-admin-id="' + cssEscape(optionId) + '"]');
    if (row) row.classList.add('unsaved-option-row');
    updatePromptOptionSaveButtons();
  }

  function updatePromptOptionSaveButtons() {
    Array.prototype.slice.call(document.querySelectorAll('[data-save-prompt-options]')).forEach(function (button) {
      var promptId = button.getAttribute('data-save-prompt-options');
      var count = dirtyPromptOptionCount(promptId);
      button.disabled = count === 0;
      button.textContent = count ? ('Save option changes (' + count + ')') : 'Option changes saved';
      button.classList.toggle('has-unsaved-changes', count > 0);
    });
    updateConfigurationSaveState();
    var warning = document.querySelector('[data-unsaved-option-warning]');
    if (warning) {
      var total = dirtyPromptOptionCount('');
      warning.hidden = total === 0;
      warning.textContent = total ? (total + ' unsaved prompt option change' + (total === 1 ? '' : 's') + '. Use Save Configuration before leaving this item.') : '';
    }
  }

  function readOptionRow(optionId) {
    var row = document.querySelector('[data-option-admin-id="' + cssEscape(optionId) + '"]');
    if (!row) return null;
    var existing = (state.data.promptOptions || []).find(function (o) { return o.OptionID === optionId; });
    var option = Object.assign({}, existing || { OptionID: optionId });
    Array.prototype.slice.call(row.querySelectorAll('[data-option-field]')).forEach(function (input) {
      var key = input.getAttribute('data-option-field');
      option[key] = input.type === 'checkbox' ? input.checked : input.value;
    });
    option.Price = Core.roundMoney(Core.toNumber(option.Price, 0));
    option.Sort = Core.toNumber(option.Sort, 0);
    // Preserve the saved state when Active is not represented by an editable control.
    // New options default to active, but existing inactive options must remain inactive.
    option.Active = existing && Object.prototype.hasOwnProperty.call(existing, 'Active') ? Core.active(existing.Active) : true;
    return option;
  }

  function discardPromptOptionChanges() {
    Object.keys(state.dirtyPromptOptions || {}).forEach(function (optionId) {
      var original = state.promptOptionOriginals[optionId];
      var index = (state.data.promptOptions || []).findIndex(function (entry) { return entry.OptionID === optionId; });
      if (original == null) {
        if (index >= 0) state.data.promptOptions.splice(index, 1);
      } else if (index >= 0) {
        state.data.promptOptions[index] = Core.clone(original);
      } else {
        state.data.promptOptions.push(Core.clone(original));
      }
    });
    state.dirtyPromptOptions = {};
    state.promptOptionOriginals = {};
  }

  async function confirmDiscardPromptOptionChanges() {
    if (!hasDirtyPromptOptions()) return true;
    var discard = await themedConfirm({ title: 'Discard unsaved option changes?', message: 'Your queued prompt option changes have not been saved to Google Sheets.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', tone: 'danger' });
    if (discard) discardPromptOptionChanges();
    return discard;
  }

  function normaliseAdminConfiguration(config) {
    config = config || {};
    function text(value) { return value == null ? '' : String(value).trim(); }
    function pickItem(item) {
      if (!item) return null;
      return {
        ItemID: text(item.ItemID),
        CategoryID: text(item.CategoryID),
        ItemName: text(item.ItemName),
        Description: text(item.Description),
        Price: Core.roundMoney(Core.toNumber(item.Price, 0)),
        Active: Core.active(item.Active),
        Sort: Core.toNumber(item.Sort, 0),
        LoyaltyEligible: Core.truthy(item.LoyaltyEligible)
      };
    }
    function pickPrompt(prompt) {
      return {
        PromptID: text(prompt.PromptID),
        TriggerItemID: text(prompt.TriggerItemID),
        PromptTitle: text(prompt.PromptTitle),
        PromptType: text(prompt.PromptType || 'single').toLowerCase(),
        Sort: Core.toNumber(prompt.Sort, 0),
        Required: Core.truthy(prompt.Required),
        AllowNotes: Core.truthy(prompt.AllowNotes),
        ShowTitleOnKDS: prompt.ShowTitleOnKDS === undefined || prompt.ShowTitleOnKDS === null || prompt.ShowTitleOnKDS === '' ? true : Core.truthy(prompt.ShowTitleOnKDS),
        Active: Core.active(prompt.Active)
      };
    }
    function pickOption(option) {
      return {
        OptionID: text(option.OptionID),
        PromptID: text(option.PromptID),
        OptionText: text(option.OptionText),
        Price: Core.roundMoney(Core.toNumber(option.Price, 0)),
        Sort: Core.toNumber(option.Sort, 0),
        Action: text(option.Action || 'Modifier'),
        AllowValue: Core.truthy(option.AllowValue),
        Active: Core.active(option.Active)
      };
    }
    return {
      item: pickItem(config.item),
      prompts: (config.prompts || []).map(pickPrompt).sort(function (a, b) { return bySort(a, b) || a.PromptID.localeCompare(b.PromptID); }),
      options: (config.options || []).map(pickOption).sort(function (a, b) { return a.PromptID.localeCompare(b.PromptID) || bySort(a, b) || a.OptionID.localeCompare(b.OptionID); })
    };
  }

  function configurationFromState(itemId) {
    var item = (state.data.menuItems || []).find(function (entry) { return entry.ItemID === itemId; });
    var prompts = (state.data.prompts || []).filter(function (entry) { return entry.TriggerItemID === itemId; });
    var promptIds = prompts.map(function (entry) { return entry.PromptID; });
    var options = (state.data.promptOptions || []).filter(function (entry) { return promptIds.indexOf(entry.PromptID) >= 0; });
    return normaliseAdminConfiguration({ item: item || null, prompts: prompts, options: options });
  }

  function captureAdminItemBaseline(itemId) {
    state.adminItemBaselineId = itemId || '';
    state.adminItemBaseline = itemId ? configurationFromState(itemId) : null;
    // A newly captured authoritative snapshot starts clean. Legacy per-field flags
    // must not leak into the unified configuration workflow.
    state.dirtyPromptOptions = {};
    state.promptOptionOriginals = {};
    state.adminDirty.item = {};
    state.adminDirty.prompt = {};
  }

  function collectAdminItemConfiguration() {
    var id = state.selectedItemId;
    var existingItem = (state.data.menuItems || []).find(function (entry) { return entry.ItemID === id; }) || {};
    var item = Object.assign({}, existingItem);
    if ($('itemId')) {
      var catId = $('itemCategory').value;
      item = { ItemID: $('itemId').value || id, CategoryID: catId, CategoryName: categoryName(catId), ItemName: $('itemName').value.trim(), Description: $('itemDescription').value.trim(), Price: Core.roundMoney(Core.toNumber($('itemPrice').value, 0)), Active: $('itemActive').checked, Sort: Core.toNumber($('itemSort').value, 0), LoyaltyEligible: $('itemLoyalty').checked };
    }
    var prompts = [];
    Array.prototype.slice.call(document.querySelectorAll('.prompt-admin-card')).forEach(function (card) {
      var prompt = { TriggerItemID: id };
      Array.prototype.slice.call(card.querySelectorAll('[data-prompt-field]')).forEach(function (input) {
        var key = input.getAttribute('data-prompt-field');
        prompt[key] = input.type === 'checkbox' ? input.checked : input.value;
      });
      prompt.Sort = Core.toNumber(prompt.Sort, 0);
      prompts.push(prompt);
    });
    if (!prompts.length) prompts = (state.data.prompts || []).filter(function (entry) { return entry.TriggerItemID === id; });
    var promptIds = prompts.map(function (entry) { return entry.PromptID; });
    var options = [];
    Array.prototype.slice.call(document.querySelectorAll('[data-option-admin-id]')).forEach(function (row) {
      var optionId = row.getAttribute('data-option-admin-id');
      var option = readOptionRow(optionId);
      if (option) options.push(option);
    });
    if (!options.length) options = (state.data.promptOptions || []).filter(function (entry) { return promptIds.indexOf(entry.PromptID) >= 0; });
    return normaliseAdminConfiguration({ item: item, prompts: prompts, options: options });
  }

  function stageAdminItemConfigurationFromDom() {
    if (state.activeTab !== 'Admin' || state.adminMode !== 'items' || !state.selectedItemId || !$('itemId')) return;
    var config = collectAdminItemConfiguration();
    if (config.item) upsertLocal('menuItems', 'ItemID', config.item);
    config.prompts.forEach(function (prompt) { upsertLocal('prompts', 'PromptID', prompt); });
    config.options.forEach(function (option) { upsertLocal('promptOptions', 'OptionID', option); });
  }

  function adminItemConfigurationDirty() {
    if (state.adminMode !== 'items' || !state.selectedItemId || !state.adminItemBaseline) return false;
    return JSON.stringify(collectAdminItemConfiguration()) !== JSON.stringify(state.adminItemBaseline);
  }

  function updateConfigurationSaveState() {
    var button = document.querySelector('[data-action="save-item-configuration"]');
    var status = document.querySelector('[data-configuration-save-status]');
    if (!button) return;
    var dirty = adminItemConfigurationDirty();
    button.disabled = !dirty;
    button.classList.toggle('has-unsaved-changes', dirty);
    button.textContent = dirty ? 'Save Configuration' : 'Configuration saved';
    if (status) { status.textContent = dirty ? 'Unsaved changes' : 'Configuration saved'; status.classList.toggle('dirty', dirty); }
    var discard = document.querySelector('[data-action="discard-item-configuration"]');
    if (discard) discard.disabled = !dirty;
  }

  function renderItemConfigurationFooter() {
    return '<div class="item-configuration-savebar"><div><strong data-configuration-save-status>Configuration saved</strong><div class="help">Saves item details, prompts and options together.</div></div><div class="row"><button class="secondary" data-action="discard-item-configuration" disabled>Discard changes</button><button class="primary" data-action="save-item-configuration" disabled>Configuration saved</button></div></div>';
  }

  function discardItemConfigurationChanges() {
    if (!state.adminItemBaseline) return;
    var id = state.adminItemBaselineId;
    var baseline = Core.clone(state.adminItemBaseline);
    state.data.menuItems = (state.data.menuItems || []).filter(function (entry) { return entry.ItemID !== id; });
    if (baseline.item) state.data.menuItems.push(baseline.item);
    var oldPromptIds = (state.data.prompts || []).filter(function (entry) { return entry.TriggerItemID === id; }).map(function (entry) { return entry.PromptID; });
    state.data.prompts = (state.data.prompts || []).filter(function (entry) { return entry.TriggerItemID !== id; }).concat(baseline.prompts || []);
    state.data.promptOptions = (state.data.promptOptions || []).filter(function (entry) { return oldPromptIds.indexOf(entry.PromptID) < 0; }).concat(baseline.options || []);
    state.dirtyPromptOptions = {};
    state.promptOptionOriginals = {};
    state.adminDirty.item = {};
    state.adminDirty.prompt = {};
    render();
  }

  async function saveItemConfiguration() {
    var config = collectAdminItemConfiguration();
    if (!config.item || !config.item.ItemName) { toast('Item needs a name.', 'warning'); return false; }
    var id = config.item.ItemID;
    try {
      await AdminSaveService.save({
        key: 'item-configuration:' + id,
        action: 'saveItemConfiguration',
        payload: { configuration: config },
        busyMessage: 'Saving the complete item configuration to Google Sheets.',
        reload: async function (response) {
          var authoritative = response && response.configuration ? normaliseAdminConfiguration(response.configuration) : config;
          state.data.menuItems = (state.data.menuItems || []).filter(function (entry) { return entry.ItemID !== id; });
          if (authoritative.item) state.data.menuItems.push(authoritative.item);
          var previousPromptIds = (state.data.prompts || []).filter(function (entry) { return entry.TriggerItemID === id; }).map(function (entry) { return entry.PromptID; });
          state.data.prompts = (state.data.prompts || []).filter(function (entry) { return entry.TriggerItemID !== id; }).concat(authoritative.prompts || []);
          state.data.promptOptions = (state.data.promptOptions || []).filter(function (entry) { return previousPromptIds.indexOf(entry.PromptID) < 0; }).concat(authoritative.options || []);
        },
        afterReload: function () {
          state.selectedItemId = id;
          state.dirtyPromptOptions = {};
          state.promptOptionOriginals = {};
          state.adminDirty.item = {};
          state.adminDirty.prompt = {};
          captureAdminItemBaseline(id);
          saveLocal(); saveServerCache(); render();
        },
        successMessage: isConfiguredUrl() ? 'Complete item configuration saved and reloaded from Google Sheets.' : 'Complete item configuration saved locally for testing only.',
        errorPrefix: 'Item configuration not saved'
      });
      return true;
    } catch (err) { return false; }
  }

  async function guardAdminNavigation() {
    var dirty = state.adminMode === 'items' ? adminItemConfigurationDirty() : Object.keys((state.adminDirty.category || {})).length > 0;
    if (!dirty) return true;
    var choice = await themedUnsavedChoice({ title: 'Unsaved changes', message: state.adminMode === 'items' ? 'This item configuration has changes that have not been saved.' : 'This category has changes that have not been saved.' });
    if (choice === 'stay') return false;
    if (choice === 'discard') {
      if (state.adminMode === 'items') discardItemConfigurationChanges();
      else { await reloadAdminAuthority(); state.adminDirty.category = {}; render(); }
      return true;
    }
    if (choice === 'save') return state.adminMode === 'items' ? await saveItemConfiguration() : await saveCategory().then(function () { return true; }).catch(function () { return false; });
    return false;
  }

  function renderItemConfiguration(item) {
    var prompts = (state.data.prompts || []).filter(function (p) { return p.TriggerItemID === item.ItemID; }).sort(bySort);
    var copyOptions = renderPromptCopyOptions(item.ItemID);
    return '<div class="card admin-card"><div class="section-title"><div><span class="step-badge">2</span><h3>Item configuration</h3></div><button class="secondary" data-action="add-prompt" data-id="' + attr(item.ItemID) + '">+ Add prompt</button></div>' +
      '<div class="help">Use prompts for add-ons, choices and upsells. Tick Qty on an option when staff should enter a quantity, such as 3 x sausage.</div><div class="unsaved-option-warning" data-unsaved-option-warning' + (hasDirtyPromptOptions() ? '' : ' hidden') + '>' + (hasDirtyPromptOptions() ? (dirtyPromptOptionCount('') + ' unsaved prompt option change' + (dirtyPromptOptionCount('') === 1 ? '' : 's') + '. Use Save Configuration before leaving this item.') : '') + '</div>' +
      '<div class="prompt-copy-panel"><div><strong>Copy prompts from another menu item</strong><div class="help">Items are grouped by category. Existing prompts on this item are kept; copied prompts receive new IDs.</div></div><div class="prompt-copy-controls"><select class="select" id="copyPromptsSource"><option value="">Select an item…</option>' + copyOptions + '</select><button class="secondary" data-action="copy-prompts" data-id="' + attr(item.ItemID) + '"' + (copyOptions ? '' : ' disabled') + '>Copy prompts</button></div></div>' +
      (prompts.length ? prompts.map(function (prompt, index) { return renderPromptAdminCard(prompt, index, prompts.length); }).join('') : '<div class="empty-admin"><h3>No prompts yet</h3><p class="help">Add a prompt or copy prompts from another menu item.</p></div>') + '</div>';
  }

  function renderPromptAdminCard(prompt, promptIndex, promptTotal) {
    var options = (state.data.promptOptions || []).filter(function (o) { return o.PromptID === prompt.PromptID; }).sort(bySort);
    var inactive = !Core.active(prompt.Active);
    return '<div class="prompt-admin-card' + (inactive ? ' inactive-admin-panel' : '') + '"><div class="not-active-sticker">NOT ACTIVE</div><div class="prompt-card-title"><div><strong>Prompt</strong><span class="help prompt-title-help">Question asked at the till</span></div>' + orderControlButtons('prompt', prompt.PromptID, promptIndex, promptTotal) + '</div><div class="form-grid clean-form">' +
      '<input type="hidden" data-prompt-field="PromptID" value="' + attr(prompt.PromptID) + '">' +
      '<input class="input" data-prompt-field="PromptTitle" aria-label="Prompt title" value="' + attr(prompt.PromptTitle) + '" placeholder="Prompt title">' +
      '<select class="select" data-prompt-field="PromptType"><option value="single"' + (prompt.PromptType === 'single' ? ' selected' : '') + '>Single choice</option><option value="multi"' + (prompt.PromptType === 'multi' ? ' selected' : '') + '>Multiple / quantity choice</option></select>' +
      '<input type="hidden" data-prompt-field="Sort" value="' + attr(prompt.Sort) + '">' +
      '<label class="switchline"><input type="checkbox" data-prompt-field="Required"' + (Core.truthy(prompt.Required) ? ' checked' : '') + '> Required</label>' +
      '<label class="switchline"><input type="checkbox" data-prompt-field="AllowNotes"' + (Core.truthy(prompt.AllowNotes) ? ' checked' : '') + '> Allow item note</label>' +
      '<label class="switchline"><input type="checkbox" data-prompt-field="ShowTitleOnKDS"' + (prompt.ShowTitleOnKDS === undefined || prompt.ShowTitleOnKDS === null || prompt.ShowTitleOnKDS === '' || Core.truthy(prompt.ShowTitleOnKDS) ? ' checked' : '') + '> Show prompt title on Kitchen Display</label>' +
      '<label class="switchline"><input type="checkbox" data-prompt-field="Active"' + (Core.active(prompt.Active) ? ' checked' : '') + '> Active</label>' +
      '<div class="row"><button class="danger" data-action="delete-prompt" data-id="' + attr(prompt.PromptID) + '">Delete prompt</button></div>' +
      '</div><h3>Options</h3>' +
      '<div class="prompt-option-column-headings" aria-hidden="true"><span>Position</span><span>Name</span><span>Price</span><span>Type</span><span>Quantity</span><span>Status / action</span></div>' +
      '<div class="prompt-options-sortable" data-prompt-options-list="' + attr(prompt.PromptID) + '">' + options.map(function (option, index) { return renderOptionAdminRow(option, index, options.length); }).join('') + '</div>' +
      '<div class="prompt-option-actions"><button class="secondary" data-action="add-option" data-id="' + attr(prompt.PromptID) + '">+ Add option</button></div>' +
    '</div>';
  }

  function renderOptionAdminRow(option, optionIndex, optionTotal) {
    return '<div class="option-admin-row' + (state.dirtyPromptOptions[option.OptionID] ? ' unsaved-option-row' : '') + '" data-option-admin-id="' + attr(option.OptionID) + '" data-prompt-id="' + attr(option.PromptID) + '">' +
      '<button type="button" class="option-drag-handle" aria-label="Drag to reorder" title="Drag to reorder">☰<span>' + (optionIndex + 1) + '</span></button>' +
      '<input class="input" data-option-field="OptionText" value="' + attr(option.OptionText) + '" placeholder="Option text">' +
      '<input class="input" data-option-field="Price" inputmode="decimal" value="' + attr(option.Price) + '" placeholder="Price">' +
      '<input type="hidden" data-option-field="Sort" value="' + attr(option.Sort) + '">' +
      '<select class="select" data-option-field="Action"><option' + (option.Action === 'Modifier' ? ' selected' : '') + '>Modifier</option><option' + (option.Action === 'none' ? ' selected' : '') + '>none</option></select>' +
      '<label class="switchline"><input type="checkbox" data-option-field="AllowValue"' + (Core.truthy(option.AllowValue) ? ' checked' : '') + '> Qty</label>' +
      '<div class="row"><span class="option-save-state">' + (state.dirtyPromptOptions[option.OptionID] ? 'Queued' : 'Saved') + '</span><button class="danger" data-action="delete-option" data-id="' + attr(option.OptionID) + '">Delete</button></div>' +
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
      '<div class="row span2 admin-save-row"><button class="primary" data-action="save-category" data-admin-save="category" disabled>Category changes saved</button><button class="danger" data-action="delete-category">Deactivate category</button></div>' +
    '</div></div>';
  }

  function setAdminDirty(type, id, dirty) {
    state.adminDirty = state.adminDirty || { item: {}, category: {}, prompt: {} };
    state.adminDirty[type] = state.adminDirty[type] || {};
    if (dirty) state.adminDirty[type][id || 'current'] = true;
    else delete state.adminDirty[type][id || 'current'];
    var selector = type === 'prompt' ? '[data-admin-save="prompt"][data-id="' + cssEscape(id) + '"]' : '[data-admin-save="' + type + '"]';
    var button = document.querySelector(selector);
    if (button) {
      button.classList.toggle('has-unsaved-changes', !!dirty);
      button.textContent = dirty ? ('Save ' + type + ' changes') : (type === 'item' ? 'Item changes saved' : type === 'category' ? 'Category changes saved' : 'Prompt changes saved');
      button.disabled = !dirty;
    }
  }

  function preserveDirtyPromptOptionsForReload() {
    return Object.keys(state.dirtyPromptOptions || {}).map(function (optionId) {
      var option = (state.data.promptOptions || []).find(function (entry) { return entry.OptionID === optionId; });
      return option ? Core.clone(option) : null;
    }).filter(Boolean);
  }

  async function reloadAdminAuthority() {
    if (!isConfiguredUrl()) return;
    var dirtyOptions = preserveDirtyPromptOptionsForReload();
    var response = await api('bootstrap');
    state.data = normaliseData(response.data || {});
    dirtyOptions.forEach(function (option) { upsertLocal('promptOptions', 'OptionID', option); });
    ensureActiveCategory();
  }

  var AdminSaveService = AdminSave.create({
    request: saveServerEntity,
    showBusy: showBusyMessage,
    hideBusy: hideBusyMessage,
    notify: toast,
    onError: persistFailed
  });

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
    if (!item.ItemName) { toast('Item needs a name.', 'warning'); return; }
    try {
      await AdminSaveService.save({
        key: 'item:' + id,
        action: 'saveItem',
        payload: { item: item },
        busyMessage: 'Saving this menu item to Google Sheets.',
        reload: async function () { if (isConfiguredUrl()) await reloadAdminAuthority(); else upsertLocal('menuItems', 'ItemID', item); },
        afterReload: function () { state.selectedItemId = id; setAdminDirty('item', id, false); saveLocal(); saveServerCache(); render(); },
        successMessage: isConfiguredUrl() ? 'Item saved and reloaded from Google Sheets.' : 'Item saved locally for testing only.',
        errorPrefix: 'Item not saved'
      });
    } catch (err) {}
  }

  async function saveCategory() {
    var id = $('categoryId').value || Core.uid('C');
    var category = { CategoryID: id, CategoryName: $('categoryName').value.trim(), Sort: Core.toNumber($('categorySort').value, 0), Active: $('categoryActive').checked, ButtonColour: $('categoryButtonColour').value.trim(), IsDrinkCategory: $('categoryIsDrink').checked };
    if (!category.CategoryName) { toast('Category needs a name.', 'warning'); return; }
    try {
      await AdminSaveService.save({
        key: 'category:' + id,
        action: 'saveCategory',
        payload: { category: category },
        busyMessage: 'Saving this category to Google Sheets.',
        reload: async function () { if (isConfiguredUrl()) await reloadAdminAuthority(); else upsertLocal('categories', 'CategoryID', category); },
        afterReload: function () { state.selectedCategoryId = id; setAdminDirty('category', id, false); saveLocal(); saveServerCache(); render(); },
        successMessage: isConfiguredUrl() ? 'Category saved and reloaded from Google Sheets.' : 'Category saved locally for testing only.',
        errorPrefix: 'Category not saved'
      });
    } catch (err) {}
  }

  async function savePrompt(promptId) {
    var button = document.querySelector('.prompt-admin-card [data-action="save-prompt"][data-id="' + cssEscape(promptId) + '"]');
    if (!button) { toast('Cannot find this prompt on the page.', 'error'); return; }
    var card = button.closest('.prompt-admin-card');
    var prompt = { PromptID: promptId, TriggerItemID: state.selectedItemId };
    Array.prototype.slice.call(card.querySelectorAll('[data-prompt-field]')).forEach(function (input) {
      var key = input.getAttribute('data-prompt-field');
      if (key === 'PromptID') return;
      prompt[key] = input.type === 'checkbox' ? input.checked : input.value;
    });
    prompt.Sort = Core.toNumber(prompt.Sort, 0);
    try {
      await AdminSaveService.save({
        key: 'prompt:' + promptId,
        action: 'savePrompt',
        payload: { prompt: prompt },
        busyMessage: 'Saving this item prompt to Google Sheets.',
        reload: async function () { if (isConfiguredUrl()) await reloadAdminAuthority(); else upsertLocal('prompts', 'PromptID', prompt); },
        afterReload: function () { setAdminDirty('prompt', promptId, false); saveLocal(); saveServerCache(); render(); },
        successMessage: isConfiguredUrl() ? 'Prompt saved and reloaded from Google Sheets.' : 'Prompt saved locally for testing only.',
        errorPrefix: 'Prompt not saved'
      });
    } catch (err) {}
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
    if (!(await themedConfirm({ title: 'Copy prompts?', message: 'Copy ' + sourcePrompts.length + ' prompt' + (sourcePrompts.length === 1 ? '' : 's') + ' from ' + label + ' to ' + (targetItem ? targetItem.ItemName : 'this item') + '. Existing prompts will be kept.', confirmLabel: 'Copy prompts', cancelLabel: 'Cancel', tone: 'info' }))) return;
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

  async function persistOrderedEntities(listName, idField, action, payloadKey, entries, message) {
    showBusyMessage('Saving — Please wait', message);
    try {
      for (var i = 0; i < entries.length; i++) {
        var payload = {};
        payload[payloadKey] = entries[i];
        await saveServerEntity(action, payload);
        upsertLocal(listName, idField, entries[i]);
      }
      saveLocal();
      saveServerCache();
      hideBusyMessage();
      render();
      toast('Order saved.');
    } catch (err) {
      hideBusyMessage();
      persistFailed('Order not saved', err);
    }
  }

  function movePrompt(promptId, direction) {
    var ordered = (state.data.prompts || []).filter(function (p) { return p.TriggerItemID === state.selectedItemId; }).sort(bySort);
    var index = ordered.findIndex(function (p) { return p.PromptID === promptId; });
    var target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    var temp = ordered[index]; ordered[index] = ordered[target]; ordered[target] = temp;
    ordered.forEach(function (p, i) { p.Sort = (i + 1) * 10; upsertLocal('prompts', 'PromptID', p); });
    render();
    updateConfigurationSaveState();
  }

  function applyPromptOptionOrder(promptId, optionIds) {
    optionIds.forEach(function (optionId, index) {
      var existing = (state.data.promptOptions || []).find(function (entry) { return entry.OptionID === optionId; });
      if (!existing || existing.PromptID !== promptId) return;
      markPromptOptionDirty(optionId, existing);
      var updated = Object.assign({}, existing, { Sort: (index + 1) * 10 });
      upsertLocal('promptOptions', 'OptionID', updated);
    });
    render();
    toast('Prompt option order updated. Use Save Configuration to write it to Google Sheets.');
  }

  function movePromptOption(optionId, direction) {
    var existing = (state.data.promptOptions || []).find(function (o) { return o.OptionID === optionId; });
    if (!existing) return;
    var ordered = (state.data.promptOptions || []).filter(function (o) { return o.PromptID === existing.PromptID; }).sort(bySort);
    var index = ordered.findIndex(function (o) { return o.OptionID === optionId; });
    var target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    var temp = ordered[index]; ordered[index] = ordered[target]; ordered[target] = temp;
    applyPromptOptionOrder(existing.PromptID, ordered.map(function (o) { return o.OptionID; }));
  }

  async function reloadPromptOptionsFromServer(savedPromptId) {
    if (!isConfiguredUrl()) return;
    var remainingDirtyIds = Object.keys(state.dirtyPromptOptions || {}).filter(function (optionId) {
      var option = (state.data.promptOptions || []).find(function (entry) { return entry.OptionID === optionId; });
      return option && option.PromptID !== savedPromptId;
    });
    var remainingDirtyOptions = remainingDirtyIds.map(function (optionId) {
      return Core.clone((state.data.promptOptions || []).find(function (entry) { return entry.OptionID === optionId; }));
    }).filter(Boolean);
    var response = await api('bootstrap');
    state.data = normaliseData(response.data || {});
    remainingDirtyOptions.forEach(function (option) { upsertLocal('promptOptions', 'OptionID', option); });
    ensureActiveCategory();
  }

  async function savePromptOptions(promptId) {
    var dirtyIds = Object.keys(state.dirtyPromptOptions || {}).filter(function (optionId) {
      var option = (state.data.promptOptions || []).find(function (entry) { return entry.OptionID === optionId; });
      return option && option.PromptID === promptId;
    });
    if (!dirtyIds.length) { toast('There are no queued option changes to save.'); return; }

    // Read the final visual order once. Intermediate drag positions are never sent to Google Sheets.
    var list = document.querySelector('[data-prompt-options-list="' + cssEscape(promptId) + '"]');
    var orderedIds = list ? Array.prototype.slice.call(list.querySelectorAll('[data-option-admin-id]')).map(function (row) {
      return row.getAttribute('data-option-admin-id');
    }) : (state.data.promptOptions || []).filter(function (entry) {
      return entry.PromptID === promptId;
    }).sort(bySort).map(function (entry) { return entry.OptionID; });

    var orderedOptions = orderedIds.map(function (optionId, index) {
      var rowOption = readOptionRow(optionId);
      var existing = (state.data.promptOptions || []).find(function (entry) { return entry.OptionID === optionId; });
      var option = Object.assign({}, existing || {}, rowOption || {});
      option.PromptID = promptId;
      option.Sort = (index + 1) * 10;
      upsertLocal('promptOptions', 'OptionID', option);
      return option;
    });

    showBusyMessage('Saving — Please wait', 'Saving the final prompt option order and changes to Google Sheets.');
    try {
      await api('savePromptOptionsBatch', { promptId: promptId, options: orderedOptions });
      orderedOptions.forEach(function (option) {
        delete state.dirtyPromptOptions[option.OptionID];
        delete state.promptOptionOriginals[option.OptionID];
      });
      await reloadPromptOptionsFromServer(promptId);
      saveLocal();
      saveServerCache();
      hideBusyMessage();
      render();
      toast(orderedOptions.length + ' prompt options saved in their final order and reloaded from Google Sheets.');
    } catch (err) {
      hideBusyMessage();
      render();
      persistFailed('Prompt option changes not saved', err);
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
    showBusyMessage('Saving — Please wait', 'Saving this prompt option to Google Sheets.');
    try {
      await saveServerEntity('savePromptOption', { option: option });
      upsertLocal('promptOptions', 'OptionID', option);
      saveLocal();
      saveServerCache();
      hideBusyMessage();
      render();
      toast(isConfiguredUrl() ? 'Option saved to Google Sheets.' : 'Option saved locally for testing only.');
    } catch (err) {
      hideBusyMessage();
      persistFailed('Option not saved', err);
    }
  }

  async function saveScriptUrlSetting() {
    var input = $('scriptUrl');
    var url = input ? input.value : '';
    showBusyMessage('Saving — Please wait', 'Saving and testing the Google Script URL.');
    try {
      setScriptUrl(url);
      await bootstrap();
      hideBusyMessage();
      if (state.serverReady) toast('Script URL saved and connection confirmed.');
      else toast('Script URL saved, but the connection test did not succeed.');
    } catch (err) {
      hideBusyMessage();
      persistFailed('Script URL not saved', err);
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
    toast(prefix + '. Nothing was marked as saved.', 'error');
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

  function diagnosticsResultHtml(result) {
    result = result || {};
    var status = String(result.status || 'NOT TESTED').toUpperCase();
    var cls = status === 'PASS' || status === 'READY' ? 'diagnostic-pass' : (status === 'WARN' ? 'diagnostic-warn' : (status === 'FAIL' ? 'diagnostic-fail' : 'diagnostic-idle'));
    return '<div class="diagnostic-result ' + cls + '"><strong>' + escapeHtml(status) + '</strong><span>' + escapeHtml(result.message || 'Run diagnostics to test this service.') + '</span>' + (result.detail ? '<small>' + escapeHtml(result.detail) + '</small>' : '') + '</div>';
  }

  function diagnosticsHtml() {
    var d = state.diagnostics || {};
    var r = d.results || {};
    return '<h3>System diagnostics</h3><div class="card diagnostics-card"><div class="section-title"><div><h3>Live system checks</h3><div class="help">These checks test the deployed Apps Script and live spreadsheet. The email test sends a real message only when you press Send test email.</div></div><button class="primary" data-action="run-diagnostics"' + (d.running ? ' disabled' : '') + '>' + (d.running ? 'Testing…' : 'Run all checks') + '</button></div>' +
      '<div class="diagnostics-grid">' +
      '<div><h4>Network and server</h4>' + diagnosticsResultHtml(r.network) + '</div>' +
      '<div><h4>Database read</h4>' + diagnosticsResultHtml(r.databaseRead) + '</div>' +
      '<div><h4>Database write</h4>' + diagnosticsResultHtml(r.databaseWrite) + '</div>' +
      '<div><h4>Kitchen display data</h4>' + diagnosticsResultHtml(r.kitchen) + '</div>' +
      '<div><h4>Version compatibility</h4>' + diagnosticsResultHtml(r.versions) + '</div>' +
      '<div><h4>Email service</h4>' + diagnosticsResultHtml(r.email) + '</div>' +
      '<div><h4>Browser storage</h4>' + diagnosticsResultHtml(r.storage) + '</div>' +
      '<div><h4>Printing</h4>' + diagnosticsResultHtml(r.printing) + '<button class="secondary compact" data-action="test-print">Open print test</button></div>' +
      '</div>' +
      '<div class="diagnostic-email-test"><label><span>Test email recipient</span><input class="input" id="diagnosticEmail" type="email" placeholder="name@example.com"></label><button class="secondary" data-action="test-email">Send test email</button></div>' +
      '<div class="help">Last run: ' + escapeHtml(d.updatedAt ? formatDate(d.updatedAt) : 'Not run yet') + (d.error ? ' • ' + escapeHtml(d.error) : '') + '</div></div>';
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
      '<h3>Database maintenance</h3><div class="cards"><div class="card"><h3>Schema status</h3><div class="item-price">' + (schemaOk ? 'OK' : 'Check') + '</div><p class="help">Startup is read-only. Repairs run only after you preview and explicitly approve them.</p></div><div class="card span2"><h3>Repair preview / last result</h3>' + repairHtml + '</div></div>' +
      '<div class="row"><button class="secondary" data-action="preview-database-repair">Preview required changes</button><button class="primary" data-action="repair-database">Apply additive repair</button><button class="secondary" data-action="refresh">Reload status</button></div><p class="help"><strong>Safety:</strong> the repair may create missing sheets, append missing columns, create missing settings and update version metadata. It will not delete or overwrite existing sales, items, prompts, options, staff or settings values.</p>' +
      '<h3>Kitchen display</h3><div class="card"><label class="switchline"><input type="checkbox" id="kitchenDisplayEnabled"' + (kitchenDisplayEnabled() ? ' checked' : '') + '> Enable Kitchen Ticket Display</label><div class="help">When switched off, kitchen polling stops and newly paid tickets are not added to the kitchen queue. Sales, receipts and reports continue normally.</div><div class="kitchen-settings-grid"><label class="switchline"><input type="checkbox" id="kitchenAgeEnabled"' + (kitchenAgeEnabled() ? ' checked' : '') + '> Show ticket age timer</label><label class="switchline"><input type="checkbox" id="kitchenPromptTitlesEnabled"' + (kitchenPromptTitlesEnabled() ? ' checked' : '') + '> Show prompt titles</label><label><span>Warning after (minutes)</span><input class="input" id="kitchenAgeWarning" inputmode="numeric" min="1" value="' + attr(kitchenAgeWarningMinutes()) + '"></label><label><span>Overdue after (minutes)</span><input class="input" id="kitchenAgeOverdue" inputmode="numeric" min="2" value="' + attr(kitchenAgeOverdueMinutes()) + '"></label><label><span>Timer style</span><select class="input" id="kitchenAgeFormat"><option value="seconds"' + (kitchenAgeFormat() === 'seconds' ? ' selected' : '') + '>Minutes and seconds</option><option value="minutes"' + (kitchenAgeFormat() === 'minutes' ? ' selected' : '') + '>Minutes only</option></select></label></div><div class="help">New kitchen tickets briefly fade green. Warning and overdue borders are calculated locally, so the timer does not create extra Google Sheets requests.</div><div class="row"><button class="primary" data-action="save-kitchen-setting">Save kitchen settings</button></div></div>' +
      '<h3>Staff discount</h3><div class="form-grid"><label><span>Staff discount percentage</span><input class="input" id="staffDiscountPercent" inputmode="decimal" value="' + attr(staffDiscountPercent()) + '" placeholder="e.g. 10"></label><button class="primary" data-action="save-staff-discount">Save staff discount</button><div class="help span2">This percentage is used by the Staff Discount button on the till. The discount is taken off before cash/change is calculated and is reported under Discount given.</div></div>' +
      diagnosticsHtml() +
      '<h3>Version diagnostics</h3>' + versionDiagnosticsHtml() + '<p class="help">The browser and Apps Script must report the same application version. The database schema has its own independently managed version.</p>' +
      '<h3>Safety</h3><p class="help">Payments, refunds, held orders, kitchen updates and admin changes only become saved after Google Sheets confirms them. Browser storage is used only for the unfinished basket and a downloadable backup/debug copy.</p>' +
      '<div class="row"><button class="secondary" data-action="download-backup">Download local backup JSON</button><button class="danger" data-action="clear-local-data">Clear local draft/cache</button></div></section>';
  }

  function localDiagnosticResults(server) {
    var storageResult;
    try {
      var key = 'nook_diagnostic_' + Date.now();
      localStorage.setItem(key, 'ok');
      var ok = localStorage.getItem(key) === 'ok';
      localStorage.removeItem(key);
      storageResult = { status: ok ? 'PASS' : 'FAIL', message: ok ? 'Local draft storage is available.' : 'Local storage did not return the saved test value.' };
    } catch (err) {
      storageResult = { status: 'FAIL', message: 'Browser storage is unavailable.', detail: String(err.message || err) };
    }
    var printResult = typeof window.print === 'function'
      ? { status: 'READY', message: 'Browser printing is available. Use Open print test to verify the configured printer.' }
      : { status: 'FAIL', message: 'This browser does not expose a print function.' };
    server = server || {};
    server.storage = storageResult;
    server.printing = printResult;
    return server;
  }

  async function runDiagnostics() {
    if (state.diagnostics.running) return;
    state.diagnostics.running = true;
    state.diagnostics.error = '';
    renderSettings();
    var started = Date.now();
    try {
      var res = await api('diagnosticsRun');
      var results = localDiagnosticResults(res.results || {});
      if (results.network) results.network.detail = (results.network.detail ? results.network.detail + ' • ' : '') + (Date.now() - started) + ' ms round trip';
      state.diagnostics.results = results;
      state.diagnostics.updatedAt = new Date().toISOString();
    } catch (err) {
      state.diagnostics.error = String(err.message || err);
      state.diagnostics.results = localDiagnosticResults({ network: { status: 'FAIL', message: 'Could not reach the deployed Apps Script.', detail: state.diagnostics.error } });
      state.diagnostics.updatedAt = new Date().toISOString();
    }
    state.diagnostics.running = false;
    renderSettings();
  }

  async function testDiagnosticEmail(button) {
    var input = $('diagnosticEmail');
    var email = String(input && input.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid test email address.'); return; }
    if (button) button.disabled = true;
    showBusyMessage('Sending test email', 'Checking Apps Script email authorisation');
    try {
      var res = await api('diagnosticsEmailTest', { email: email });
      state.diagnostics.results = state.diagnostics.results || {};
      state.diagnostics.results.email = { status: 'PASS', message: 'Test email sent successfully.', detail: 'Remaining daily quota: ' + res.remainingQuota };
      state.diagnostics.updatedAt = new Date().toISOString();
      hideBusyMessage();
      renderSettings();
      toast('Diagnostic email sent to ' + email + '.');
    } catch (err) {
      hideBusyMessage();
      state.diagnostics.results = state.diagnostics.results || {};
      state.diagnostics.results.email = { status: 'FAIL', message: 'Email test failed.', detail: String(err.message || err) };
      state.diagnostics.updatedAt = new Date().toISOString();
      renderSettings();
      toast('Email test failed. Open Apps Script and run authoriseEmailService once.');
    }
  }

  function openPrintDiagnostic() {
    var win = window.open('', '_blank', 'width=420,height=640');
    if (!win) { toast('The browser blocked the print-test window. Allow pop-ups and try again.'); return; }
    var now = new Date().toLocaleString('en-GB');
    win.document.write('<!doctype html><html><head><title>The Nook Print Test</title><style>body{font-family:monospace;max-width:320px;margin:20px auto}h1{text-align:center;font-size:20px}hr{border:0;border-top:1px dashed #000}.centre{text-align:center}</style></head><body><h1>THE NOOK</h1><div class="centre">EPOS PRINT DIAGNOSTIC</div><hr><p>Date: ' + escapeHtml(now) + '</p><p>Browser version: ' + escapeHtml(CONFIG.frontendVersion || '') + '</p><p>If this page prints clearly, browser printing is available.</p><hr><p class="centre">*** TEST COMPLETE ***</p><script>window.onload=function(){window.print();};<\/script></body></html>');
    win.document.close();
    state.diagnostics.results = state.diagnostics.results || {};
    state.diagnostics.results.printing = { status: 'READY', message: 'Print dialog opened. Confirm the correct receipt printer and paper size.' };
  }

  async function saveKitchenDisplaySetting() {
    var input = $('kitchenDisplayEnabled');
    var enabled = !!(input && input.checked);
    var ageEnabled = !!($('kitchenAgeEnabled') && $('kitchenAgeEnabled').checked);
    var promptTitlesEnabled = !!($('kitchenPromptTitlesEnabled') && $('kitchenPromptTitlesEnabled').checked);
    var warningMinutes = Math.max(1, Core.toNumber(($('kitchenAgeWarning') || {}).value, 10));
    var overdueMinutes = Math.max(warningMinutes + 1, Core.toNumber(($('kitchenAgeOverdue') || {}).value, 15));
    var ageFormat = String((($('kitchenAgeFormat') || {}).value) || 'seconds') === 'minutes' ? 'minutes' : 'seconds';
    showBusyMessage('Saving', 'Please wait');
    try {
      await saveServerEntity('saveSetting', { key: 'KitchenDisplayEnabled', value: enabled ? 'TRUE' : 'FALSE' });
      await saveServerEntity('saveSetting', { key: 'KitchenAgeEnabled', value: ageEnabled ? 'TRUE' : 'FALSE' });
      await saveServerEntity('saveSetting', { key: 'KitchenPromptTitlesEnabled', value: promptTitlesEnabled ? 'TRUE' : 'FALSE' });
      await saveServerEntity('saveSetting', { key: 'KitchenAgeWarningMinutes', value: String(warningMinutes) });
      await saveServerEntity('saveSetting', { key: 'KitchenAgeOverdueMinutes', value: String(overdueMinutes) });
      await saveServerEntity('saveSetting', { key: 'KitchenAgeFormat', value: ageFormat });
      state.data.settings = state.data.settings || {};
      state.data.settings.KitchenDisplayEnabled = enabled;
      state.data.settings.KitchenAgeEnabled = ageEnabled;
      state.data.settings.KitchenPromptTitlesEnabled = promptTitlesEnabled;
      state.data.settings.KitchenAgeWarningMinutes = warningMinutes;
      state.data.settings.KitchenAgeOverdueMinutes = overdueMinutes;
      state.data.settings.KitchenAgeFormat = ageFormat;
      if (!enabled) {
        state.data.kitchenQueue = [];
        state.kitchenPendingUpdates = {};
        state.kitchenRecentlyCompleted = {};
      }
      saveLocal();
      saveServerCache();
      hideBusyMessage();
      render();
      toast(enabled ? 'Kitchen display settings saved.' : 'Kitchen Ticket Display switched off.');
    } catch (err) {
      hideBusyMessage();
      persistFailed('Kitchen display setting not saved', err);
    }
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
    if (!(await themedConfirm({ title: 'Delete ' + label + '?', message: 'It will be moved to DeletedItems and removed from the active database and user interface.' + cascade, confirmLabel: 'Delete', cancelLabel: 'Cancel', tone: 'danger' }))) return;
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

  async function previewDatabaseRepair() {
    if (!isConfiguredUrl()) { toast('Add the Google Script URL first.'); return null; }
    try {
      var res = await api('previewDatabaseRepair');
      state.lastDatabaseRepair = res.schema || null;
      state.databaseRepairPreview = res.schema || null;
      render();
      var count = (((res.schema || {}).changes) || []).length;
      toast(count ? ('Repair preview found ' + count + ' additive change(s).') : 'Database schema is already up to date.');
      return res.schema || null;
    } catch (err) {
      toast('Could not preview database repair: ' + String(err.message || err));
      return null;
    }
  }

  async function runDatabaseRepair() {
    if (!isConfiguredUrl()) {
      toast('Add the Google Script URL first.');
      return;
    }
    var preview = await previewDatabaseRepair();
    if (!preview) return;
    var changes = preview.changes || [];
    if (!changes.length) { toast('No database repair is required.'); return; }
    var message = 'Apply ' + changes.length + ' additive database change(s)?\n\n' + changes.slice(0, 12).join('\n') + (changes.length > 12 ? '\n+' + (changes.length - 12) + ' more' : '') + '\n\nExisting sales, items, prompts and user data will be retained.';
    if (!(await themedConfirm({ title: 'Apply database repair?', message: message, confirmLabel: 'Apply additive repair', cancelLabel: 'Cancel', tone: 'danger' }))) { toast('Database repair cancelled. No changes were made.'); return; }
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

  async function refresh() { await bootstrap({ preserveData: true }); toast(state.serverReady ? 'Server refresh complete.' : 'Server refresh failed or is not configured.'); }

  async function refreshKitchenOnly() {
    if (!isConfiguredUrl() || !state.serverReady) { toast('Kitchen refresh requires a live server connection.'); return; }
    await syncKitchenQueue({ silent: false });
    toast('Kitchen queue refreshed.');
  }

  document.addEventListener('click', async function (event) {
    var tabBtn = event.target.closest('[data-tab]');
    if (tabBtn) {
      var requestedTab = tabBtn.getAttribute('data-tab');
      if (state.activeTab === 'Admin' && requestedTab !== 'Admin' && !(await guardAdminNavigation())) return;
      state.activeTab = requestedTab;
      await openFocusedTab(requestedTab);
      updateKitchenPolling();
      return;
    }
    var modalBtn = event.target.closest('[data-modal-action]');
    if (modalBtn) {
      var ma = modalBtn.getAttribute('data-modal-action');
      if (ma === 'close') closeModal();
      if (ma === 'select-order-type') selectOrderType(modalBtn.getAttribute('data-order-type'));
      if (ma === 'cancel-order-type') cancelOrderTypePrompt();
      if (ma === 'add-configured') addConfiguredItem(modalBtn.getAttribute('data-item-id'));
      if (ma === 'confirm-payment') confirmPaymentFromPrompt(modalBtn.getAttribute('data-method'));
      if (ma === 'report-code-digit') editReportClearPasscode('digit', modalBtn.getAttribute('data-digit'));
      if (ma === 'report-code-delete') editReportClearPasscode('delete');
      if (ma === 'report-code-clear') editReportClearPasscode('clear');
      if (ma === 'report-code-submit') submitClearReportsPasscode();
      if (ma === 'send-receipt-email') sendReceiptEmail(modalBtn.getAttribute('data-ticket-id'), modalBtn);
      if (ma === 'email-saved-receipt') openEmailReceiptModal(modalBtn.getAttribute('data-ticket-id'));
      if (ma === 'refund-minus') editRefundQuantity(modalBtn.getAttribute('data-ticket-item-id'), -1);
      if (ma === 'refund-plus') editRefundQuantity(modalBtn.getAttribute('data-ticket-item-id'), 1);
      if (ma === 'process-item-refund') processItemRefund(modalBtn.getAttribute('data-ticket-id'), modalBtn);
      if (ma === 'cash-digit') editCashKeypad('digit', modalBtn.getAttribute('data-digit'));
      if (ma === 'cash-delete') editCashKeypad('delete');
      if (ma === 'cash-clear') editCashKeypad('clear');
      if (ma === 'cash-accept') acceptCashKeypad();
      if (ma === 'option-plus' || ma === 'option-minus') {
        var input = document.querySelector('[data-option-qty="' + cssEscape(modalBtn.getAttribute('data-option-id')) + '"]');
        if (input) {
          var next = Core.toNumber(input.value, 0) + (ma === 'option-plus' ? 1 : -1);
          input.value = Math.max(0, next);
        }
      }
      return;
    }
    var btn = event.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var id = btn.getAttribute('data-id');
    if (action === 'set-category') { state.activeCategoryId = id; render(); }
    if (action === 'add-item') requestAddItem(id);
    if (action === 'line-minus') { var i = +btn.getAttribute('data-index'); Core.setLineQuantity(state.cart[i], Core.toNumber(state.cart[i].Quantity, 1) - 1); state.pendingPaymentRequestId = ''; saveLocal(); render(); }
    if (action === 'line-plus') { var ip = +btn.getAttribute('data-index'); Core.setLineQuantity(state.cart[ip], Core.toNumber(state.cart[ip].Quantity, 1) + 1); state.pendingPaymentRequestId = ''; saveLocal(); render(); }
    if (action === 'remove-line') { state.cart.splice(+btn.getAttribute('data-index'), 1); state.pendingPaymentRequestId = ''; if (!state.cart.length) resetCurrentOrderState({ keepServerName: true }); saveLocal(); render(); }
    if (action === 'clear-cart') { resetCurrentOrderState({ keepServerName: true }); saveLocal(); render(); }
    if (action === 'toggle-staff-discount') { state.ticketMeta.StaffDiscountApplied = !(staffDiscountApplied() && staffDiscountPercent() > 0); state.pendingPaymentRequestId = ''; saveLocal(); render(); }
    if (action === 'toggle-loyalty') { var loyaltyResult = applyLoyaltyToBestEligibleLine(); state.pendingPaymentRequestId = ''; saveLocal(); render(); toast(loyaltyResult.message); }
    if (action === 'open-cash-keypad') openCashKeypad();
    if (action === 'pay-cash') {
      if (state.ticketMeta.CashPaid === '' || state.ticketMeta.CashPaid == null) openCashKeypad();
      else takePayment('Cash');
    }
    if (action === 'pay-card') takePayment('Card');
    if (action === 'hold-current') holdCurrent();
    if (action === 'recall-held') recallHeld(id);
    if (action === 'delete-held') deleteHeld(id);
    if (action === 'refresh') refresh();
    if (action === 'refresh-kitchen') refreshKitchenOnly();
    if (action === 'refresh-reports') refreshReportsData();
    if (action === 'refresh-ticket-history') refreshTicketHistoryData();
    if (action === 'history-today') { state.historyDate = todayDateString(new Date()); renderLiveTickets(); refreshTicketHistoryData(); }
    if (action === 'report-today') { state.reportFrom = todayDateString(new Date()); state.reportTo = state.reportFrom; renderReports(); refreshReportsData(); }
    if (action === 'export-reports') exportReports();
    if (action === 'export-menu-items') exportMenuItemsByCategory();
    if (action === 'clear-reports') openClearReportsKeypad();
    if (action === 'view-ticket') viewTicket(id);
    if (action === 'email-ticket') openEmailReceiptModal(id);
    if (action === 'refund-ticket') openRefundModal(id);
    if (action === 'complete-kitchen') completeKitchen(id);
    if (action === 'complete-kitchen-section') updateKitchenSection(id, btn.getAttribute('data-section'), 'COMPLETE');
    if (action === 'reopen-kitchen-section') updateKitchenSection(id, btn.getAttribute('data-section'), 'OPEN');
    if (action === 'admin-mode') { if (btn.getAttribute('data-mode') !== state.adminMode && !(await guardAdminNavigation())) return; state.adminMode = btn.getAttribute('data-mode'); state.adminItemBaseline = null; state.adminItemBaselineId = ''; render(); }
    if (action === 'select-admin-item') { if (id !== state.selectedItemId && !(await guardAdminNavigation())) return; state.selectedItemId = id; state.adminItemBaseline = null; state.adminItemBaselineId = ''; render(); }
    if (action === 'select-admin-category') { if (id !== state.selectedCategoryId && !(await guardAdminNavigation())) return; state.selectedCategoryId = id; render(); }
    if (action === 'new-item') { if (!(await guardAdminNavigation())) return; var newCatId = state.adminFilterCategoryId || (categories()[0] || {}).CategoryID || ''; var newItem = { ItemID: Core.uid('I'), CategoryID: newCatId, CategoryName: categoryName(newCatId), ItemName: 'New item', Description: '', Price: 0, Active: true, Sort: 999, LoyaltyEligible: false }; upsertLocal('menuItems', 'ItemID', newItem); state.selectedItemId = newItem.ItemID; state.adminItemBaselineId = newItem.ItemID; state.adminItemBaseline = normaliseAdminConfiguration({ item: null, prompts: [], options: [] }); render(); updateConfigurationSaveState(); }
    if (action === 'new-category') { if (!(await guardAdminNavigation())) return; var newCat = { CategoryID: Core.uid('C'), CategoryName: 'New category', Sort: 999, Active: true, ButtonColour: '', IsDrinkCategory: false }; upsertLocal('categories', 'CategoryID', newCat); state.selectedCategoryId = newCat.CategoryID; render(); setAdminDirty('category', newCat.CategoryID, true); }
    if (action === 'save-item') saveItem();
    if (action === 'save-item-configuration') saveItemConfiguration();
    if (action === 'discard-item-configuration') discardItemConfigurationChanges();
    if (action === 'delete-item') archiveDeleteEntity('MenuItem', state.selectedItemId);
    if (action === 'save-category') saveCategory();
    if (action === 'delete-category') deactivateEntity('categories', 'CategoryID', state.selectedCategoryId, 'saveCategory', 'category');
    if (action === 'add-prompt') { var p = { PromptID: Core.uid('P'), TriggerItemID: id, PromptTitle: 'New prompt', PromptType: 'single', Required: false, Sort: nextScopedSort(state.data.prompts, function (entry) { return entry.TriggerItemID === id; }), Active: true, AllowNotes: false, ShowTitleOnKDS: true }; upsertLocal('prompts', 'PromptID', p); render(); updateConfigurationSaveState(); }
    if (action === 'copy-prompts') copyPromptsToItem(id);
    if (action === 'save-prompt') savePrompt(id);
    if (action === 'move-prompt-up') movePrompt(id, -1);
    if (action === 'move-prompt-down') movePrompt(id, 1);
    if (action === 'delete-prompt') archiveDeleteEntity('Prompt', id);
    if (action === 'add-option') { var o = { OptionID: Core.uid('O'), PromptID: id, OptionText: 'New option', Action: 'Modifier', Value: '', Price: 0, Sort: nextScopedSort(state.data.promptOptions, function (entry) { return entry.PromptID === id; }), Active: true, AllowValue: false }; upsertLocal('promptOptions', 'OptionID', o); markPromptOptionDirty(o.OptionID, null); render(); }
    if (action === 'move-option-up') movePromptOption(id, -1);
    if (action === 'move-option-down') movePromptOption(id, 1);
    if (action === 'save-option') saveOption(id);
    if (action === 'save-prompt-options') savePromptOptions(id);
    if (action === 'delete-option') archiveDeleteEntity('PromptOption', id);
    if (action === 'save-settings') saveScriptUrlSetting();
    if (action === 'save-staff-discount') saveStaffDiscountSetting();
    if (action === 'save-kitchen-setting') saveKitchenDisplaySetting();
    if (action === 'copy-confirmed-url') copyTextToClipboard((confirmedUrlInfo().url || getScriptUrl()));
    if (action === 'save-confirmed-url') saveConfirmedUrlManually();
    if (action === 'preview-database-repair') previewDatabaseRepair();
    if (action === 'repair-database') runDatabaseRepair();
    if (action === 'run-diagnostics') runDiagnostics();
    if (action === 'test-email') testDiagnosticEmail(btn);
    if (action === 'test-print') openPrintDiagnostic();
    if (action === 'download-backup') downloadBackup();
    if (action === 'clear-local-data') { clearLocalData(); state.cart = []; state.pendingPaymentRequestId = ''; state.ticketMeta.CashPaid = ''; state.ticketMeta.StaffDiscountApplied = false; toast('Local draft/cache cleared.'); bootstrap(); }
  });

  document.addEventListener('change', function (event) {
    if (event.target.id && /^item/.test(event.target.id)) setAdminDirty('item', state.selectedItemId || 'current', true);
    if (event.target.id && /^category/.test(event.target.id)) setAdminDirty('category', state.selectedCategoryId || 'current', true);
    var promptCard = event.target.closest('.prompt-admin-card');
    if (promptCard && event.target.getAttribute('data-prompt-field')) {
      var promptSave = promptCard.querySelector('[data-admin-save="prompt"]');
      if (promptSave) setAdminDirty('prompt', promptSave.getAttribute('data-id'), true);
    }
    var optionField = event.target.getAttribute('data-option-field');
    if (optionField) {
      var row = event.target.closest('[data-option-admin-id]');
      if (row) {
        var optionId = row.getAttribute('data-option-admin-id');
        var existing = (state.data.promptOptions || []).find(function (entry) { return entry.OptionID === optionId; });
        markPromptOptionDirty(optionId, existing);
        var changed = readOptionRow(optionId);
        if (changed) upsertLocal('promptOptions', 'OptionID', changed);
      }
    }
    if (state.activeTab === 'Admin' && state.adminMode === 'items') { stageAdminItemConfigurationFromDom(); setTimeout(updateConfigurationSaveState, 0); }
  });

  document.addEventListener('input', function (event) {
    if (event.target.id && /^item/.test(event.target.id)) setAdminDirty('item', state.selectedItemId || 'current', true);
    if (event.target.id && /^category/.test(event.target.id)) setAdminDirty('category', state.selectedCategoryId || 'current', true);
    var promptCard = event.target.closest('.prompt-admin-card');
    if (promptCard && event.target.getAttribute('data-prompt-field')) {
      var promptSave = promptCard.querySelector('[data-admin-save="prompt"]');
      if (promptSave) setAdminDirty('prompt', promptSave.getAttribute('data-id'), true);
    }
    var optionField = event.target.getAttribute('data-option-field');
    if (optionField) {
      var optionRow = event.target.closest('[data-option-admin-id]');
      if (optionRow) {
        var optionId = optionRow.getAttribute('data-option-admin-id');
        var existingOption = (state.data.promptOptions || []).find(function (entry) { return entry.OptionID === optionId; });
        markPromptOptionDirty(optionId, existingOption);
        var changedOption = readOptionRow(optionId);
        if (changedOption) upsertLocal('promptOptions', 'OptionID', changedOption);
      }
    }
    if (state.activeTab === 'Admin' && state.adminMode === 'items') { stageAdminItemConfigurationFromDom(); setTimeout(updateConfigurationSaveState, 0); }
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
    if (event.target.id === 'adminFilterCategory') { (async function () { if (!(await guardAdminNavigation())) { render(); return; } state.adminFilterCategoryId = event.target.value; state.selectedItemId = ''; state.adminItemBaseline = null; state.adminItemBaselineId = ''; render(); })(); }
    if (event.target.id === 'adminSearch') { state.adminSearch = event.target.value; render(); }
    if (event.target.id === 'reportFrom') { state.reportFrom = event.target.value; renderReports(); refreshReportsData(); }
    if (event.target.id === 'reportTo') { state.reportTo = event.target.value; renderReports(); refreshReportsData(); }
    if (event.target.id === 'historyDate') { state.historyDate = event.target.value || todayDateString(new Date()); renderLiveTickets(); refreshTicketHistoryData(); }
  });

  window.addEventListener('beforeunload', function (event) { if (state.activeTab === 'Admin' && (adminItemConfigurationDirty() || Object.keys((state.adminDirty.category || {})).length)) { event.preventDefault(); event.returnValue = ''; } });

  function downloadBackup() {
    var blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: state.data }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nook-epos-backup-' + (CONFIG.frontendVersion || 'unknown') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  var promptOptionDrag = null;

  document.addEventListener('pointerdown', function (event) {
    var handle = event.target.closest('.option-drag-handle');
    if (!handle) return;
    var row = handle.closest('[data-option-admin-id]');
    var list = row && row.closest('[data-prompt-options-list]');
    if (!row || !list) return;
    event.preventDefault();
    promptOptionDrag = { row: row, list: list, pointerId: event.pointerId };
    row.classList.add('dragging-option-row');
    handle.setPointerCapture(event.pointerId);
  });

  document.addEventListener('pointermove', function (event) {
    if (!promptOptionDrag || promptOptionDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    var target = document.elementFromPoint(event.clientX, event.clientY);
    var targetRow = target && target.closest('[data-option-admin-id]');
    if (!targetRow || targetRow === promptOptionDrag.row || targetRow.closest('[data-prompt-options-list]') !== promptOptionDrag.list) return;
    var rect = targetRow.getBoundingClientRect();
    var before = event.clientY < rect.top + rect.height / 2;
    promptOptionDrag.list.insertBefore(promptOptionDrag.row, before ? targetRow : targetRow.nextSibling);
  }, { passive: false });

  function finishPromptOptionDrag(event) {
    if (!promptOptionDrag || promptOptionDrag.pointerId !== event.pointerId) return;
    var drag = promptOptionDrag;
    promptOptionDrag = null;
    drag.row.classList.remove('dragging-option-row');
    var optionIds = Array.prototype.slice.call(drag.list.querySelectorAll('[data-option-admin-id]')).map(function (row) {
      return row.getAttribute('data-option-admin-id');
    });
    applyPromptOptionOrder(drag.list.getAttribute('data-prompt-options-list'), optionIds);
  }

  document.addEventListener('pointerup', finishPromptOptionDrag);
  document.addEventListener('pointercancel', finishPromptOptionDrag);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') runSyncCoordinator();
  });
  window.addEventListener('beforeunload', function (event) {
    stopSyncCoordinator();
    if (hasDirtyPromptOptions()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  window.setInterval(updateKitchenAgeIndicators, 1000);
  bootstrap();
})();

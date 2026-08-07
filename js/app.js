(function () {
  'use strict';

  var Core = window.NookCore;
  var Foundation = window.NookFoundation;
  var Models = window.NookModels;
  var Presentation = window.NookPresentation;
  var Operations = window.NookOperations;
  var QueueManager = window.NookQueueManager;
  var ServerCoordinatorModule = window.NookServerCoordinator;
  var AdminSave = window.NookAdminSave;
  var RELEASE = window.NOOK_RELEASE || {};
  var CONFIG = window.NOOK_CONFIG || {};
  if (!Foundation || !Models || !Presentation || !Operations || !AdminSave || !QueueManager || !ServerCoordinatorModule) throw new Error('Shared ePOS modules must load before app.js');
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
      { route: 'Local Tickets', label: 'Device Local Tickets' },
      { route: 'Admin', label: 'Menu Admin' },
      { route: 'Settings', label: 'Settings' }
    ] }
  ];
  var KITCHEN_POLL_INTERVAL_MS = RELEASE.kitchenPollIntervalMs || 1500;
  var KITCHEN_NORMAL_POLL_INTERVAL_MS = RELEASE.kitchenNormalPollIntervalMs || 3000;
  var KITCHEN_QUIET_POLL_INTERVAL_MS = RELEASE.kitchenQuietPollIntervalMs || 5000;
  var KITCHEN_RECENT_ACTIVITY_MS = RELEASE.kitchenRecentActivityMs || 60000;
  var KITCHEN_EXTENDED_QUIET_MS = RELEASE.kitchenExtendedQuietMs || 600000;
  var MENU_POLL_INTERVAL_MS = RELEASE.menuPollIntervalMs || 60000;
  var TILL_LIVE_POLL_INTERVAL_MS = RELEASE.tillLivePollIntervalMs || 3000;
  var SYNC_TICK_INTERVAL_MS = RELEASE.syncTickIntervalMs || 1000;
  var kitchenPollInFlight = false;
  var kitchenRefreshAgain = false;
  var kitchenPollEpoch = 0;
  var kitchenLastActivityAt = Date.now();
  var kitchenLastRequestDurationMs = 0;
  var menuPollInFlight = false;
  var tillLivePollInFlight = false;
  var ticketHistoryPollInFlight = false;
  var lastMenuSignature = '';
  var pendingMenuData = null;
  var hasConfirmedServerData = false;
  var hasUsableCachedData = false;
  var renderInProgress = false;
  var renderQueued = false;
  var wakeSyncInProgress = false;
  var lastRenderError = null;
  var renderBurstStartedAt = 0;
  var renderBurstCount = 0;
  var syncErrorState = { consecutive404: 0, pausedUntil: 0, last404Fingerprint: '' };
  // Current-health fault registry. Status-bar errors are transient: each failing subsystem
  // registers a fault and the matching successful retry clears it. System OK is shown only
  // when no operational fault remains.
  var activeSyncFaults = Object.create(null);
  var manualSyncPaused = false;
  var maintenanceActionActive = false;
  var syncPauseReason = '';
  var syncPauseAutoResumeTimer = null;
  var MANUAL_SYNC_AUTO_RESUME_MS = 30 * 60 * 1000;
  var visibilityResumeTimer = null;
  var wakeRecoveryGeneration = 0;
  var uiReadGeneration = 0;
  var WAKE_RECOVERY_WATCHDOG_MS = 12000;
  var LOCAL_TICKETS_KEY = 'nook_epos_device_local_tickets_v1';
  var LOCAL_MODE_KEY = 'nook_epos_device_local_mode_v1';
  var LOCAL_TICKET_LIMIT = 500;
  var startupConnectionAttempt = 0;
  var reconnectInFlight = false;
  var lastSuccessfulSyncAt = '';
  var reconnectDelayMs = 15000;
  var menuSyncFailureCount = 0;
  var consecutiveCoreSyncFailures = 0;
  var localTicketSyncInFlight = false;
  var localTicketStoreGeneration = 0;
  var localModeOfferShown = false;
  var localModeOfferPending = false;
  var menuRetryTimer = null;
  var activeReceiptBundle = null;
  var navExpanded = false;
  var navCollapseTimer = null;
  var NAV_AUTO_COLLAPSE_MS = 12000;
  var lastNavViewportWidth = window.innerWidth;
  window.addEventListener('resize', function () {
    var currentWidth = window.innerWidth;
    if (Math.abs(currentWidth - lastNavViewportWidth) >= 24 && navExpanded) setNavExpanded(false);
    lastNavViewportWidth = currentWidth;
  });
  // One guarded synchronisation manager owns every background read. Live writes such as
  // payments, refunds, held-order writes and kitchen completion remain immediate and separate.
  var liveSyncCoordinator = Operations.createPollCoordinator({
    tickIntervalMs: SYNC_TICK_INTERVAL_MS,
    jobs: [
      { name: 'kitchen', intervalMs: kitchenAdaptivePollInterval, enabled: function () { return kitchenSyncAllowed() && kitchenDisplayEnabled() && state.activeTab === 'Kitchen'; }, run: function () { return syncKitchenQueue({ silent: true }); } },
      { name: 'till-live', intervalMs: TILL_LIVE_POLL_INTERVAL_MS, enabled: function () { return backgroundSyncAllowed() && (state.activeTab === 'Till' || state.activeTab === 'Held'); }, run: syncTillLiveData },
      { name: 'menu-version', intervalMs: MENU_POLL_INTERVAL_MS, enabled: function () { return backgroundSyncAllowed() && ['Till','Held','Admin','Settings'].indexOf(state.activeTab) >= 0; }, run: syncMenuData },
      { name: 'ticket-history', intervalMs: 4000, enabled: function () { return backgroundSyncAllowed() && state.activeTab === 'Live Tickets'; }, run: syncTicketHistoryData },
      { name: 'durable-outbox', intervalMs: 2500, enabled: function () { return state.serverReady && isConfiguredUrl(); }, run: processDurableOutbox },
      { name: 'transaction-upload', intervalMs: 2000, enabled: function () { return state.serverReady && isConfiguredUrl() && localTickets().some(function (x) { return x.syncStatus !== 'SYNCED'; }); }, run: syncLocalTickets },
      { name: 'server-reconnect', intervalMs: 15000, enabled: function () { return isConfiguredUrl() && !state.serverReady && document.visibilityState !== 'hidden'; }, run: reconnectServer }
    ],
    onError: function (name, error) { console.warn(name + ' synchronisation retrying', error); }
  });
  var LiveSyncManager = {
    start: function () { liveSyncCoordinator.start(); },
    stop: function () { liveSyncCoordinator.stop(); },
    tick: function () { liveSyncCoordinator.tick(); }
  };

  var state = {
    activeTab: 'Till',
    activeCategoryId: '',
    tillLayoutEditMode: false,
    tillLayoutDirty: false,
    tillLayoutBaseline: null,
    tillLayoutDrag: null,
    adminMode: 'items',
    adminEditMode: 'view',
    adminEditEntityId: '',
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
    reportLoadedDate: '',
    reportComparisonAvailability: { previous: false, lastWeek: false },
    historyDate: todayDateString(new Date()),
    focusedRefresh: { reports: { inFlight: false, requestedDate: '', pendingDate: '', updatedAt: '', error: '', warning: '' }, history: { inFlight: false, updatedAt: '', error: '' } },
    diagnostics: { running: false, updatedAt: '', error: '', results: null },
    databaseRepairPreview: null,
    kitchenRecentlyCompleted: {},
    kitchenPendingUpdates: {},
    kitchenDeferredUpdates: {},
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
    localMode: false,
    dailyLocalTickets: [],
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
    return state.serverReady || hasUsableCachedData || canUseLocalTestMode() || localModeEnabled();
  }

  function emptyData() { return Models.emptyData(); }

  function localTickets() {
    try {
      var rows = JSON.parse(localStorage.getItem(LOCAL_TICKETS_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch (err) { return []; }
  }

  function saveLocalTickets(rows) {
    try { localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(Array.isArray(rows) ? rows : [])); }
    catch (err) { console.warn('Local ticket mirror could not be updated; IndexedDB remains authoritative', err); }
  }


  function dailyTicketDateString(record) {
    var value = record && (record.createdAt || (record.preview && record.preview.ticket && record.preview.ticket.CreatedAt));
    return ticketDateString(value || new Date().toISOString());
  }

  async function refreshDailyLocalTickets() {
    try {
      var rows = await QueueManager.dailyAll();
      if (!rows.length) {
        var legacyRows = await QueueManager.all();
        for (var m = 0; m < legacyRows.length; m++) await QueueManager.dailyPut(legacyRows[m]);
        rows = await QueueManager.dailyAll();
      }
      var retentionMs = 48 * 60 * 60 * 1000;
      var cutoff = Date.now() - retentionMs;
      for (var i = 0; i < rows.length; i++) {
        var createdAtMs = Date.parse(rows[i].createdAt || (rows[i].preview && rows[i].preview.ticket && rows[i].preview.ticket.CreatedAt) || '');
        var expired = isFinite(createdAtMs) && createdAtMs < cutoff;
        if (rows[i].syncStatus === 'SYNCED' && expired) {
          await QueueManager.removeTicketCopies(rows[i].clientRequestId);
        }
      }
      var durableRows = await QueueManager.all();
      saveLocalTickets(durableRows);
      state.dailyLocalTickets = (await QueueManager.dailyAll()).slice();
      return state.dailyLocalTickets;
    } catch (err) {
      console.warn('Daily local ticket store could not be refreshed', err);
      return state.dailyLocalTickets || [];
    }
  }

  async function saveDailyTicketRecord(record) {
    var daily = Object.assign({}, record, { retainedAt: new Date().toISOString() });
    await QueueManager.dailyPut(daily);
    var existing = (state.dailyLocalTickets || []).findIndex(function (x) { return x.clientRequestId === daily.clientRequestId; });
    if (existing >= 0) state.dailyLocalTickets[existing] = daily;
    else state.dailyLocalTickets.push(daily);
    return daily;
  }

  function localModeEnabled() {
    try { return state.localMode || localStorage.getItem(LOCAL_MODE_KEY) === 'true'; }
    catch (err) { return !!state.localMode; }
  }

  function setLocalMode(enabled) {
    state.localMode = !!enabled;
    try { localStorage.setItem(LOCAL_MODE_KEY, enabled ? 'true' : 'false'); } catch (err) {}
    state.status.mode = enabled ? 'local' : (state.serverReady ? 'live' : 'warn');
    state.status.write = enabled ? 'local queue' : state.status.write;
    state.status.message = enabled
      ? 'Device Local Mode active — paid tickets are stored on this device and uploaded when the server returns'
      : (state.serverReady ? 'Live server mode restored' : 'Local Mode switched off');
    renderStatus();
  }

  function localModeEligible() {
    return navigator.onLine === false || consecutiveCoreSyncFailures >= 4;
  }

  function maybeOfferLocalMode(reason) {
    if (localModeEnabled() || localModeOfferShown || !localModeEligible()) return;
    var root = $('modalRoot');
    if (!root) return;
    if (state.paymentInProgress || root.innerHTML) {
      localModeOfferPending = true;
      state.status.mode = 'warn';
      state.status.message = 'Connection unavailable — Device Local Mode can be enabled after the current Till action';
      renderStatus();
      return;
    }
    localModeOfferShown = true;
    localModeOfferPending = false;
    root.innerHTML = '<div class="modal-backdrop"><div class="modal"><h2>Connection unavailable</h2>' +
      '<p>' + escapeHtml(reason || 'The device cannot currently confirm a server connection.') + '</p>' +
      '<p><strong>Device Local Mode</strong> can continue taking payments and safely hold up to ' + LOCAL_TICKET_LIMIT + ' paid tickets on this device.</p>' +
      '<p class="help">Tickets use unique request IDs and will upload automatically when the server returns. Do not clear browser storage while tickets are waiting.</p>' +
      '<div class="row"><button class="secondary" data-modal-action="decline-local-mode">Keep retrying</button><button class="primary" data-modal-action="enable-local-mode">Use Device Local Mode</button></div></div></div>';
  }

  function buildLocalTicketRecord(payload, previewBundle) {
    return {
      localId: String(payload.clientRequestId || Core.uid('REQ')),
      clientRequestId: String(payload.clientRequestId || ''),
      createdAt: new Date().toISOString(),
      syncStatus: 'PENDING_SYNC',
      localStatus: 'OPEN',
      syncAttempts: 0,
      lastError: '',
      payload: payload,
      preview: previewBundle
    };
  }

  async function storeLocalPaidTicket(payload, previewBundle) {
    var rows = localTickets();
    var existing = rows.find(function (x) { return x.clientRequestId === payload.clientRequestId; });
    if (existing) return existing;
    if (rows.filter(function (x) { return x.syncStatus !== 'SYNCED'; }).length >= LOCAL_TICKET_LIMIT) {
      throw new Error('Device Local Ticket limit reached (' + LOCAL_TICKET_LIMIT + '). Reconnect and upload tickets before taking another payment.');
    }
    var record = buildLocalTicketRecord(payload, previewBundle);
    rows.push(record);
    await QueueManager.put(record);
    await saveDailyTicketRecord(record);
    saveLocalTickets(rows);
    return record;
  }

  async function syncLocalTickets() {
    if (localTicketSyncInFlight || !state.serverReady || !isConfiguredUrl()) return;
    localTicketSyncInFlight = true;
    var storeGeneration = localTicketStoreGeneration;
    try {
      var rows = await QueueManager.all();
      if (storeGeneration !== localTicketStoreGeneration) return;
      saveLocalTickets(rows);
      for (var i = 0; i < rows.length; i++) {
        if (storeGeneration !== localTicketStoreGeneration) return;
        var row = rows[i];
        if (row.syncStatus === 'SYNCED') continue;
        row.syncStatus = 'SYNCING';
        row.syncAttempts = Number(row.syncAttempts || 0) + 1;
        row.lastError = '';
        saveLocalTickets(rows);
        await QueueManager.put(row);
        if (storeGeneration !== localTicketStoreGeneration) return;
        try {
          var result = await api('commitTicket', { ticket: row.payload });
          if (storeGeneration !== localTicketStoreGeneration) return;
          row.syncStatus = 'SYNCED';
          row.syncedAt = new Date().toISOString();
          row.serverTicket = result.data;
          row.lastError = '';
          lastSuccessfulSyncAt = new Date().toISOString();
          state.serverReady = true;
          clearSyncFault('transaction-upload');
          mergeCommittedTicket(result.data);
        } catch (err) {
          if (storeGeneration !== localTicketStoreGeneration) return;
          markSyncFault('transaction-upload', err);
          row.syncStatus = 'PENDING_SYNC';
          row.lastError = err.message || String(err);
          await QueueManager.put(row);
          if (storeGeneration !== localTicketStoreGeneration) return;
          await saveDailyTicketRecord(row);
          saveLocalTickets(rows);
          // Keep the global connection state independent from this one queued write.
          // The next scheduled upload can retry while healthy Till/Kitchen reads continue.
          break;
        }
        await QueueManager.put(row);
        if (storeGeneration !== localTicketStoreGeneration) return;
        await saveDailyTicketRecord(row);
        saveLocalTickets(rows);
      }
      if (storeGeneration !== localTicketStoreGeneration) return;
      if (!localTickets().some(function (x) { return x.syncStatus !== 'SYNCED'; })) {
        if (localModeEnabled()) setLocalMode(false);
        state.status.write = 'OK';
        clearSyncFault('transaction-upload');
        recoverStatusIfHealthy();
        renderStatus();
      }
      await refreshDailyLocalTickets();
      if (state.activeTab === 'Local Tickets') renderLocalTickets();
    } finally {
      localTicketSyncInFlight = false;
    }
  }

  function saveLocal() {
    // Strict persistence rule: browser storage may keep the unfinished basket only.
    // Committed tickets, reports, admin data, held orders and kitchen state must come from Google Sheets.
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ cart: state.cart, ticketMeta: state.ticketMeta, pendingPaymentRequestId: state.pendingPaymentRequestId }));
    if (canUseLocalTestMode()) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: state.data }));
    }
  }

  function serverCacheData_() {
    // Keep only operational data needed to preserve a usable Till/KDS after a
    // connection failure. Reports and Ticket History are demand-loaded and must
    // not accumulate in localStorage across sessions.
    var cached = Core.clone(state.data || {});
    cached.tickets = [];
    cached.ticketItems = [];
    cached.ticketAddOns = [];
    cached.refunds = [];
    cached.refundItems = [];
    return cached;
  }

  function saveServerCache() {
    // Backup/debug copy only. It is never used as the live authority while strict persistence is enabled.
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data: serverCacheData_() }));
    } catch (err) {
      console.warn('Server cache save failed', err);
    }
  }

  function loadLastKnownGoodServerCache() {
    try {
      var cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cache || !cache.data) return false;
      var cached = normaliseData(cache.data);
      if (!validateMenuSnapshot(cached)) return false;
      state.data = cached;
      hasUsableCachedData = true;
      ensureActiveCategory();
      return true;
    } catch (err) {
      console.warn('Last-known-good cache restore failed', err);
      return false;
    }
  }

  function loadLocal() {
    try {
      state.localMode = localStorage.getItem(LOCAL_MODE_KEY) === 'true';
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

  function clearTransientScreenData() {
    localStorage.removeItem(CACHE_KEY);
    hasUsableCachedData = false;
    hasConfirmedServerData = false;
    pendingMenuData = null;
    lastMenuSignature = '';
    kitchenRevision = '';
    kitchenLastFullRefreshAt = 0;
    state.focusedRefresh.reports = { inFlight: false, updatedAt: '', error: '' };
    state.focusedRefresh.history = { inFlight: false, updatedAt: '', error: '' };
    state.data = Object.assign({}, state.data, {
      categories: [], menuItems: [], prompts: [], promptOptions: [], deletedItems: [],
      tickets: [], ticketItems: [], ticketAddOns: [], refunds: [], refundItems: [],
      kitchenQueue: [], heldOrders: []
    });
  }

  function appLocalStorageKeys() {
    var keys = [CACHE_KEY, DRAFT_KEY, CONFIG_KEY, LOCAL_TICKETS_KEY, LOCAL_MODE_KEY,
      'nook_epos_durable_outbox_v1', 'nook_epos_device_local_tickets_v1'];
    return keys.concat(LEGACY_CONFIG_KEYS, LEGACY_DRAFT_KEYS);
  }

  async function clearBrowserCacheStorage() {
    if (!window.caches || !window.caches.keys) return;
    var names = await window.caches.keys();
    await Promise.all(names.filter(function (name) { return /nook|epos/i.test(name); }).map(function (name) { return window.caches.delete(name); }));
  }

  async function refreshLocalDataWorkflow() {
    if (state.paymentInProgress) { toast('Finish the current payment before refreshing local data.', 'warning'); return; }
    showBusyMessage('Refreshing Local Data', 'Clearing cached menu, Reports, Ticket History and operational display data. Tickets and queued transactions are being kept.');
    stopSyncCoordinator();
    try {
      clearTransientScreenData();
      await clearBrowserCacheStorage();
      var ok = await bootstrap({ preserveData: true });
      if (!ok) throw new Error('The server could not provide refreshed data. The current Till and all local tickets/queues were kept.');
      state.status.message = state.serverReady ? 'System OK' : state.status.message;
      hideBusyMessage();
      startSyncCoordinator();
      render();
      toast('Local display data refreshed. Tickets and queued transactions were kept.');
    } catch (err) {
      hideBusyMessage();
      startSyncCoordinator();
      state.status.mode = 'warn';
      state.status.message = 'Local data refresh could not complete: ' + (err.message || String(err));
      renderStatus();
      toast('Local data refresh failed. No tickets or queued transactions were deleted.', 'error');
    }
  }

  async function repairConnectionWorkflow() {
    if (state.paymentInProgress) { toast('Finish the current payment before repairing the connection.', 'warning'); return; }
    var currentUrl = String(getScriptUrl() || '').trim();
    var confirmed = confirmedUrlInfo();
    var confirmedUrl = String(confirmed.url || '').trim();
    var originalUrl = currentUrl;
    showBusyMessage('Repairing Connection', 'Stopping background requests and testing the current server URL…');
    await beginSyncMaintenance('Repairing Connection');
    clearMenuRetryTimer();
    async function testCandidate(url, label) {
      if (!url || !/\/exec(?:\?|$)/i.test(url)) return null;
      setScriptUrl(url);
      showBusyMessage('Repairing Connection', 'Testing ' + label + ' (' + scriptUrlFingerprint(url) + ')…');
      var check = await api('connectionCheck', {});
      var versions = (check && check.versions) || {};
      var compatibility = releaseCompatibility(versions);
      if (!compatibility.backendCompatible) throw new Error('Backend version mismatch. Accepted ' + compatibility.acceptedBackends.join(', ') + ' but received ' + (versions.BackendVersion || 'unknown') + '.');
      if (!compatibility.databaseCompatible) throw new Error('Database version mismatch. Accepted ' + compatibility.acceptedDatabases.join(', ') + ' but received ' + (versions.DatabaseVersion || 'unknown') + '.');
      return { url: url, versions: versions };
    }
    try {
      syncErrorState.consecutive404 = 0;
      syncErrorState.pausedUntil = 0;
      syncErrorState.last404Fingerprint = '';
      await clearBrowserCacheStorage();
      var selected = null;
      var currentError = null;
      try { selected = await testCandidate(currentUrl, 'current device URL'); } catch (err) { currentError = err; }
      if (!selected && confirmedUrl && confirmedUrl !== currentUrl) {
        try { selected = await testCandidate(confirmedUrl, 'last confirmed fallback URL'); }
        catch (fallbackError) {
          throw new Error('Current URL failed: ' + friendlyServerError(currentError) + ' Fallback URL failed: ' + friendlyServerError(fallbackError));
        }
      }
      if (!selected) throw currentError || new Error('No valid Apps Script /exec URL is available. Enter the current deployment URL in Settings.');
      setScriptUrl(selected.url);
      showBusyMessage('Repairing Connection', 'Loading the latest operational data and resuming synchronisation…');
      var ok = await bootstrap({ resetData: true });
      if (!ok) throw new Error('The server URL responded, but operational data could not be loaded.');
      hideBusyMessage();
      endSyncMaintenance();
      recoverStatusIfHealthy();
      render();
      toast('Connection repaired using URL ' + scriptUrlFingerprint(selected.url) + '.');
    } catch (err) {
      if (originalUrl) setScriptUrl(originalUrl);
      hideBusyMessage();
      endSyncMaintenance();
      state.serverReady = false;
      state.status.mode = 'error';
      state.status.read = 'connection repair failed';
      state.status.write = 'local queue ready';
      state.status.message = 'Connection repair failed: ' + friendlyServerError(err);
      renderStatus();
      toast('Connection repair failed. Local tickets and queues remain safe.', 'error');
    }
  }

  async function factoryResetDeviceWorkflow() {
    var pendingTransactions = 0;
    var pendingOutbox = 0;
    try { pendingTransactions = await QueueManager.pendingCount(); } catch (err) {}
    try { pendingOutbox = await QueueManager.outboxPendingCount(); } catch (err) {}
    var warning = "This permanently removes this device's cached menu, unfinished basket, daily local tickets, pending transactions, queued receipt emails, local mode and device registration.";
    if (pendingTransactions || pendingOutbox) warning += ' WARNING: ' + pendingTransactions + ' transaction(s) and ' + pendingOutbox + ' queued action(s) have not synchronised.';
    var confirmed = await themedConfirm({ title: 'Factory Reset Device?', message: warning + ' This cannot be undone.', confirmText: 'Factory Reset Device', cancelText: 'Cancel', danger: true });
    if (!confirmed) return;
    var second = await themedConfirm({ title: 'Final confirmation', message: 'Remove all local ePOS data from this device now?', confirmText: 'Remove Everything', cancelText: 'Keep Device Data', danger: true });
    if (!second) return;
    showBusyMessage('Factory Reset Device', 'Removing local tickets, queues, cached data and device settings…');
    stopSyncCoordinator();
    try {
      if (QueueManager.clearAll) await QueueManager.clearAll();
      appLocalStorageKeys().forEach(function (key) { localStorage.removeItem(key); });
      await clearBrowserCacheStorage();
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        var registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(function (registration) { return registration.unregister(); }));
      }
      hideBusyMessage();
      window.location.reload();
    } catch (err) {
      hideBusyMessage();
      startSyncCoordinator();
      toast('Factory reset could not complete: ' + (err.message || String(err)), 'error');
    }
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
    frontendVersion: CONFIG.frontendVersion || 'unknown',
    readTimeoutMs: 10000,
    longReadTimeoutMs: 45000,
    writeTimeoutMs: 30000,
    longReadActions: ['bootstrap','serverInfo','connectionCheck','previewDatabaseRepair','diagnosticsRun']
  });

  function backgroundSyncAllowed() {
    return !manualSyncPaused && !maintenanceActionActive && state.serverReady && isConfiguredUrl() && document.visibilityState !== 'hidden' && Date.now() >= syncErrorState.pausedUntil;
  }


  function kitchenSyncAllowed() {
    return !manualSyncPaused && !maintenanceActionActive && state.serverReady && isConfiguredUrl() && document.visibilityState !== 'hidden' && Date.now() >= syncErrorState.pausedUntil;
  }

  function kitchenAdaptivePollInterval() {
    var quietFor = Math.max(0, Date.now() - kitchenLastActivityAt);
    if (quietFor < KITCHEN_RECENT_ACTIVITY_MS) return KITCHEN_POLL_INTERVAL_MS;
    if (quietFor < KITCHEN_EXTENDED_QUIET_MS) return KITCHEN_NORMAL_POLL_INTERVAL_MS;
    return KITCHEN_QUIET_POLL_INTERVAL_MS;
  }


  function scriptUrlFingerprint(url) {
    var text = String(url || '').trim();
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8).toUpperCase();
  }

  function friendlyServerError(err) {
    if (err && Number(err.status) === 404) {
      var fp = syncErrorState.last404Fingerprint || scriptUrlFingerprint(getScriptUrl());
      return 'Apps Script deployment not found (HTTP 404, URL ' + fp + '). Current Till data remains available.';
    }
    return String((err && err.message) || err || 'Server request failed');
  }

  function recordRequestSuccess() {
    syncErrorState.consecutive404 = 0;
    syncErrorState.pausedUntil = 0;
  }

  function recordRequestFailure(err) {
    if (err && Number(err.status) === 404) {
      syncErrorState.consecutive404 += 1;
      syncErrorState.last404Fingerprint = scriptUrlFingerprint(getScriptUrl());
      if (syncErrorState.consecutive404 >= 2) syncErrorState.pausedUntil = Date.now() + 30000;
    }
  }

  var ServerCoordinator = ServerCoordinatorModule.create({ transport: ApiClient, maxConcurrent: 3 });

  async function api(action, payload) {
    try {
      var result = await ServerCoordinator.request(action, payload, { allowDuringMaintenance: maintenanceActionActive === true });
      recordRequestSuccess();
      return result;
    } catch (err) {
      recordRequestFailure(err);
      throw err;
    }
  }

  function isStaleResponseError(err) {
    return !!err && (err.code === 'STALE_RESPONSE' || err.code === 'SYNC_PAUSED');
  }

  function waitMs(ms) { return new Promise(function (resolve) { window.setTimeout(resolve, ms); }); }

  async function requestBootstrapWithFourAttempts() {
    var delays = [0, 1000, 3000, 7000];
    var lastError = null;
    for (var attempt = 0; attempt < 4; attempt++) {
      startupConnectionAttempt = attempt + 1;
      if (delays[attempt]) await waitMs(delays[attempt]);
      state.status.mode = 'syncing';
      state.status.read = 'connection attempt ' + startupConnectionAttempt + ' of 4';
      state.status.message = 'Connecting to server — attempt ' + startupConnectionAttempt + ' of 4';
      renderStatus();
      try { return await api('bootstrap'); }
      catch (err) { lastError = err; }
    }
    throw lastError || new Error('Server unavailable after four attempts.');
  }

  async function reconnectServer() {
    if (reconnectInFlight || !isConfiguredUrl()) return;
    reconnectInFlight = true;
    try {
      var res = await api('bootstrap');
      state.serverReady = true;
      clearSyncFault('connection');
      hasConfirmedServerData = true;
      consecutiveCoreSyncFailures = 0;
      state.data = normaliseData(res.data || state.data || {});
      state.status.mode = 'live';
      state.status.read = 'OK';
      state.status.write = localTickets().some(function(x){ return x.syncStatus !== 'SYNCED'; }) ? 'syncing queue' : 'OK';
      state.status.message = 'Server restored — synchronising locally stored transactions';
      saveServerCache();
      renderStatus();
      await syncLocalTickets();
      clearSyncFault('connection');
      recoverStatusIfHealthy();
      renderStatus();
    } catch (err) {
      markSyncFault('connection', err);
      state.serverReady = false;
      state.status.mode = 'warn';
      state.status.read = 'retrying';
      state.status.message = 'Server unavailable — Till remains operational; retrying automatically';
      renderStatus();
    } finally { reconnectInFlight = false; }
  }

  async function bootstrap(options) {
    options = options || {};
    var preserveData = options.preserveData === true || (options.resetData !== true && hasConfirmedServerData);
    var previousData = state.data;
    var previousServerReady = state.serverReady;
    if (!preserveData) {
      state.serverReady = false;
      var restoredCache = !options.resetData && loadLastKnownGoodServerCache();
      if (!restoredCache) state.data = canUseLocalTestMode() ? Core.clone(window.NOOK_SEED || {}) : emptyData();
      loadLocal();
      ensureActiveCategory();
      if (restoredCache) {
        state.status = { mode: 'warn', read: 'reconnecting', write: 'local queue ready', backendVersion: '', databaseVersion: '', spreadsheetName: '', spreadsheetId: '', message: 'Showing last confirmed menu while reconnecting…' };
      }
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
      if (state.activeTab === 'Till' && !state.cart.length) scheduleOrderTypePrompt('till');
      return;
    }

    state.status = { mode: 'syncing', read: 'checking', write: 'local queue ready', backendVersion: '', databaseVersion: '', spreadsheetName: '', spreadsheetId: '', message: 'Connecting to Google Sheets…' };
    renderStatus();
    try {
      var res = await requestBootstrapWithFourAttempts();
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
        message: mode === 'error' ? ('Version mismatch: accepted backend ' + (CONFIG.acceptedBackendVersions || [CONFIG.backendVersion]).join(', ') + ' but server reports ' + (versions.BackendVersion || 'unknown') + '; accepted database ' + (CONFIG.acceptedDatabaseVersions || [CONFIG.databaseVersion]).join(', ') + ' and server reports ' + (versions.DatabaseVersion || 'unknown')) : ((schema.changes || []).length ? 'Loaded from Google Sheets - database repaired/updated' : 'Loaded from Google Sheets')
      };
      state.serverReady = state.status.mode !== 'error';
      hasConfirmedServerData = state.serverReady;
      hasUsableCachedData = state.serverReady;
      ensureActiveCategory();
      saveLocal();
      saveServerCache();
      render();
      if (state.activeTab === 'Till' && !state.cart.length) scheduleOrderTypePrompt('till');
      startSyncCoordinator();
      saveConfirmedUrlAfterGoodConnection(versions);
      return state.serverReady;
    } catch (err) {
      if (preserveData && previousServerReady) {
        state.serverReady = true;
        state.data = previousData;
        state.status.mode = 'warn';
        state.status.read = 'refresh failed';
        state.status.write = 'ready';
        state.status.message = 'Refresh failed — continuing with the last confirmed data: ' + err.message;
        renderStatus();
      } else if (hasUsableCachedData) {
        state.serverReady = false;
        state.status = { mode: 'warn', read: 'offline cache', write: 'local queue ready', backendVersion: '', databaseVersion: '', spreadsheetName: '', spreadsheetId: '', message: 'Connection failed — Till remains visible using the last confirmed menu. Payments will be stored locally and synchronised automatically: ' + err.message };
        render();
        if (state.activeTab === 'Till' && !state.cart.length) scheduleOrderTypePrompt('till');
      } else {
        state.serverReady = false;
        state.status = { mode: 'error', read: 'failed', write: 'blocked', backendVersion: '', databaseVersion: '', spreadsheetName: '', spreadsheetId: '', message: 'Server read failed: ' + err.message };
        // With no confirmed cache available, show a recovery panel rather than an empty JavaScript screen.
        render();
        if (state.activeTab === 'Till' && !state.cart.length) scheduleOrderTypePrompt('till');
      }
      return false;
    }
  }


  var kitchenRevision = '';
  var kitchenLastFullRefreshAt = 0;
  var KITCHEN_FULL_REFRESH_MS = 60000;

  function kitchenQueueSignature(queue) {
    return (queue || []).map(function (k) {
      return [k.KitchenID || '', k.Status || '', k.PayloadJSON || '', k.CreatedAt || ''].join('|');
    }).join('~');
  }

  async function syncKitchenQueue(options) {
    options = options || {};
    if (!kitchenDisplayEnabled() || !isConfiguredUrl() || !state.serverReady || document.visibilityState === 'hidden') return;
    if (kitchenPollInFlight) { kitchenRefreshAgain = true; return; }
    var pollEpoch = kitchenPollEpoch;
    kitchenPollInFlight = true;
    var requestGeneration = uiReadGeneration;
    var kitchenRequestStartedAt = Date.now();
    try {
      await retryDeferredKitchenUpdates();
      var before = kitchenQueueSignature(state.data.kitchenQueue);
      var forceFull = !kitchenLastFullRefreshAt || (Date.now() - kitchenLastFullRefreshAt >= KITCHEN_FULL_REFRESH_MS);
      var res = await api('kitchenSnapshot', { sinceRevision: kitchenRevision, forceFull: forceFull });
      if (requestGeneration !== uiReadGeneration || state.activeTab !== 'Kitchen') return;
      if (!res || !res.data) throw new Error('Invalid Kitchen snapshot — keeping existing tickets');
      if (res.data.unchanged === true) {
        kitchenRevision = String(res.data.revision || kitchenRevision || '');
        state.status.read = 'OK';
        clearSyncFault('kitchen');
        recoverStatusIfHealthy();
        if (state.activeTab === 'Kitchen') renderStatus();
        return;
      }
      if (!Array.isArray(res.data.kitchenQueue)) throw new Error('Invalid Kitchen snapshot — keeping existing tickets');
      var queue = res.data.kitchenQueue;
      kitchenRevision = String(res.data.revision || kitchenRevision || '');
      kitchenLastFullRefreshAt = Date.now();
      // Never let a polling response overwrite a ticket while its completion update is still pending.
      // The server response may have been generated immediately before the write acquired its lock.
      var currentById = {};
      (state.data.kitchenQueue || []).forEach(function (row) { currentById[row.KitchenID] = row; });
      queue = queue.map(function (row) {
        return (state.kitchenPendingUpdates[row.KitchenID] || state.kitchenDeferredUpdates[row.KitchenID]) && currentById[row.KitchenID] ? currentById[row.KitchenID] : row;
      });
      var after = kitchenQueueSignature(queue);
      state.data.kitchenQueue = queue;
      state.status.read = 'OK';
      clearSyncFault('kitchen');
      recoverStatusIfHealthy();
      if (before !== after) {
        kitchenLastActivityAt = Date.now();
        saveServerCache();
        if (state.activeTab === 'Kitchen') renderKitchen();
      }
      // A successful Kitchen read must visibly clear a previous Kitchen refresh error,
      // including silent background retries where the queue itself did not change.
      if (state.activeTab === 'Kitchen') renderStatus();
    } catch (err) {
      if (isStaleResponseError(err) || requestGeneration !== uiReadGeneration) return;
      markSyncFault('kitchen', err);
      state.status.read = 'kitchen retrying';
      state.status.message = 'Kitchen refresh failed: ' + friendlyServerError(err);
      if (state.activeTab === 'Kitchen') renderStatus();
    } finally {
      kitchenLastRequestDurationMs = Math.max(0, Date.now() - kitchenRequestStartedAt);
      if (pollEpoch !== kitchenPollEpoch) return;
      kitchenPollInFlight = false;
      if (kitchenRefreshAgain && document.visibilityState !== 'hidden') {
        kitchenRefreshAgain = false;
        window.setTimeout(function () { syncKitchenQueue({ silent: true }); }, 0);
      }
    }
  }

  function runSyncCoordinator() { LiveSyncManager.tick(); }

  function startSyncCoordinator() {
    LiveSyncManager.stop();
    if (!state.serverReady || !isConfiguredUrl()) return;
    lastMenuSignature = menuSignature(state.data);
    LiveSyncManager.start();
  }

  function stopSyncCoordinator() { LiveSyncManager.stop(); }

  function updateKitchenPolling() {
    if (state.activeTab === 'Kitchen' && document.visibilityState !== 'hidden') syncKitchenQueue({ silent: true });
    LiveSyncManager.tick();
  }

  function heldOrdersSignature(rows) {
    return JSON.stringify((rows || []).map(function (row) {
      return [row.HoldID || '', row.UpdatedAt || row.CreatedAt || '', row.PayloadJSON || '', row.OrderType || ''];
    }));
  }

  async function syncTillLiveData() {
    if (tillLivePollInFlight || !state.serverReady || !isConfiguredUrl() || document.visibilityState === 'hidden') return;
    tillLivePollInFlight = true;
    var requestGeneration = uiReadGeneration;
    var requestedTab = state.activeTab;
    try {
      var result = await api('tillLiveSnapshot');
      if (requestGeneration !== uiReadGeneration || state.activeTab !== requestedTab) return;
      consecutiveCoreSyncFailures = 0;
      localModeOfferShown = false;
      var incoming = result && result.data ? result.data : null;
      if (!incoming || !Array.isArray(incoming.heldOrders)) throw new Error('Invalid Till live snapshot');
      var heldChanged = heldOrdersSignature(state.data.heldOrders) !== heldOrdersSignature(incoming.heldOrders);
      state.data.heldOrders = incoming.heldOrders;
      if (incoming.nextTicketNumber !== undefined && incoming.nextTicketNumber !== null) state.data.nextTicketNumber = incoming.nextTicketNumber;
      state.status.read = 'OK';
      clearSyncFault('till-live');
      recoverStatusIfHealthy();
      renderStatus();
      if (heldChanged) {
        saveServerCache();
        if (state.activeTab === 'Held') renderHeld();
        // Never rebuild the active Till during a sale. The current basket, prompts and payment
        // controls remain untouched; only a future Till render uses the new held-order data.
      }
    } catch (err) {
      if (isStaleResponseError(err) || requestGeneration !== uiReadGeneration) return;
      markSyncFault('till-live', err);
      consecutiveCoreSyncFailures += 1;
      state.status.read = 'till sync retrying (' + consecutiveCoreSyncFailures + ')';
      state.status.message = 'Till live refresh failed — ' + friendlyServerError(err);
      renderStatus();
      if (consecutiveCoreSyncFailures >= 4 || navigator.onLine === false) maybeOfferLocalMode('Till synchronisation has failed ' + consecutiveCoreSyncFailures + ' consecutive times.');
    } finally {
      tillLivePollInFlight = false;
    }
  }

  function menuSignature(data) {
    return JSON.stringify([data.categories || [], data.menuItems || [], data.prompts || [], data.promptOptions || [], data.deletedItems || []]);
  }

  function validateMenuSnapshot(incoming) {
    var required = ['categories','menuItems','prompts','promptOptions','deletedItems'];
    if (!incoming || typeof incoming !== 'object') return false;
    return required.every(function (key) { return Array.isArray(incoming[key]); });
  }

  function applyMenuData(incoming) {
    if (!validateMenuSnapshot(incoming)) throw new Error('Invalid menu snapshot — keeping existing menu data');
    ['categories','menuItems','prompts','promptOptions','deletedItems'].forEach(function (key) { state.data[key] = incoming[key]; });
    lastMenuSignature = menuSignature(incoming);
    pendingMenuData = null;
    ensureActiveCategory();
    saveServerCache();
  }

  function canApplyPendingMenuForTab(tab) {
    if (!pendingMenuData) return false;
    if (tab === 'Admin') return state.adminEditMode === 'view' && !hasDirtyPromptOptions() && !adminItemConfigurationDirty() && !Object.keys(state.adminDirty.category || {}).length;
    if (tab === 'Till') return !state.cart.length && !state.paymentInProgress && !$('modalRoot').innerHTML;
    return true;
  }

  function applyPendingMenuIfSafe(tab) {
    if (!canApplyPendingMenuForTab(tab)) return false;
    applyMenuData(pendingMenuData);
    return true;
  }

  function clearMenuRetryTimer() {
    if (menuRetryTimer) clearTimeout(menuRetryTimer);
    menuRetryTimer = null;
  }

  function scheduleMenuRetry() {
    clearMenuRetryTimer();
    var delays = [5000, 10000, 20000, 30000, 60000];
    var delay = delays[Math.min(Math.max(menuSyncFailureCount - 1, 0), delays.length - 1)];
    menuRetryTimer = setTimeout(function () {
      menuRetryTimer = null;
      if (document.visibilityState !== 'hidden' && !menuPollInFlight) syncMenuData();
    }, delay);
  }

  async function syncMenuData() {
    if (menuPollInFlight || !backgroundSyncAllowed()) return;
    menuPollInFlight = true;
    try {
      var res = await api('menuSnapshot');
      menuSyncFailureCount = 0;
      consecutiveCoreSyncFailures = 0;
      localModeOfferShown = false;
      clearMenuRetryTimer();
      var incoming = res && res.data;
      if (!validateMenuSnapshot(incoming)) throw new Error('Invalid menu snapshot — keeping existing menu data');
      var signature = menuSignature(incoming);
      if (signature !== lastMenuSignature) {
        if (state.activeTab === 'Till' || state.activeTab === 'Admin') {
          pendingMenuData = incoming;
          state.status.mode = 'warn';
          state.status.message = 'Menu update available — it will be applied at the next safe screen change';
          renderStatus();
        } else {
          applyMenuData(incoming);
          // Background menu synchronisation never calls render(), renderTill(), or renderAdmin().
          // The next normal operator navigation/render uses the confirmed updated menu.
        }
      }
      clearSyncFault('menu');
      recoverStatusIfHealthy();
      renderStatus();
    } catch (err) {
      if (isStaleResponseError(err)) return;
      markSyncFault('menu', err);
      menuSyncFailureCount += 1;
      consecutiveCoreSyncFailures += 1;
      state.status.read = 'menu sync retrying (' + menuSyncFailureCount + ')';
      state.status.message = 'Menu refresh failed — ' + friendlyServerError(err);
      renderStatus();
      scheduleMenuRetry();
      if (consecutiveCoreSyncFailures >= 4 || navigator.onLine === false) maybeOfferLocalMode('Till/menu synchronisation has failed ' + consecutiveCoreSyncFailures + ' consecutive times.');
    } finally {
      menuPollInFlight = false;
    }
  }



  async function syncTicketHistoryData() {
    if (ticketHistoryPollInFlight || !state.serverReady || !isConfiguredUrl() || state.activeTab !== 'Live Tickets' || document.visibilityState === 'hidden') return;
    ticketHistoryPollInFlight = true;
    var requestGeneration = uiReadGeneration;
    var requestedDate = state.historyDate || todayDateString(new Date());
    try {
      var result = await api('ticketHistorySnapshot', { date: requestedDate });
      if (requestGeneration !== uiReadGeneration || state.activeTab !== 'Live Tickets' || requestedDate !== (state.historyDate || todayDateString(new Date()))) return;
      var incoming = result.data || {};
      var before = JSON.stringify([state.data.tickets || [], state.data.ticketItems || [], state.data.ticketAddOns || [], state.data.refunds || [], state.data.refundItems || []]);
      var after = JSON.stringify([incoming.tickets || [], incoming.ticketItems || [], incoming.ticketAddOns || [], incoming.refunds || [], incoming.refundItems || []]);
      clearSyncFault('ticket-history');
      state.focusedRefresh.history.error = '';
      recoverStatusIfHealthy();
      if (before !== after) {
        mergeTransactionData(incoming);
        state.focusedRefresh.history.updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        state.focusedRefresh.history.error = '';
        if (state.activeTab === 'Live Tickets') renderLiveTickets();
      }
    } catch (err) {
      if (isStaleResponseError(err) || requestGeneration !== uiReadGeneration) return;
      markSyncFault('ticket-history', err);
      state.focusedRefresh.history.error = err.message || String(err);
      if (state.activeTab === 'Live Tickets') renderStatus();
    } finally {
      ticketHistoryPollInFlight = false;
    }
  }

  async function forceTillUpdate() {
    if (state.paymentInProgress || document.querySelector('.modal-backdrop')) {
      toast('Finish the current prompt or payment before updating the Till.', 'warning');
      return;
    }
    showBusyMessage('Updating Till — Please wait', 'Applying the latest confirmed menu without clearing the current basket.');
    try {
      if (!pendingMenuData) await syncMenuData();
      if (pendingMenuData) {
        applyMenuData(pendingMenuData);
        pendingMenuData = null;
        lastMenuSignature = menuSignature(state.data);
      }
      state.status.mode = 'live';
      state.status.read = 'OK';
      state.status.write = state.serverReady ? 'OK' : state.status.write;
      clearSyncFault('menu');
      recoverStatusIfHealthy();
      hideBusyMessage();
      renderTill();
      renderStatus();
      toast('Till menu updated.');
    } catch (err) {
      hideBusyMessage();
      state.status.mode = 'warn';
      state.status.message = 'Till update failed — current Till remains unchanged: ' + (err.message || String(err));
      renderStatus();
    }
  }

  function releaseCompatibility(versions) {
    versions = versions || {};
    var acceptedBackends = (CONFIG.acceptedBackendVersions && CONFIG.acceptedBackendVersions.length ? CONFIG.acceptedBackendVersions : [CONFIG.backendVersion || CONFIG.frontendVersion || 'unknown']).map(String);
    var acceptedDatabases = (CONFIG.acceptedDatabaseVersions && CONFIG.acceptedDatabaseVersions.length ? CONFIG.acceptedDatabaseVersions : [CONFIG.databaseVersion || 'unknown']).map(String);
    var backend = String(versions.BackendVersion || versions.backendVersion || '');
    var database = String(versions.DatabaseVersion || versions.databaseVersion || '');
    return {
      acceptedBackends: acceptedBackends,
      acceptedDatabases: acceptedDatabases,
      backend: backend,
      database: database,
      backendCompatible: !backend || acceptedBackends.indexOf(backend) >= 0,
      databaseCompatible: !database || acceptedDatabases.indexOf(database) >= 0
    };
  }

  function versionDiagnostics(versions) {
    versions = versions || state.status || {};
    var expectedApp = CONFIG.appVersion || CONFIG.frontendVersion || 'unknown';
    var compatibility = releaseCompatibility(versions);
    var backend = compatibility.backend || 'unknown';
    var database = compatibility.database || 'unknown';
    return [
      { component: 'Browser application', expected: expectedApp, actual: CONFIG.frontendVersion || expectedApp, ok: (CONFIG.frontendVersion || expectedApp) === expectedApp },
      { component: 'Apps Script backend', expected: compatibility.acceptedBackends.join(' or '), actual: backend, ok: compatibility.backendCompatible },
      { component: 'Database schema', expected: compatibility.acceptedDatabases.join(' or '), actual: database, ok: compatibility.databaseCompatible }
    ];
  }

  function versionDiagnosticsHtml() {
    var rows = versionDiagnostics(state.status).map(function (item) {
      return '<tr><td>' + escapeHtml(item.component) + '</td><td>' + escapeHtml(item.expected) + '</td><td>' + escapeHtml(item.actual) + '</td><td class="version-status ' + (item.ok ? 'version-ok' : 'version-error') + '">' + (item.ok ? 'MATCH' : 'MISMATCH') + '</td></tr>';
    }).join('');
    return '<div class="version-diagnostics"><table><thead><tr><th>Component</th><th>Expected</th><th>Reported</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function versionMode(versions) {
    var compatibility = releaseCompatibility(versions || {});
    if (!compatibility.backendCompatible || !compatibility.databaseCompatible) return 'error';
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

  function clearNavCollapseTimer() {
    if (navCollapseTimer) { window.clearTimeout(navCollapseTimer); navCollapseTimer = null; }
  }

  function scheduleNavCollapse() {
    clearNavCollapseTimer();
    if (!navExpanded) return;
    navCollapseTimer = window.setTimeout(function () {
      navExpanded = false;
      renderNav();
    }, NAV_AUTO_COLLAPSE_MS);
  }

  function setNavExpanded(expanded) {
    navExpanded = !!expanded;
    if (navExpanded) scheduleNavCollapse(); else clearNavCollapseTimer();
    renderNav();
  }

  function markSyncFault(name, error) {
    activeSyncFaults[String(name || 'unknown')] = String(error && (error.message || error) || 'failed');
  }

  function clearSyncFault(name) {
    delete activeSyncFaults[String(name || 'unknown')];
  }

  function hasActiveSyncFaults() {
    return Object.keys(activeSyncFaults).length > 0;
  }

  function recoverStatusIfHealthy() {
    if (!state.serverReady || navigator.onLine === false || localModeEnabled()) return false;
    if (manualSyncPaused || maintenanceActionActive || hasActiveSyncFaults()) return false;
    if (state.paymentInProgress || state.status.write === 'saving' || state.status.write === 'clearing reports' || state.status.write === 'payment queued') return false;
    if (pendingMenuData) return false;
    var pendingKitchen = Object.keys(state.kitchenPendingUpdates || {}).length || Object.keys(state.kitchenDeferredUpdates || {}).length;
    if (pendingKitchen) return false;
    state.status.mode = 'live';
    state.status.read = 'OK';
    state.status.write = 'OK';
    state.status.message = 'System OK';
    return true;
  }

  function renderNav() {
    var nav = $('topNav');
    if (!nav) return;
    var groups = NAV_GROUPS.map(function (group) {
      return '<div class="nav-group nav-group-' + attr(group.className) + '">' +
        '<div class="nav-group-label">' + escapeHtml(group.label) + '</div>' +
        '<div class="nav-group-buttons">' + group.tabs.map(function (tab) {
          return '<button class="nav-btn' + (state.activeTab === tab.route ? ' active' : '') + '" data-tab="' + attr(tab.route) + '">' + escapeHtml(tab.label) + '</button>';
        }).join('') + '</div></div>';
    }).join('');
    nav.className = 'topnav' + (navExpanded ? ' expanded' : ' collapsed');
    nav.innerHTML = '<div class="nav-menu-row"><button class="nav-menu-button" data-action="toggle-main-menu" aria-expanded="' + (navExpanded ? 'true' : 'false') + '"><span class="nav-menu-icon">☰</span><span>Menu</span></button><div class="nav-current-screen">' + escapeHtml(state.activeTab) + '</div></div>' +
      '<div class="nav-drawer">' + groups + '</div>';
  }

  function renderEmergencyShell(error) {
    var main = $('main');
    if (!main) return;
    var message = error && error.message ? error.message : String(error || 'Unknown display error');
    main.innerHTML = '<section class="card emergency-till-shell"><h1>Till display recovery</h1><p>The Till interface was protected from a blank screen after a display error.</p><p class="help">Your current basket remains stored locally. Background synchronisation has been paused until the display is retried.</p><div class="row"><button class="primary" data-action="retry-safe-render">Retry Till display</button><button class="secondary" data-tab="Settings">Open Settings</button></div><details><summary>Technical detail</summary><pre>' + escapeHtml(message) + '</pre></details></section>';
  }

  function renderUnsafe() {
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
    if (state.activeTab === 'Local Tickets') renderLocalTickets();
    if (state.activeTab === 'Admin') renderAdmin();
    if (state.activeTab === 'Settings') renderSettings();
    if (state.activeTab === 'Till') scheduleTillAddFeedback();
  }

  function render() {
    var now = Date.now();
    if (!renderBurstStartedAt || now - renderBurstStartedAt > 1000) {
      renderBurstStartedAt = now;
      renderBurstCount = 0;
    }
    renderBurstCount += 1;
    if (renderBurstCount > 6) {
      var loopError = new Error('Repeated render cycle stopped by safety circuit breaker.');
      lastRenderError = loopError;
      renderQueued = false;
      stopSyncCoordinator();
      clearMenuRetryTimer();
      renderEmergencyShell(loopError);
      return;
    }
    if (renderInProgress) { renderQueued = true; return; }
    renderInProgress = true;
    try {
      renderUnsafe();
      lastRenderError = null;
    } catch (error) {
      lastRenderError = error;
      console.error('Contained screen render failure', error);
      stopSyncCoordinator();
      renderEmergencyShell(error);
    } finally {
      renderInProgress = false;
      if (renderQueued) {
        renderQueued = false;
        window.setTimeout(render, 0);
      }
    }
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

  function printReceiptsEnabled() {
    var value = (state.data.settings || {}).PrintReceiptsEnabled;
    return value === undefined || value === null || value === '' ? false : Core.truthy(value);
  }

  function emailReceiptsEnabled() {
    var value = (state.data.settings || {}).EmailReceiptsEnabled;
    return value === undefined || value === null || value === '' ? true : Core.truthy(value);
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
    return state.reportFrom || todayDateString(new Date());
  }

  function ticketInReportRange(ticket) {
    var day = ticketDateString(ticket.CreatedAt);
    return !!day && day === reportRangeLabel();
  }


  function parseLocalReportDate(value) {
    var parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }

  function shiftReportDate(value, days) {
    var date = parseLocalReportDate(value);
    if (!date) return value;
    date.setDate(date.getDate() + Number(days || 0));
    return todayDateString(date);
  }

  function reportPeriodDefinition(selectedDate) {
    var date = selectedDate || state.reportFrom || todayDateString(new Date());
    return {
      from: date,
      to: date,
      days: 1,
      previousFrom: shiftReportDate(date, -1),
      previousTo: shiftReportDate(date, -1),
      previousLabel: 'Comparison: Previous day',
      lastWeekFrom: shiftReportDate(date, -7),
      lastWeekTo: shiftReportDate(date, -7),
      lastWeekLabel: 'Comparison: Same weekday last week'
    };
  }


  function dateInPeriod(value, from, to) {
    var day = ticketDateString(value);
    return !!day && (!from || day >= from) && (!to || day <= to);
  }

  function reportMetrics(from, to) {
    var tickets = (state.data.tickets || []).filter(function (t) { return (t.Status || 'PAID') !== 'VOID' && dateInPeriod(t.CreatedAt, from, to); });
    var refunds = (state.data.refunds || []).filter(function (r) { return dateInPeriod(r.CreatedAt, from, to); });
    var ids = {};
    tickets.forEach(function (t) { ids[t.TicketID] = true; });
    var gross = tickets.reduce(function (sum, t) { return sum + Core.toNumber(t.Total, 0); }, 0);
    var refundTotal = refunds.reduce(function (sum, r) { return sum + Core.toNumber(r.Amount, 0); }, 0);
    var net = Core.roundMoney(gross - refundTotal);
    var cash = tickets.filter(function (t) { return String(t.PaymentMethod || '').toLowerCase() === 'cash'; }).reduce(function (sum, t) { return sum + Core.toNumber(t.Total, 0); }, 0);
    var card = tickets.filter(function (t) { return String(t.PaymentMethod || '').toLowerCase() === 'card'; }).reduce(function (sum, t) { return sum + Core.toNumber(t.Total, 0); }, 0);
    var staffDiscount = tickets.reduce(function (sum, t) { return sum + Core.toNumber(t.DiscountTotal, 0); }, 0);
    var loyaltyDiscount = tickets.reduce(function (sum, t) { return sum + Core.toNumber(t.LoyaltyTotal, 0); }, 0);
    var loyaltyItems = (state.data.ticketItems || []).filter(function (item) { return ids[item.TicketID] && Core.toNumber(item.LoyaltyDiscount, 0) > 0; });
    var loyaltyRedemptions = loyaltyItems.reduce(function (sum, item) { return sum + Core.toNumber(item.Quantity, 1); }, 0);
    return { tickets:tickets, refunds:refunds, ids:ids, gross:gross, refundsTotal:refundTotal, net:net, cash:cash, card:card, ticketCount:tickets.length, average:tickets.length ? Core.roundMoney(net/tickets.length) : 0, staffDiscount:staffDiscount, loyaltyDiscount:loyaltyDiscount, loyaltyRedemptions:loyaltyRedemptions };
  }

  function comparisonDelta(current, previous, type) {
    current = Core.toNumber(current, 0); previous = Core.toNumber(previous, 0);
    var difference = Core.roundMoney(current - previous);
    var percent = previous ? (difference / Math.abs(previous)) * 100 : (current ? 100 : 0);
    var direction = difference > 0 ? 'up' : (difference < 0 ? 'down' : 'same');
    var sign = difference > 0 ? '+' : '';
    var formatted = type === 'money' ? sign + Core.money(difference) : sign + String(Math.round(difference));
    return { difference:difference, percent:percent, direction:direction, text:formatted + ' (' + (percent > 0 ? '+' : '') + percent.toFixed(1) + '%)' };
  }

  function comparisonMetricCard(label, current, previous, type, available) {
    var currentText = type === 'money' ? Core.money(current) : String(Math.round(Core.toNumber(current,0)));
    if (available === false) return '<article class="comparison-metric comparison-unavailable"><span>' + escapeHtml(label) + '</span><strong>' + currentText + '</strong><small>Comparison unavailable</small></article>';
    var delta = comparisonDelta(current, previous, type);
    return '<article class="comparison-metric comparison-' + delta.direction + '"><span>' + escapeHtml(label) + '</span><strong>' + currentText + '</strong><small><b>' + (delta.direction === 'up' ? '▲' : (delta.direction === 'down' ? '▼' : '■')) + '</b> ' + escapeHtml(delta.text) + '</small></article>';
  }

  function tillLayoutSnapshot() {
    return {
      categories: (state.data.categories || []).map(function (c) { return { CategoryID: c.CategoryID, Sort: c.Sort }; }),
      items: (state.data.menuItems || []).map(function (i) { return { ItemID: i.ItemID, CategoryID: i.CategoryID, Sort: i.Sort }; })
    };
  }

  function restoreTillLayoutSnapshot(snapshot) {
    if (!snapshot) return;
    var categorySort = {};
    var itemState = {};
    (snapshot.categories || []).forEach(function (x) { categorySort[x.CategoryID] = x.Sort; });
    (snapshot.items || []).forEach(function (x) { itemState[x.ItemID] = x; });
    (state.data.categories || []).forEach(function (c) { if (Object.prototype.hasOwnProperty.call(categorySort, c.CategoryID)) c.Sort = categorySort[c.CategoryID]; });
    (state.data.menuItems || []).forEach(function (i) { var saved = itemState[i.ItemID]; if (saved) { i.Sort = saved.Sort; i.CategoryID = saved.CategoryID; } });
  }

  function resequenceTillCategories(rows) {
    rows.forEach(function (row, index) { row.Sort = index + 1; });
    state.tillLayoutDirty = true;
  }

  function resequenceTillItems(rows) {
    rows.forEach(function (row, index) { row.Sort = index + 1; });
    state.tillLayoutDirty = true;
  }

  function moveTillLayoutEntry(type, id, direction) {
    if (type === 'category') {
      var cats = categories();
      var index = cats.findIndex(function (x) { return x.CategoryID === id; });
      var target = index + direction;
      if (index < 0 || target < 0 || target >= cats.length) return;
      var moved = cats.splice(index, 1)[0]; cats.splice(target, 0, moved); resequenceTillCategories(cats);
    } else {
      var items = itemsForCategory(state.activeCategoryId);
      var itemIndex = items.findIndex(function (x) { return x.ItemID === id; });
      var itemTarget = itemIndex + direction;
      if (itemIndex < 0 || itemTarget < 0 || itemTarget >= items.length) return;
      var movedItem = items.splice(itemIndex, 1)[0]; items.splice(itemTarget, 0, movedItem); resequenceTillItems(items);
    }
    renderTill();
  }

  function reorderTillLayoutByDrop(type, sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    var rows = type === 'category' ? categories() : itemsForCategory(state.activeCategoryId);
    var idField = type === 'category' ? 'CategoryID' : 'ItemID';
    var from = rows.findIndex(function (x) { return x[idField] === sourceId; });
    var to = rows.findIndex(function (x) { return x[idField] === targetId; });
    if (from < 0 || to < 0) return;
    var moved = rows.splice(from, 1)[0]; rows.splice(to, 0, moved);
    if (type === 'category') resequenceTillCategories(rows); else resequenceTillItems(rows);
    renderTill();
  }

  function enterTillLayoutEditMode() {
    if (state.cart.length) {
      toast('Clear or hold the current ticket before editing the Till layout.', 'error');
      return;
    }
    state.tillLayoutBaseline = tillLayoutSnapshot();
    state.tillLayoutEditMode = true;
    state.tillLayoutDirty = false;
    state.tillLayoutDrag = null;
    renderTill();
  }

  async function cancelTillLayoutEditMode() {
    if (state.tillLayoutDirty) {
      var discard = await themedConfirm({ title: 'Discard Till layout changes?', message: 'The categories and item buttons will return to their last saved positions.', confirmLabel: 'Discard changes', cancelLabel: 'Continue editing', tone: 'danger' });
      if (!discard) return;
    }
    restoreTillLayoutSnapshot(state.tillLayoutBaseline);
    state.tillLayoutEditMode = false;
    state.tillLayoutDirty = false;
    state.tillLayoutBaseline = null;
    state.tillLayoutDrag = null;
    renderTill();
  }

  async function saveTillLayoutArrangement() {
    if (!state.tillLayoutDirty) {
      state.tillLayoutEditMode = false;
      state.tillLayoutBaseline = null;
      renderTill();
      return;
    }

    var baseline = state.tillLayoutBaseline || { categories: [], items: [] };
    var baselineCategories = {};
    var baselineItems = {};
    (baseline.categories || []).forEach(function (row) { baselineCategories[String(row.CategoryID)] = row; });
    (baseline.items || []).forEach(function (row) { baselineItems[String(row.ItemID)] = row; });

    var changedCategories = categories().filter(function (category, index) {
      var before = baselineCategories[String(category.CategoryID)] || {};
      var nextSort = index + 1;
      category.Sort = nextSort;
      return Core.toNumber(before.Sort, 9999) !== nextSort;
    });

    var changedItems = (state.data.menuItems || []).filter(function (item) {
      if (!Core.active(item.Active)) return false;
      var before = baselineItems[String(item.ItemID)] || {};
      return Core.toNumber(before.Sort, 9999) !== Core.toNumber(item.Sort, 9999) || String(before.CategoryID || '') !== String(item.CategoryID || '');
    });

    var totalWrites = changedCategories.length + changedItems.length;
    if (!totalWrites) {
      state.tillLayoutEditMode = false;
      state.tillLayoutDirty = false;
      state.tillLayoutBaseline = null;
      renderTill();
      return;
    }

    showBusyMessage('Saving Till layout — Please wait', 'Saving 0 of ' + totalWrites + ' changed positions. Do not close this screen.');
    var completed = 0;
    try {
      for (var c = 0; c < changedCategories.length; c++) {
        var category = changedCategories[c];
        var categoryResult = await saveServerEntity('saveCategory', { category: { CategoryID: category.CategoryID, Sort: category.Sort } });
        if (!categoryResult || categoryResult.ok === false) throw new Error((categoryResult && categoryResult.error) || 'Category position was not saved.');
        completed++;
        showBusyMessage('Saving Till layout — Please wait', 'Saving ' + completed + ' of ' + totalWrites + ' changed positions.');
      }
      for (var i = 0; i < changedItems.length; i++) {
        var item = changedItems[i];
        var itemResult = await saveServerEntity('saveItem', { item: { ItemID: item.ItemID, CategoryID: item.CategoryID, Sort: item.Sort } });
        if (!itemResult || itemResult.ok === false) throw new Error((itemResult && itemResult.error) || 'Item position was not saved.');
        completed++;
        showBusyMessage('Saving Till layout — Please wait', 'Saving ' + completed + ' of ' + totalWrites + ' changed positions.');
      }

      state.tillLayoutEditMode = false;
      state.tillLayoutDirty = false;
      state.tillLayoutBaseline = null;
      pendingMenuData = null;
      lastMenuSignature = menuSignature(state.data);
      saveServerCache();
      hideBusyMessage();
      renderTill();
      toast('Till layout saved.');
    } catch (err) {
      hideBusyMessage();
      persistFailed('Till layout save failed after ' + completed + ' of ' + totalWrites + ' changes', err);
      toast('The layout save stopped. ' + completed + ' of ' + totalWrites + ' changes were saved. Press Save layout to retry the remaining changes.', 'error');
      state.tillLayoutDirty = true;
      renderTill();
    }
  }

  function renderTill() {
    ensureActiveCategory();
    var existingBasketScroller = document.querySelector('.ticket-items-scroll');
    var preservedBasketScrollTop = existingBasketScroller ? existingBasketScroller.scrollTop : 0;
    var shouldPreserveBasketScroll = state.tillFeedback.pendingLineIndex < 0;
    var cats = categories();
    var items = itemsForCategory(state.activeCategoryId);
    var editing = state.tillLayoutEditMode;
    var editorBar = editing
      ? '<div class="till-layout-editor-bar"><div><strong>Edit Till layout</strong><span>Drag buttons, or use the arrows. Select a category to arrange its items.</span></div><div class="row"><button class="ghost" data-action="cancel-till-layout">Cancel</button><button class="primary" data-action="save-till-layout"' + (state.tillLayoutDirty ? '' : ' disabled') + '>Save layout</button></div></div>'
      : '<div class="till-layout-launch"><button class="secondary compact" data-action="edit-till-layout">Edit menu layout</button></div>';
    $('main').innerHTML = (pendingMenuData && !editing ? '<div class="till-update-banner"><strong>Menu update available</strong><span>The current Till stays unchanged until staff apply it.</span><button class="primary compact" data-action="force-till-update">Force Till update</button></div>' : '') +
      editorBar + '<div class="grid-till' + (editing ? ' till-layout-editing' : '') + '">' +
      '<section class="panel till-menu-panel">' +
        '<div class="category-strip">' + cats.map(function (c, index) {
          var controls = editing ? '<span class="layout-move-controls"><button type="button" data-action="move-layout-category" data-id="' + attr(c.CategoryID) + '" data-direction="-1"' + (index === 0 ? ' disabled' : '') + '>←</button><button type="button" data-action="move-layout-category" data-id="' + attr(c.CategoryID) + '" data-direction="1"' + (index === cats.length - 1 ? ' disabled' : '') + '>→</button></span>' : '';
          return '<div class="layout-category-wrap' + (state.activeCategoryId === c.CategoryID ? ' active' : '') + '"' + (editing ? ' draggable="true" data-layout-type="category" data-layout-id="' + attr(c.CategoryID) + '"' : '') + '><button class="pill-btn' + (state.activeCategoryId === c.CategoryID ? ' active' : '') + '" data-action="set-category" data-id="' + attr(c.CategoryID) + '">' + escapeHtml(c.CategoryName) + '</button>' + controls + '</div>';
        }).join('') + '</div>' +
        (editing ? '<div class="layout-edit-hint">Arrange the item buttons exactly as staff should see them on the Till.</div>' : '') +
        '<div class="item-grid-scroll"><div class="item-grid">' + items.map(function (item, index) {
          var moveControls = editing ? '<span class="item-layout-controls"><button type="button" data-action="move-layout-item" data-id="' + attr(item.ItemID) + '" data-direction="-1"' + (index === 0 ? ' disabled' : '') + '>←</button><span class="drag-handle">↕</span><button type="button" data-action="move-layout-item" data-id="' + attr(item.ItemID) + '" data-direction="1"' + (index === items.length - 1 ? ' disabled' : '') + '>→</button></span>' : '';
          return '<div class="layout-item-wrap"' + (editing ? ' draggable="true" data-layout-type="item" data-layout-id="' + attr(item.ItemID) + '"' : '') + '><button class="item-card' + (Core.truthy(item.LoyaltyEligible) ? ' loyalty-item-card' : '') + (editing ? ' layout-item-card' : '') + '" ' + (editing ? 'data-action="select-layout-item"' : 'data-action="add-item"') + ' data-id="' + attr(item.ItemID) + '">' +
            (Core.truthy(item.LoyaltyEligible) ? '<span class="loyalty-menu-badge">LOYALTY</span>' : '') +
            '<span><span class="item-name">' + escapeHtml(item.ItemName) + '</span>' +
            (item.Description ? '<span class="item-desc">' + escapeHtml(item.Description) + '</span>' : '') + '</span>' +
            '<span class="item-price">' + Core.money(item.Price) + '</span>' +
          '</button>' + moveControls + '</div>';
        }).join('') + '</div></div>' +
      '</section>' + (editing ? '<aside class="panel ticket-panel layout-instructions"><h2>Layout editor</h2><p>Move categories across the top and item buttons within the selected category.</p><p>The actual Till appearance is used so the saved result matches what staff will see.</p><p class="help">Payment controls are hidden while editing. Save writes all category and item positions together.</p></aside>' : renderTicketPanel()) + '</div>';
    if (shouldPreserveBasketScroll && !editing) {
      var restoredBasketScroller = document.querySelector('.ticket-items-scroll');
      if (restoredBasketScroller) restoredBasketScroller.scrollTop = preservedBasketScrollTop;
    }
  }

  function renderTicketPanel() {
    var totals = currentTotals();
    var discountPercent = staffDiscountPercent();
    var discountActive = staffDiscountApplied() && discountPercent > 0;
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
          '<div class="ticket-primary-actions"><button class="secondary" data-action="hold-current">Hold</button><button class="danger" data-action="clear-cart">Clear</button><button class="pay-main" data-action="open-payment-method"' + (!state.cart.length ? ' disabled' : '') + '>PAY</button></div>' +
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

  function scheduleOrderTypePrompt(context) {
    window.setTimeout(function () {
      if (state.activeTab !== 'Till' || state.cart.length || state.paymentInProgress || hasSelectedOrderType()) return;
      if ($('modalRoot').innerHTML) return;
      showOrderTypePrompt(context || 'till');
    }, 0);
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
    if (localModeOfferPending && localModeEligible() && !state.paymentInProgress) {
      window.setTimeout(function () { maybeOfferLocalMode('Four consecutive Till/menu synchronisation checks have failed.'); }, 0);
    }
    if (state.awaitingPostPaymentOrderType && state.activeTab === 'Till' && !state.cart.length) {
      state.awaitingPostPaymentOrderType = false;
      scheduleOrderTypePrompt('post-payment');
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

  async function paymentPrecheck() {
    if (state.paymentInProgress) return { ok: false, message: 'Payment is already being recorded locally.' };
    if (!state.cart.length) return { ok: false, message: 'Add at least one item before taking payment.' };
    if (strictPersistence() && !isConfiguredUrl() && !canUseLocalTestMode()) return { ok: false, message: 'Payment unavailable: Google Script URL is not configured and this device has not been commissioned for local-first operation.' };
    var storage = QueueManager.healthCheck ? await QueueManager.healthCheck() : { ok: true };
    if (!storage.ok) return { ok: false, message: 'Payment unavailable — this device cannot safely store the transaction locally. ' + (storage.error || '') };
    return { ok: true, localOnly: !state.serverReady };
  }

  async function openPaymentMethodModal() {
    var check = await paymentPrecheck();
    if (!check.ok) { toast(check.message, 'error'); return; }
    if (check.localOnly) {
      state.status.mode = 'local';
      state.status.write = 'local queue ready';
      state.status.message = 'Offline — payments will be stored safely on this device';
      renderStatus();
    }
    var totals = currentTotals();
    $('modalRoot').innerHTML = '<div class="modal-backdrop"><div class="modal payment-method-modal"><h2>Take payment</h2><div class="payment-amount-due"><span>Amount due</span><strong>' + Core.money(totals.total) + '</strong></div><div class="payment-method-grid"><button class="payment-method-choice cash" data-modal-action="select-payment-method" data-method="Cash"><strong>CASH</strong><span>Enter cash received and calculate change</span></button><button class="payment-method-choice card" data-modal-action="select-payment-method" data-method="Card"><strong>CARD</strong><span>Confirm card payment</span></button></div><button class="secondary payment-cancel" data-modal-action="close">Cancel</button></div></div>';
  }

  function cashKeypadStatus(digits) {
    var totals = currentTotals();
    var value = cashDigitsToValue(digits);
    var paid = value === '' ? 0 : Core.toNumber(value, 0);
    var difference = Core.roundMoney(paid - totals.total);
    if (paid < totals.total) return { label: 'STILL TO PAY', value: Core.money(Math.abs(difference)), className: 'cash-change-panel still-due', canComplete: false };
    if (difference === 0) return { label: 'EXACT PAYMENT', value: Core.money(0), className: 'cash-change-panel exact', canComplete: true };
    return { label: 'CHANGE', value: Core.money(difference), className: 'cash-change-panel change-due', canComplete: true };
  }


  function paymentReviewItemCount() {
    return (state.cart || []).reduce(function (sum, line) { return sum + Math.max(1, Core.toNumber(line.Quantity, 1)); }, 0);
  }

  function renderPaymentOrderReview() {
    var totals = currentTotals();
    var lines = (state.cart || []).map(function (line) {
      Core.setLineQuantity(line, line.Quantity);
      var addOns = Presentation.renderAddOnList(line.AddOns || [], { core: Core, models: Models, promptOptions: state.data.promptOptions || [], includePrice: true });
      return '<div class="payment-review-line"><div><strong>' + escapeHtml(line.ItemName) + ' × ' + escapeHtml(line.Quantity || 1) + '</strong>' + addOns + (line.Note ? '<div class="note-chip">Note: ' + escapeHtml(line.Note) + '</div>' : '') + '</div><strong>' + Core.money(Core.lineNetTotal(line)) + '</strong></div>';
    }).join('');
    return '<aside id="paymentOrderReview" class="payment-order-review" hidden aria-label="Order review"><div class="payment-review-header"><div><span>ORDER REVIEW</span><strong>' + escapeHtml(paymentReviewItemCount()) + ' item' + (paymentReviewItemCount() === 1 ? '' : 's') + '</strong></div><button class="secondary" data-modal-action="close-order-review">Close</button></div><div class="payment-review-list">' + lines + '</div><div class="payment-review-totals"><div><span>Subtotal</span><strong>' + Core.money(totals.subtotal) + '</strong></div>' + (totals.discount ? '<div><span>Discount</span><strong>−' + Core.money(totals.discount) + '</strong></div>' : '') + '<div class="payment-review-total"><span>Total</span><strong>' + Core.money(totals.total) + '</strong></div></div><button class="secondary payment-back-to-till" data-modal-action="back-to-till">Back to Till to edit order</button></aside>';
  }

  function togglePaymentOrderReview(show) {
    var panel = $('paymentOrderReview');
    if (!panel) return;
    panel.hidden = show === false ? true : !panel.hidden;
    if (!panel.hidden) {
      panel.scrollTop = 0;
      var close = panel.querySelector('[data-modal-action="close-order-review"]');
      if (close) close.focus();
    }
  }

  function openCashKeypad() {
    // Every cash-payment session starts with a clean tender value. Previous or cancelled
    // cash entries must never leak into the next sale.
    state.ticketMeta.CashPaid = '';
    var digits = '';
    var totals = currentTotals();
    var status = cashKeypadStatus(digits);
    var stampQty = loyaltyStampQuantity();
    var loyaltyReminder = stampQty ? '<div class="loyalty-stamp-reminder cash-loyalty-reminder"><strong>LOYALTY STAMP REMINDER</strong><span>Add ' + escapeHtml(stampQty) + ' loyalty stamp' + (stampQty === 1 ? '' : 's') + ' for the eligible item' + (stampQty === 1 ? '' : 's') + ' on this ticket.</span></div>' : '';
    var reviewButton = '<button class="secondary payment-review-button" data-modal-action="open-order-review">🧾 Review Order • ' + escapeHtml(paymentReviewItemCount()) + ' item' + (paymentReviewItemCount() === 1 ? '' : 's') + '</button>';
    $('modalRoot').innerHTML = '<div class="modal-backdrop payment-modal-backdrop"><div class="modal cash-keypad-modal payment-cash-modal payment-responsive-modal"><h2>Cash payment</h2>' + loyaltyReminder + '<div class="cash-payment-layout"><section class="cash-payment-main"><div class="cash-payment-summary"><div><span>Amount due</span><strong>' + Core.money(totals.total) + '</strong></div><div><span>Cash received</span><strong id="cashKeypadDisplay" data-cash-digits="' + attr(digits) + '" data-cash-entry-source="empty">' + renderCashKeypadAmount(digits) + '</strong></div></div><div id="cashChangePanel" class="' + status.className + '"><span>' + status.label + '</span><strong>' + status.value + '</strong></div><div class="pos-keypad cash-pos-keypad" aria-label="Cash amount keypad">' + [1,2,3,4,5,6,7,8,9].map(function (d) { return '<button type="button" class="keypad-key" data-modal-action="cash-digit" data-digit="' + d + '">' + d + '</button>'; }).join('') + '<button type="button" class="keypad-key keypad-clear" data-modal-action="cash-clear">Clear</button><button type="button" class="keypad-key" data-modal-action="cash-digit" data-digit="0">0</button><button type="button" class="keypad-key keypad-delete" data-modal-action="cash-delete">⌫</button></div><div class="cash-quick-actions" aria-label="Quick cash received amounts"><button class="secondary cash-quick-exact" data-modal-action="cash-exact">Exact amount</button><button class="secondary" data-modal-action="cash-quick" data-amount="5">£5</button><button class="secondary" data-modal-action="cash-quick" data-amount="10">£10</button><button class="secondary" data-modal-action="cash-quick" data-amount="20">£20</button><button class="secondary" data-modal-action="cash-quick" data-amount="30">£30</button><button class="secondary" data-modal-action="cash-quick" data-amount="40">£40</button><button class="secondary" data-modal-action="cash-quick" data-amount="50">£50</button></div></section><section class="cash-payment-details"><div class="form-grid clean-form cash-customer-fields"><label><span>Customer name</span><input class="input" id="paymentCustomerName" placeholder="Optional" value="' + attr(state.ticketMeta.CustomerName) + '"></label><label><span>Table number</span><input class="input" id="paymentTableNumber" placeholder="Optional" value="' + attr(state.ticketMeta.TableNumber) + '"></label></div>' + reviewButton + '</section><aside class="payment-action-panel"><button id="completeCashSale" class="primary payment-complete-action" data-modal-action="complete-cash-sale"' + (status.canComplete ? '' : ' disabled') + '>Complete Sale</button><button class="secondary payment-cancel-action" data-modal-action="close">Cancel</button></aside></div>' + renderPaymentOrderReview() + '</div></div>';
    setTimeout(function () { var firstKey = document.querySelector('.cash-pos-keypad .keypad-key'); if (firstKey) firstKey.focus(); }, 0);
  }

  function refreshCashKeypadStatus() {
    var display = $('cashKeypadDisplay');
    var panel = $('cashChangePanel');
    var complete = $('completeCashSale');
    if (!display || !panel) return;
    var status = cashKeypadStatus(display.getAttribute('data-cash-digits') || '');
    panel.className = status.className;
    panel.innerHTML = '<span>' + status.label + '</span><strong>' + status.value + '</strong>';
    if (complete) complete.disabled = !status.canComplete;
  }

  function editCashKeypad(action, digit) {
    var display = $('cashKeypadDisplay');
    if (!display) return;
    var digits = display.getAttribute('data-cash-digits') || '';
    var source = display.getAttribute('data-cash-entry-source') || 'empty';
    if (action === 'digit') {
      // The first manually typed digit after Exact Amount or a quick-tender button
      // starts a new cash-received value rather than appending to the preset.
      if (source !== 'manual') digits = '';
      if (digits.length < 9) digits += String(digit || '');
      source = 'manual';
    }
    if (action === 'delete') {
      digits = digits.slice(0, -1);
      source = 'manual';
    }
    if (action === 'clear') {
      digits = '';
      source = 'empty';
    }
    if (action === 'exact') {
      digits = String(Math.round(currentTotals().total * 100));
      source = 'preset';
    }
    if (action === 'quick') {
      digits = String(Math.round(Core.toNumber(digit, 0) * 100));
      source = 'preset';
    }
    display.setAttribute('data-cash-digits', digits);
    display.setAttribute('data-cash-entry-source', source);
    display.textContent = renderCashKeypadAmount(digits);
    refreshCashKeypadStatus();
  }

  async function completeCashSale() {
    var display = $('cashKeypadDisplay');
    if (!display) return;
    state.ticketMeta.CashPaid = cashDigitsToValue(display.getAttribute('data-cash-digits') || '');
    if ($('paymentCustomerName')) state.ticketMeta.CustomerName = $('paymentCustomerName').value.trim();
    if ($('paymentTableNumber')) state.ticketMeta.TableNumber = $('paymentTableNumber').value.trim();
    state.pendingPaymentRequestId = '';
    saveLocal();
    await commitPayment('Cash');
  }

  async function takePayment(method) {
    var check = await paymentPrecheck();
    if (!check.ok) { toast(check.message, 'error'); return; }
    var discount = discountOptions();
    var validation = Core.validatePayment(state.cart, method, state.ticketMeta.CashPaid, discount);
    if (!validation.ok) { toast(validation.message); return; }
    if (strictPersistence() && !isConfiguredUrl() && !canUseLocalTestMode()) {
      toast('Server URL is not configured. Payment can only be queued after a URL has been saved.');
      return;
    }
    showPaymentCustomerPrompt(method, validation.totals);
  }

  function showPaymentCustomerPrompt(method, totals) {
    totals = totals || currentTotals();
    var stampQty = loyaltyStampQuantity();
    var loyaltyReminder = stampQty ? '<div class="loyalty-stamp-reminder"><strong>LOYALTY STAMP REMINDER</strong><span>Add ' + escapeHtml(stampQty) + ' loyalty stamp' + (stampQty === 1 ? '' : 's') + ' for the eligible item' + (stampQty === 1 ? '' : 's') + ' on this ticket.</span></div>' : '';
    var html = '<div class="modal-backdrop payment-modal-backdrop"><div class="modal payment-responsive-modal card-confirmation-modal">' +
      '<h2>' + escapeHtml(method) + ' payment</h2>' + loyaltyReminder +
      '<div class="card-payment-layout"><section class="card-payment-content"><div class="card-payment-primary-panel"><span>CARD PAYMENT</span><strong>' + Core.money(totals.total) + '</strong></div><div class="form-grid clean-form payment-customer-form"><label><span>Customer name</span><input class="input" id="paymentCustomerName" placeholder="Optional customer name" value="' + attr(state.ticketMeta.CustomerName) + '"></label><label><span>Table number</span><input class="input" id="paymentTableNumber" placeholder="Optional table number" value="' + attr(state.ticketMeta.TableNumber) + '"></label></div><button class="secondary payment-review-button" data-modal-action="open-order-review">🧾 Review Order • ' + escapeHtml(paymentReviewItemCount()) + ' item' + (paymentReviewItemCount() === 1 ? '' : 's') + '</button></section><aside class="payment-action-panel"><button class="primary payment-complete-action" data-modal-action="confirm-payment" data-method="' + attr(method) + '">Confirm Card Payment</button><button class="secondary payment-cancel-action" data-modal-action="close">Back</button></aside></div>' + renderPaymentOrderReview() +
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
    if (state.paymentInProgress) { toast('Payment is already being recorded.'); return; }
    var discount = discountOptions();
    var validation = Core.validatePayment(state.cart, method, state.ticketMeta.CashPaid, discount);
    if (!validation.ok) { toast(validation.message); return; }
    if (!state.pendingPaymentRequestId) state.pendingPaymentRequestId = Core.uid('REQ');
    var meta = Object.assign({}, state.ticketMeta, {
      ClientRequestID: state.pendingPaymentRequestId,
      StaffDiscountApplied: discount.discountApplied,
      StaffDiscountPercent: discount.discountApplied ? discount.discountPercent : 0
    });
    var payload = Core.buildTicketPayload({ cart: state.cart, meta: meta, discountApplied: discount.discountApplied, discountPercent: discount.discountPercent, payment: { method: method, cashTendered: state.ticketMeta.CashPaid } });
    payload.clientRequestId = state.pendingPaymentRequestId;
    var previewBundle = previewTicketBundle(payload);
    saveLocal();
    state.paymentInProgress = true;
    try {
      var localRecord = await storeLocalPaidTicket(payload, previewBundle);
      resetCurrentOrderState({ keepServerName: true });
      state.paymentInProgress = false;
      state.awaitingPostPaymentOrderType = true;
      state.status.mode = state.serverReady ? 'live' : 'local';
      state.status.write = state.serverReady ? 'queued for sync' : 'stored locally';
      state.status.read = state.serverReady ? 'OK' : 'retrying';
      state.status.message = state.serverReady ? 'Payment secured locally — synchronising in background' : 'Payment secured locally — server unavailable; automatic retry continues';
      saveLocal();
      render();
      showReceipt(localRecord.preview.ticket, localRecord.preview.ticketItems, localRecord.preview.ticketAddOns, {
        title: 'Payment complete', state: 'saved', allowClose: true, clientRequestId: localRecord.clientRequestId,
        message: 'The sale is recorded. Close this receipt to serve the next customer.'
      });
      window.setTimeout(function () { syncLocalTickets(); }, 0);
    } catch (err) {
      state.paymentInProgress = false;
      state.status.mode = 'error';
      state.status.write = 'local save failed';
      state.status.message = 'Payment not recorded locally: ' + err.message;
      renderStatus();
      showReceipt(previewBundle.ticket, previewBundle.ticketItems, previewBundle.ticketAddOns, {
        title: 'Payment not recorded', state: 'failed', allowClose: true,
        message: 'The device could not securely store this payment. The basket has not been cleared.'
      });
      toast('Payment not recorded. The order remains on the Till.', 'error');
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
    var title = options.title || (options.state ? 'Payment Complete' : ('Ticket #' + ticket.TicketNumber));
    var stateClass = options.state ? ' receipt-state-' + options.state : '';
    var banner = options.message ? '<div class="receipt-banner' + stateClass + '"><strong>' + escapeHtml(options.state === 'failed' ? 'Action needed' : (options.state === 'saved' ? 'Payment secured' : 'Payment secured locally')) + '</strong><span>' + escapeHtml(options.message) + '</span></div>' : '';
    activeReceiptBundle = { ticket: ticket, items: items || [], addons: addons || [], clientRequestId: String((options && options.clientRequestId) || '').trim() };
    var receiptActions = '';
    if (printReceiptsEnabled()) receiptActions += '<button class="secondary" data-modal-action="print-receipt">Print receipt</button>';
    if (emailReceiptsEnabled() && options.state === 'saved' && ticket.TicketID) receiptActions += '<button class="secondary" data-modal-action="email-saved-receipt" data-ticket-id="' + attr(ticket.TicketID) + '" data-client-request-id="' + attr(activeReceiptBundle.clientRequestId) + '">Email receipt</button>';
    var receiptActionBar = options.allowClose === false
      ? '<div class="row receipt-completion-actions"><button class="secondary" disabled>Securing payment locally…</button></div>'
      : '<div class="row receipt-completion-actions">' + receiptActions + '<button class="primary" data-modal-action="close">Close</button></div>';
    var html = '<div class="modal-backdrop"><div class="modal">' +
      '<h2>' + escapeHtml(title) + '</h2>' + banner + receiptActionBar +
      '<div class="cards"><div class="card"><h3>Total paid</h3><div class="item-price">' + Core.money(ticket.Total) + '</div><div>' + escapeHtml(ticket.PaymentMethod) + '</div>' + (ticket.PaymentMethod === 'Cash' ? '<div class="receipt-cash-summary"><div><span>Cash received</span><strong>' + Core.money(ticket.CashTendered) + '</strong></div><div class="receipt-change-due"><span>CHANGE</span><strong>' + Core.money(ticket.ChangeDue) + '</strong></div></div>' : '') +
        '<div class="receipt-money-lines"><div>Items: ' + Core.money(ticket.Subtotal) + '</div><div>Additional items: ' + Core.money(ticket.AddOnTotal) + '</div>' + (Core.toNumber(ticket.LoyaltyTotal, 0) ? '<div class="loyalty-text">Loyalty: -' + Core.money(ticket.LoyaltyTotal) + '</div>' : '') + (Core.toNumber(ticket.DiscountTotal, 0) ? '<div class="discount-text">Staff discount: -' + Core.money(ticket.DiscountTotal) + '</div>' : '') + '</div></div>' + (options.state ? '<div class="card"><h3>Payment method</h3><div class="item-price">' + escapeHtml(ticket.PaymentMethod || '') + '</div><div class="receipt-money-lines">' + (ticket.CustomerName ? '<div>Customer: ' + escapeHtml(ticket.CustomerName) + '</div>' : '') + (ticket.TableNumber ? '<div>Table: ' + escapeHtml(ticket.TableNumber) + '</div>' : '') + '</div></div>' : '<div class="card"><h3>Ticket</h3><div class="item-price">#' + escapeHtml(ticket.TicketNumber) + '</div><div>' + escapeHtml(ticket.Status || '') + '</div><div class="receipt-money-lines">' + (ticket.CustomerName ? '<div>Customer: ' + escapeHtml(ticket.CustomerName) + '</div>' : '') + (ticket.TableNumber ? '<div>Table: ' + escapeHtml(ticket.TableNumber) + '</div>' : '') + '</div></div>') + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Qty</th><th>Item</th><th>Configuration</th><th>Total</th></tr></thead><tbody>' +
      (items || []).map(function (it) {
        var rowAddons = (addons || []).filter(function (a) { return a.TicketItemID === it.TicketItemID; });
        var loyalty = Core.toNumber(it.LoyaltyDiscount, 0);
        var rowTotal = Core.roundMoney(Core.toNumber(it.LineTotal, 0) - loyalty);
        var itemCategory = it.CategoryName || categoryName(it.CategoryID) || 'Uncategorised';
        return '<tr><td>' + escapeHtml(it.Quantity) + '</td><td>' + escapeHtml(it.ItemName) + '<div class="ticket-category">' + escapeHtml(itemCategory) + '</div>' + (loyalty ? '<div class="loyalty-chip">LOYALTY - ' + Core.money(loyalty) + '</div>' : '') + (it.Note ? '<div class="note-chip">' + escapeHtml(it.Note) + '</div>' : '') + '</td><td>' + rowAddons.map(function (a) { return escapeHtml(addOnDisplayText(a, false)); }).join('<br>') + '</td><td>' + Core.money(rowTotal) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
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
      clearSyncFault('write');
      recoverStatusIfHealthy();
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
    if (entry.warning) return '<span class="screen-refresh-status error">Updated ' + escapeHtml(entry.updatedAt || '') + ' — ' + escapeHtml(entry.warning) + '</span>';
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


  function combineReportSnapshots(snapshots) {
    var combined = { tickets: [], ticketItems: [], ticketAddOns: [], refunds: [], refundItems: [] };
    (snapshots || []).forEach(function (snapshot) {
      var data = (snapshot && snapshot.data) || {};
      Object.keys(combined).forEach(function (key) {
        if (Array.isArray(data[key])) combined[key] = combined[key].concat(data[key]);
      });
    });
    return combined;
  }

  function focusedRefreshOverlay(kind, message) {
    var title = kind === 'reports' ? 'Refreshing Reports' : 'Refreshing Ticket History';
    showBusyMessage(title, message || 'Loading the latest information from the server…');
  }

  async function refreshReportsData(options) {
    options = options || {};
    var entry = state.focusedRefresh.reports;
    var requestedDate = state.reportFrom || todayDateString(new Date());
    state.reportTo = requestedDate;
    if (entry.inFlight) {
      if (requestedDate !== entry.requestedDate) entry.pendingDate = requestedDate;
      return;
    }
    entry.inFlight = true;
    entry.requestedDate = requestedDate;
    entry.pendingDate = '';
    entry.error = '';
    entry.warning = '';
    var requestGeneration = uiReadGeneration;
    var requestedPeriod = reportPeriodDefinition(requestedDate);
    if (options.showOverlay) focusedRefreshOverlay('reports', 'Loading the selected day and its two comparison days…');
    if (state.activeTab === 'Reports') renderReports();
    try {
      var selectedResult = await api('reportsSnapshot', { fromDate: requestedDate, toDate: requestedDate });
      if (requestGeneration !== uiReadGeneration || state.activeTab !== 'Reports' || requestedDate !== state.reportFrom) return;

      var previousResult = null;
      var lastWeekResult = null;
      var comparisonFailures = [];
      try {
        previousResult = await api('reportsSnapshot', { fromDate: requestedPeriod.previousFrom, toDate: requestedPeriod.previousTo });
      } catch (previousErr) {
        if (isStaleResponseError(previousErr) || requestGeneration !== uiReadGeneration) return;
        comparisonFailures.push('previous-day comparison unavailable');
      }
      if (requestGeneration !== uiReadGeneration || state.activeTab !== 'Reports' || requestedDate !== state.reportFrom) return;
      try {
        lastWeekResult = await api('reportsSnapshot', { fromDate: requestedPeriod.lastWeekFrom, toDate: requestedPeriod.lastWeekTo });
      } catch (lastWeekErr) {
        if (isStaleResponseError(lastWeekErr) || requestGeneration !== uiReadGeneration) return;
        comparisonFailures.push('same-weekday comparison unavailable');
      }
      if (requestGeneration !== uiReadGeneration || state.activeTab !== 'Reports' || requestedDate !== state.reportFrom) return;

      mergeTransactionData(combineReportSnapshots([selectedResult, previousResult, lastWeekResult]));
      state.reportLoadedDate = requestedDate;
      state.reportComparisonAvailability = { previous: !!previousResult, lastWeek: !!lastWeekResult };
      clearSyncFault('reports');
      recoverStatusIfHealthy();
      entry.updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      entry.warning = comparisonFailures.join('; ');
      if (comparisonFailures.length && !options.silent) toast('Selected day loaded. ' + comparisonFailures.join('; ') + '.');
    } catch (err) {
      if (isStaleResponseError(err) || requestGeneration !== uiReadGeneration) return;
      markSyncFault('reports', err);
      entry.error = err.message || String(err);
      if (!options.silent) toast('Reports refresh failed. Previous report data is still displayed.');
    } finally {
      var pendingDate = entry.pendingDate;
      entry.inFlight = false;
      entry.requestedDate = '';
      entry.pendingDate = '';
      if (options.showOverlay) hideBusyMessage();
      if (state.activeTab === 'Reports') renderReports();
      if (pendingDate && pendingDate !== requestedDate && state.activeTab === 'Reports') {
        setTimeout(function () { refreshReportsData({ silent: true, showOverlay: false }); }, 0);
      }
    }
  }


  async function refreshTicketHistoryData(options) {
    options = options || {};
    var entry = state.focusedRefresh.history;
    if (entry.inFlight) return;
    entry.inFlight = true;
    entry.error = '';
    var requestGeneration = uiReadGeneration;
    var requestedDate = state.historyDate;
    if (options.showOverlay) focusedRefreshOverlay('history', 'Checking for new tickets and loading the selected day…');
    if (state.activeTab === 'Live Tickets') renderLiveTickets();
    try {
      var result = await api('ticketHistorySnapshot', { date: requestedDate });
      if (requestGeneration !== uiReadGeneration || state.activeTab !== 'Live Tickets' || requestedDate !== state.historyDate) return;
      mergeTransactionData(result.data || {});
      clearSyncFault('ticket-history');
      recoverStatusIfHealthy();
      entry.updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (err) {
      if (isStaleResponseError(err) || requestGeneration !== uiReadGeneration) return;
      markSyncFault('ticket-history', err);
      entry.error = err.message || String(err);
      if (!options.silent) toast('Ticket History refresh failed. Previous ticket data is still displayed.');
    } finally {
      entry.inFlight = false;
      if (options.showOverlay) hideBusyMessage();
      if (state.activeTab === 'Live Tickets') renderLiveTickets();
    }
  }

  async function openFocusedTab(tab) {
    var today = todayDateString(new Date());
    if (tab === 'Reports') {
      state.reportFrom = today;
      state.reportTo = today;
      state.reportLoadedDate = '';
      state.reportComparisonAvailability = { previous: false, lastWeek: false };
      render();
      await refreshReportsData({ silent: true, showOverlay: true });
      return;
    }
    if (tab === 'Live Tickets') {
      state.historyDate = today;
      render();
      await refreshTicketHistoryData({ silent: true, showOverlay: true });
      return;
    }
    if (tab === 'Till' && !state.cart.length) {
      resetCurrentOrderState({ keepServerName: true });
      saveLocal();
    }
    render();
    if (tab === 'Till' && !state.cart.length) scheduleOrderTypePrompt('till');
  }

  function mergedLiveTicketRows(selectedDay) {
    var serverTickets = (state.data.tickets || []).filter(function (ticket) { return ticketDateString(ticket.CreatedAt) === selectedDay; });
    var serverByRequest = {};
    var serverByTicketId = {};
    serverTickets.forEach(function (ticket) {
      if (ticket.ClientRequestID) serverByRequest[String(ticket.ClientRequestID)] = ticket;
      if (ticket.TicketID) serverByTicketId[String(ticket.TicketID)] = ticket;
    });
    var rows = serverTickets.map(function (ticket) { return { source: 'server', ticket: ticket, clientRequestId: String(ticket.ClientRequestID || '') }; });
    (state.dailyLocalTickets || []).forEach(function (record) {
      if (dailyTicketDateString(record) !== selectedDay) return;
      var confirmedTicketId = record.serverTicket && record.serverTicket.ticket && record.serverTicket.ticket.TicketID;
      if (serverByRequest[String(record.clientRequestId || '')] || (confirmedTicketId && serverByTicketId[String(confirmedTicketId)])) return;
      var bundle = record.preview || previewTicketBundle(record.payload || {});
      var ticket = Object.assign({}, bundle.ticket || {});
      if (record.serverTicket && record.serverTicket.ticket) ticket = Object.assign(ticket, record.serverTicket.ticket);
      ticket.TicketID = ticket.TicketID || ('LOCAL:' + record.clientRequestId);
      ticket.TicketNumber = (record.serverTicket && record.serverTicket.ticket && record.serverTicket.ticket.TicketNumber) || ticket.TicketNumber || 'Local';
      if (/saving/i.test(String(ticket.TicketNumber || ''))) ticket.TicketNumber = 'Local';
      if (record.syncStatus !== 'SYNCED') ticket.Status = 'PAID — awaiting sync';
      ticket.CreatedAt = ticket.CreatedAt || record.createdAt;
      rows.push({ source: 'local', ticket: ticket, record: record, bundle: bundle, clientRequestId: record.clientRequestId });
    });
    return rows.sort(function (a, b) { return String(b.ticket.CreatedAt || '').localeCompare(String(a.ticket.CreatedAt || '')); });
  }

  function renderLiveTickets() {
    var selectedDay = state.historyDate || todayDateString(new Date());
    var rows = mergedLiveTicketRows(selectedDay);
    $('main').innerHTML = '<section class="panel"><div class="loader-header"><div><h2>Ticket History</h2><div class="help">Showing server tickets and this device\'s retained local copies for ' + escapeHtml(selectedDay) + '</div></div><div class="screen-refresh-actions">' + refreshStatusMarkup('history') + '<button class="secondary" data-action="export-daily-ticket-backup">Export local backup</button><button class="secondary" data-action="refresh-ticket-history">Refresh</button></div></div>' +
      '<div class="report-filters"><label><span>Date</span><input class="input" type="date" id="historyDate" value="' + attr(selectedDay) + '"></label><button class="secondary" data-action="history-today">Today</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Time</th><th>Type</th><th>Total</th><th>Payment</th><th>Storage</th><th>Status</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (entry) {
        var t = entry.ticket;
        var local = entry.source === 'local';
        var syncStatus = local ? String(entry.record.syncStatus || 'PENDING_SYNC') : 'SYNCED';
        var storage = local ? (syncStatus === 'SYNCED' ? 'Local copy — server confirmed' : 'Local — waiting to sync') : 'Server confirmed';
        var id = local ? ('LOCAL:' + entry.clientRequestId) : t.TicketID;
        var actions = '<button class="secondary" data-action="view-ticket" data-id="' + attr(id) + '">View</button>';
        if (!local || syncStatus === 'SYNCED') actions += '<button class="primary" data-action="email-ticket" data-id="' + attr(t.TicketID) + '" data-client-request-id="' + attr(entry.clientRequestId || '') + '">Email receipt</button>';
        if (!local) actions += '<button class="danger" data-action="refund-ticket" data-id="' + attr(t.TicketID) + '">Refund</button>';
        return '<tr><td>' + (local && t.TicketNumber === 'Local' ? 'Local ticket' : '#' + escapeHtml(t.TicketNumber)) + '</td><td>' + escapeHtml(formatDate(t.CreatedAt)) + '</td><td>' + escapeHtml(t.OrderType || '') + '</td><td>' + Core.money(t.Total) + '</td><td>' + escapeHtml(t.PaymentMethod || '') + '</td><td><span class="status-pill">' + escapeHtml(storage) + '</span></td><td>' + escapeHtml(t.Status || 'PAID') + '</td><td><div class="row compact-actions">' + actions + '</div></td></tr>';
      }).join('') : '<tr><td colspan="8">No tickets found for this date.</td></tr>') + '</tbody></table></div></section>';
  }

  function exportDailyTicketBackup() {
    var rows = (state.dailyLocalTickets || []).slice();
    var blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), frontendVersion: CONFIG.frontendVersion || '', tickets: rows }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nook-local-ticket-backup-' + todayDateString(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function viewTicket(ticketId) {
    if (String(ticketId || '').indexOf('LOCAL:') === 0) {
      var requestId = String(ticketId).slice(6);
      var record = (state.dailyLocalTickets || []).find(function (x) { return String(x.clientRequestId) === requestId; });
      if (!record) { toast('The local ticket copy is no longer available on this device.'); return; }
      var bundle = record.preview || previewTicketBundle(record.payload || {});
      var ticket = Object.assign({}, bundle.ticket || {});
      if (record.serverTicket && record.serverTicket.ticket) ticket = Object.assign(ticket, record.serverTicket.ticket);
      if (/saving/i.test(String(ticket.TicketNumber || ''))) ticket.TicketNumber = 'Local';
      if (record.syncStatus !== 'SYNCED') ticket.Status = 'PAID — awaiting sync';
      showReceipt(ticket, bundle.ticketItems || [], bundle.ticketAddOns || [], { title: record.syncStatus === 'SYNCED' ? 'Local Ticket Copy' : 'Local Ticket — Awaiting Sync' });
      return;
    }
    var t = (state.data.tickets || []).find(function (x) { return x.TicketID === ticketId; });
    if (!t) return;
    var items = (state.data.ticketItems || []).filter(function (x) { return x.TicketID === ticketId; });
    var addons = (state.data.ticketAddOns || []).filter(function (x) { return x.TicketID === ticketId; });
    showReceipt(t, items, addons);
  }

  function openEmailReceiptModal(ticketId, clientRequestId) {
    var ticket = (state.data.tickets || []).find(function (x) { return x.TicketID === ticketId; });
    if (!ticket && activeReceiptBundle && activeReceiptBundle.ticket && String(activeReceiptBundle.ticket.TicketID) === String(ticketId)) ticket = activeReceiptBundle.ticket;
    if (!ticket) { toast('Receipt details are no longer available on this device. Open the ticket from Ticket History after synchronisation.'); return; }
    $('modalRoot').innerHTML = '<div class="modal-backdrop"><div class="modal email-receipt-modal">' +
      '<h2>Email receipt</h2>' +
      '<div class="receipt-banner"><strong>Ticket #' + escapeHtml(ticket.TicketNumber) + '</strong><span>The request is stored safely now and will send automatically after the sale reaches the server.</span></div>' +
      '<label><span>Customer email address</span><input class="input" id="receiptEmailAddress" type="email" inputmode="email" autocomplete="email" placeholder="customer@example.com"></label>' +
      '<label><span>Optional message</span><textarea class="textarea" id="receiptEmailMessage" placeholder="Thank you for visiting The Nook."></textarea></label>' +
      '<div id="receiptEmailStatus" class="help">Google Apps Script email quota applies.</div>' +
      '<div class="row"><button class="secondary" data-modal-action="close">Cancel</button><button class="primary" data-modal-action="send-receipt-email" data-ticket-id="' + attr(ticketId) + '" data-client-request-id="' + attr(clientRequestId || (activeReceiptBundle && activeReceiptBundle.clientRequestId) || '') + '">Send receipt</button></div>' +
    '</div></div>';
    setTimeout(function () { var el = $('receiptEmailAddress'); if (el) el.focus(); }, 0);
  }

  async function sendReceiptEmail(ticketId, clientRequestId, button) {
    var emailEl = $('receiptEmailAddress');
    var messageEl = $('receiptEmailMessage');
    var statusEl = $('receiptEmailStatus');
    var email = String(emailEl && emailEl.value || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { if (statusEl) statusEl.textContent = 'Enter a valid email address.'; return; }
    var record = { id: Core.uid('EMAIL'), action: 'emailReceipt', payload: { ticketId: ticketId, clientRequestId: String(clientRequestId || ''), email: email, message: String(messageEl && messageEl.value || '').trim() }, status: 'PENDING', createdAt: new Date().toISOString(), attempts: 0, lastError: '' };
    try {
      await QueueManager.outboxPut(record);
      closeModal();
      state.status.write = 'email queued';
      state.status.message = 'Receipt queued for email — delivery continues in the background';
      renderStatus();
      window.setTimeout(processDurableOutbox, 0);
    } catch (err) {
      if (button) { button.disabled = false; button.textContent = 'Send receipt'; }
      if (statusEl) statusEl.textContent = 'Receipt request could not be stored safely: ' + err.message;
    }
  }

  var durableOutboxInFlight = false;
  async function processDurableOutbox() {
    if (durableOutboxInFlight || !state.serverReady || !isConfiguredUrl()) return;
    durableOutboxInFlight = true;
    try {
      var rows = await QueueManager.outboxAll();
      for (var i=0;i<rows.length;i++) {
        var row=rows[i]; if (row.status==='SYNCED') continue;
        row.status='SYNCING'; row.attempts=Number(row.attempts||0)+1; await QueueManager.outboxPut(row);
        try {
          if (row.action === 'emailReceipt' && row.payload && row.payload.clientRequestId) {
            var transactionRows = await QueueManager.all();
            var transactionRow = transactionRows.find(function (x) { return String(x.clientRequestId || '') === String(row.payload.clientRequestId || ''); });
            if (!transactionRow || transactionRow.syncStatus !== 'SYNCED' || !transactionRow.serverTicket || !transactionRow.serverTicket.ticket) {
              throw new Error('WAITING_FOR_TRANSACTION_SYNC');
            }
            row.payload.ticketId = transactionRow.serverTicket.ticket.TicketID;
            await QueueManager.outboxPut(row);
          }
          await api(row.action, row.payload);
          await QueueManager.outboxRemove(row.id);
          clearSyncFault('durable-outbox');
          state.status.write='OK';
          recoverStatusIfHealthy();
          renderStatus();
        } catch(err) {
          row.status='PENDING'; row.lastError=String(err.message||err); await QueueManager.outboxPut(row);
          if (String(err.message || err) !== 'WAITING_FOR_TRANSACTION_SYNC') markSyncFault('durable-outbox', err);
          state.status.write='email waiting'; state.status.message='Receipt email remains safely queued — automatic retry continues'; renderStatus();
          break;
        }
      }
    } finally { durableOutboxInFlight=false; }
  }

  function refundInReportRange(refund) {
    if (!refund || !refund.CreatedAt) return false;
    return ticketDateString(refund.CreatedAt) === reportRangeLabel();
  }

  function reportCategoryRows(ticketIdMap) {
    var map = {};
    (state.data.ticketItems || []).forEach(function (item) {
      if (ticketIdMap && !ticketIdMap[item.TicketID]) return;
      var name = item.CategoryName || categoryName(item.CategoryID) || 'Uncategorised';
      if (!map[name]) map[name] = { name: name, qty: 0, sales: 0 };
      map[name].qty += Core.toNumber(item.Quantity, 0);
      map[name].sales += Core.roundMoney(Core.toNumber(item.LineTotal, 0) - Core.toNumber(item.LoyaltyDiscount, 0));
    });
    return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a,b) { return b.sales-a.sales; });
  }

  function reportAddOnRows(ticketIdMap) {
    var map = {};
    (state.data.ticketAddOns || []).forEach(function (item) {
      if (ticketIdMap && !ticketIdMap[item.TicketID]) return;
      var name = item.OptionText || item.PromptTitle || 'Additional item';
      if (!map[name]) map[name] = { name: name, qty: 0, sales: 0 };
      map[name].qty += Core.toNumber(item.Quantity, 0);
      map[name].sales += Core.toNumber(item.Total, Core.toNumber(item.UnitPrice, 0) * Core.toNumber(item.Quantity, 0));
    });
    return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a,b) { return b.sales-a.sales || b.qty-a.qty; });
  }

  function reportHourlyRows(tickets) {
    var map = {};
    tickets.forEach(function (ticket) {
      var date = new Date(ticket.CreatedAt);
      if (isNaN(date.getTime())) return;
      var hour = date.getHours();
      if (!map[hour]) map[hour] = { hour: hour, tickets: 0, sales: 0 };
      map[hour].tickets += 1;
      map[hour].sales += Core.toNumber(ticket.Total, 0);
    });
    return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a,b) { return a.hour-b.hour; });
  }

  function reportBarRows(rows, valueKey, formatter, emptyMessage) {
    if (!rows.length) return '<div class="report-empty">' + escapeHtml(emptyMessage || 'No data for this period.') + '</div>';
    var max = rows.reduce(function (value, row) { return Math.max(value, Core.toNumber(row[valueKey], 0)); }, 0) || 1;
    return '<div class="report-bars">' + rows.map(function (row) {
      var width = Math.max(3, Math.round((Core.toNumber(row[valueKey], 0) / max) * 100));
      return '<div class="report-bar-row"><div class="report-bar-label">' + escapeHtml(row.label || row.name || '') + '</div><div class="report-bar-track"><span style="width:' + width + '%"></span></div><div class="report-bar-value">' + escapeHtml(formatter(row)) + '</div></div>';
    }).join('') + '</div>';
  }

  function renderReports() {
    var period = reportPeriodDefinition();
    var current = reportMetrics(period.from, period.to);
    var previous = reportMetrics(period.previousFrom, period.previousTo);
    var lastWeek = reportMetrics(period.lastWeekFrom, period.lastWeekTo);
    var tickets = current.tickets;
    var refunds = current.refunds;
    var ticketIdMap = current.ids;
    var grossSales = current.gross;
    var refundTotal = current.refundsTotal;
    var netSales = current.net;
    var loyaltyGiven = current.loyaltyDiscount;
    var staffDiscountGiven = current.staffDiscount;
    var cashSales = current.cash;
    var cardSales = current.card;
    var averageTicket = current.average;
    var loyaltyRedemptions = current.loyaltyRedemptions;
    var itemRows = itemReportRows(ticketIdMap);
    var categoryRows = reportCategoryRows(ticketIdMap);
    var addOnRows = reportAddOnRows(ticketIdMap);
    var hourlyRows = reportHourlyRows(tickets).map(function (row) { row.label = String(row.hour).padStart(2,'0') + ':00'; return row; });
    var bestHour = hourlyRows.slice().sort(function (a,b) { return b.sales-a.sales; })[0];
    var topItem = itemRows[0];
    var refundRate = grossSales ? (refundTotal / grossSales) * 100 : 0;
    var discountTotal = Core.roundMoney(staffDiscountGiven + loyaltyGiven);
    var snapshotCards = [
      ['Net sales', Core.money(netSales), 'Gross sales less refunds', 'primary'],
      ['Cash sales', Core.money(cashSales), 'Cash payments', 'cash'],
      ['Card sales', Core.money(cardSales), 'Card payments', 'card'],
      ['Tickets', String(tickets.length), 'Completed sales', 'tickets'],
      ['Average ticket', Core.money(averageTicket), 'Net sales per ticket', 'average'],
      ['Staff discount', Core.money(staffDiscountGiven), 'Discount given', 'discount'],
      ['Loyalty discount', Core.money(loyaltyGiven), loyaltyRedemptions + ' redeemed item' + (loyaltyRedemptions === 1 ? '' : 's'), 'loyalty'],
      ['Refunds', '−' + Core.money(refundTotal), refunds.length + ' refund transaction' + (refunds.length === 1 ? '' : 's'), 'refund']
    ];
    var categoryTotal = categoryRows.reduce(function (sum,row) { return sum + row.sales; }, 0) || 1;
    var previousAvailable = !!(state.reportComparisonAvailability || {}).previous;
    var lastWeekAvailable = !!(state.reportComparisonAvailability || {}).lastWeek;
    var netVsPrevious = previousAvailable ? comparisonDelta(current.net, previous.net, 'money') : null;
    var netVsLastWeek = lastWeekAvailable ? comparisonDelta(current.net, lastWeek.net, 'money') : null;
    var cashShare = current.gross ? (current.cash/current.gross)*100 : 0;
    var cardShare = current.gross ? (current.card/current.gross)*100 : 0;
    var insights = [];
    if (netVsPrevious) insights.push('Compared with the previous day, net sales are ' + Math.abs(netVsPrevious.percent).toFixed(1) + '% ' + (netVsPrevious.direction === 'up' ? 'higher' : (netVsPrevious.direction === 'down' ? 'lower' : 'unchanged')) + '.');
    if (netVsLastWeek) insights.push('Compared with the same weekday last week, net sales are ' + Math.abs(netVsLastWeek.percent).toFixed(1) + '% ' + (netVsLastWeek.direction === 'up' ? 'higher' : (netVsLastWeek.direction === 'down' ? 'lower' : 'unchanged')) + '.');
    insights.push('Card accounts for ' + cardShare.toFixed(0) + '% and cash for ' + cashShare.toFixed(0) + '% of gross sales.');
    if (topItem) insights.push(escapeHtml(topItem.name) + ' is the top-selling item with ' + topItem.qty + ' sold.');
    if (refundRate >= 5) insights.push('Refunds are elevated at ' + refundRate.toFixed(1) + '% of gross sales.');
    else insights.push('Refunds are ' + refundRate.toFixed(1) + '% of gross sales.');
    var exportReady = state.reportLoadedDate === period.from && !state.focusedRefresh.reports.inFlight;
    var sameWeekMarkup = lastWeekAvailable ? '<span>Net sales ' + (netVsLastWeek.direction === 'up' ? '▲ ' : (netVsLastWeek.direction === 'down' ? '▼ ' : '■ ')) + escapeHtml(netVsLastWeek.text) + '</span><span>Tickets ' + escapeHtml(comparisonDelta(current.ticketCount,lastWeek.ticketCount,'number').text) + '</span><span>Average ticket ' + escapeHtml(comparisonDelta(current.average,lastWeek.average,'money').text) + '</span>' : '<span>Comparison unavailable</span>';
    $('main').innerHTML = '<section class="panel reports-dashboard"><div class="loader-header"><div><h2>Reports Dashboard</h2><div class="help">Selected report date: ' + escapeHtml(reportRangeLabel()) + '. Comparison data is loaded separately for the previous day and the same weekday last week. Export contains the selected day only.</div></div><div class="screen-refresh-actions">' + refreshStatusMarkup('reports') + '<button class="secondary" data-action="refresh-reports">Reload selected day + comparisons</button></div></div>' +
      '<div class="report-filters"><label><span>Report date</span><input class="input" type="date" id="reportDate" value="' + attr(state.reportFrom) + '"></label><button class="secondary" data-action="report-today">Today</button><button class="secondary" data-action="export-reports"' + (exportReady ? '' : ' disabled') + '>Export selected day</button><button class="danger" data-action="clear-reports">Clear all reports</button></div>' +
      '<h3 class="report-section-title">Selected day snapshot</h3><div class="report-snapshot-grid">' + snapshotCards.map(function (card) { return '<article class="report-kpi report-kpi-' + card[3] + '"><span>' + escapeHtml(card[0]) + '</span><strong>' + card[1] + '</strong><small>' + escapeHtml(card[2]) + '</small></article>'; }).join('') + '</div>' +
      '<section class="report-comparison"><div class="report-widget-heading"><div><h3>' + escapeHtml(period.previousLabel) + '</h3><span>Compared with ' + escapeHtml(period.previousFrom) + '</span></div></div><div class="comparison-grid">' +
        comparisonMetricCard('Net sales', current.net, previous.net, 'money', previousAvailable) + comparisonMetricCard('Tickets', current.ticketCount, previous.ticketCount, 'number', previousAvailable) + comparisonMetricCard('Average ticket', current.average, previous.average, 'money', previousAvailable) + comparisonMetricCard('Cash sales', current.cash, previous.cash, 'money', previousAvailable) + comparisonMetricCard('Card sales', current.card, previous.card, 'money', previousAvailable) + comparisonMetricCard('Refunds', current.refundsTotal, previous.refundsTotal, 'money', previousAvailable) +
      '</div><div class="same-week-comparison"><strong>' + escapeHtml(period.lastWeekLabel) + '</strong><span>Compared with ' + escapeHtml(period.lastWeekFrom) + '</span>' + sameWeekMarkup + '</div></section>' +
      '<div class="report-dashboard-grid"><section class="report-widget report-widget-wide"><div class="report-widget-heading"><h3>Sales by hour</h3><span>Revenue and ticket flow</span></div>' + reportBarRows(hourlyRows, 'sales', function (row) { return Core.money(row.sales) + ' • ' + row.tickets + ' ticket' + (row.tickets === 1 ? '' : 's'); }, 'No hourly sales yet.') + '</section>' +
      '<section class="report-widget"><div class="report-widget-heading"><h3>Business health</h3><span>At-a-glance summary</span></div><dl class="health-list"><div><dt>Top seller</dt><dd>' + escapeHtml(topItem ? topItem.name : 'No sales') + '</dd></div><div><dt>Best hour</dt><dd>' + escapeHtml(bestHour ? bestHour.label : 'No sales') + '</dd></div><div><dt>Average ticket</dt><dd>' + Core.money(averageTicket) + '</dd></div><div><dt>Total discounts</dt><dd>' + Core.money(discountTotal) + '</dd></div><div><dt>Refund rate</dt><dd>' + refundRate.toFixed(1) + '%</dd></div></dl></section>' +
      '<section class="report-widget"><div class="report-widget-heading"><h3>Quick insights</h3><span>Automatic comparisons</span></div><ul class="manager-alerts">' + insights.map(function (insight) { return '<li>' + insight + '</li>'; }).join('') + '</ul></section>' +
      '<section class="report-widget"><div class="report-widget-heading"><h3>Category breakdown</h3><span>Net item sales</span></div>' + reportBarRows(categoryRows.map(function(row){row.label=row.name;return row;}), 'sales', function (row) { return Core.money(row.sales) + ' • ' + ((row.sales/categoryTotal)*100).toFixed(0) + '%'; }, 'No category sales yet.') + '</section>' +
      '<section class="report-widget"><div class="report-widget-heading"><h3>Top selling items</h3><span>Quantity and net value</span></div>' + reportBarRows(itemRows.slice(0,10).map(function(row){row.label=row.name;return row;}), 'qty', function (row) { return row.qty + ' • ' + Core.money(row.net); }, 'No item sales yet.') + '</section>' +
      '<section class="report-widget"><div class="report-widget-heading"><h3>Add-on performance</h3><span>Additional sales generated</span></div>' + reportBarRows(addOnRows.slice(0,10).map(function(row){row.label=row.name;return row;}), 'sales', function (row) { return row.qty + ' • ' + Core.money(row.sales); }, 'No paid add-ons on this selected day.') + '</section>' +
      '<section class="report-widget"><div class="report-widget-heading"><h3>Discounts and loyalty</h3><span>Value given</span></div><dl class="health-list"><div><dt>Staff discount</dt><dd>' + Core.money(staffDiscountGiven) + '</dd></div><div><dt>Loyalty discount</dt><dd>' + Core.money(loyaltyGiven) + '</dd></div><div><dt>Loyalty items</dt><dd>' + loyaltyRedemptions + '</dd></div><div><dt>Combined value</dt><dd>' + Core.money(discountTotal) + '</dd></div></dl></section></div>' +
      '<details class="report-details"><summary>Detailed sales, refunds and item tables</summary>' +
      '<h3>Sales</h3><div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Time</th><th>Payment</th><th>Total</th></tr></thead><tbody>' + (tickets.length ? tickets.slice().sort(function (a,b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); }).map(function (t) { return '<tr><td>#' + escapeHtml(t.TicketNumber) + '</td><td>' + escapeHtml(formatDate(t.CreatedAt)) + '</td><td>' + escapeHtml(t.PaymentMethod) + '</td><td>' + Core.money(t.Total) + '</td></tr>'; }).join('') : '<tr><td colspan="4">No sales on this selected day.</td></tr>') + '</tbody></table></div>' +
      '<h3>Refunds</h3><div class="table-wrap"><table><thead><tr><th>Refund</th><th>Original ticket</th><th>Time</th><th>Items</th><th>Reason</th><th>Staff</th><th>Deduction</th></tr></thead><tbody>' + (refunds.length ? refunds.slice().sort(function (a,b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); }).map(function (r) { var lines=(state.data.refundItems||[]).filter(function (x) { return x.RefundID===r.RefundID; }); return '<tr class="refund-row"><td>' + escapeHtml(r.RefundNumber || (String(r.TicketNumber)+'-R')) + '</td><td>#' + escapeHtml(r.TicketNumber) + '</td><td>' + escapeHtml(formatDate(r.CreatedAt)) + '</td><td>' + escapeHtml(lines.map(function(x){return x.ItemName+' x'+x.Quantity;}).join(', ')) + '</td><td>' + escapeHtml(r.Reason) + '</td><td>' + escapeHtml(r.StaffName) + '</td><td>−' + Core.money(r.Amount) + '</td></tr>'; }).join('') : '<tr><td colspan="7">No refunds on this selected day.</td></tr>') + '</tbody></table></div>' +
      '<h3>Item sales</h3><div class="table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Gross item value</th><th>Loyalty value</th><th>Net item value</th></tr></thead><tbody>' + (itemRows.length ? itemRows.map(function (r) { return '<tr><td>' + escapeHtml(r.name) + '</td><td>' + escapeHtml(r.qty) + '</td><td>' + Core.money(r.sales) + '</td><td>' + Core.money(r.loyalty) + '</td><td>' + Core.money(r.net) + '</td></tr>'; }).join('') : '<tr><td colspan="5">No item sales on this selected day.</td></tr>') + '</tbody></table></div></details></section>';
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
    var selectedDate = reportRangeLabel();
    if (state.reportLoadedDate !== selectedDate) { toast('Load the selected report day before exporting it.'); return; }
    var tickets=(state.data.tickets||[]).filter(function(t){return (t.Status||'PAID')!=='VOID'&&ticketInReportRange(t);});
    var refunds=(state.data.refunds||[]).filter(refundInReportRange); var ids={}; tickets.forEach(function(t){ids[t.TicketID]=true;});
    var gross=tickets.reduce(function(sum,t){return sum+Core.toNumber(t.Total,0);},0); var refundTotal=refunds.reduce(function(sum,r){return sum+Core.toNumber(r.Amount,0);},0);
    var rows=[['REPORT DATE',selectedDate],[],['SUMMARY'],['Gross Sales',gross.toFixed(2)],['Refunds',(-refundTotal).toFixed(2)],['Net Sales',Core.roundMoney(gross-refundTotal).toFixed(2)],[],['SALES'],['Ticket Number','Created At','Order Type','Server','Table','Customer','Payment Method','Total','Status']];
    tickets.forEach(function(t){rows.push([t.TicketNumber,t.CreatedAt,t.OrderType,t.ServerName,t.TableNumber,t.CustomerName,t.PaymentMethod,t.Total,t.Status||'PAID']);});
    rows.push([],['REFUNDS'],['Refund Number','Original Ticket','Created At','Item','Quantity','Refund Amount','Reason','Staff']);
    refunds.forEach(function(r){var lines=(state.data.refundItems||[]).filter(function(x){return x.RefundID===r.RefundID;}); if(!lines.length) rows.push([r.RefundNumber||String(r.TicketNumber)+'-R',r.TicketNumber,r.CreatedAt,'', '',(-Core.toNumber(r.Amount,0)).toFixed(2),r.Reason,r.StaffName]); else lines.forEach(function(line){rows.push([r.RefundNumber||String(r.TicketNumber)+'-R',r.TicketNumber,r.CreatedAt,line.ItemName,line.Quantity,(-Core.toNumber(line.LineRefundTotal,0)).toFixed(2),r.Reason,r.StaffName]);});});
    rows.push([],['ITEM LINES'],['Ticket Number','Item','Quantity','Base Price','Line Total','Loyalty Discount','Notes']);
    (state.data.ticketItems||[]).filter(function(i){return ids[i.TicketID];}).forEach(function(i){var ticket=tickets.find(function(t){return t.TicketID===i.TicketID;})||{};rows.push([ticket.TicketNumber,i.ItemName,i.Quantity,i.BasePrice,i.LineTotal,i.LoyaltyDiscount,i.Notes||'']);});
    var csv=rows.map(function(row){return row.map(csvCell).join(',');}).join('\r\n');var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nook-report-'+selectedDate+'.csv';a.click();URL.revokeObjectURL(a.href);toast('Report export created for '+selectedDate+' only.');
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
    return '<div class="kitchen-ticket' + (complete ? ' complete' : '') + (arriving ? ' kitchen-ticket-arriving' : '') + ageClass + '" data-kitchen-id="' + attr(k.KitchenID) + '"><div class="stamp">COMPLETED</div><div class="kitchen-header"><div><div class="ticket-last4">#' + escapeHtml(ticketNumber) + '</div><strong>' + escapeHtml(k.OrderType || payload.OrderType || '') + '</strong><div class="help">' + escapeHtml(formatDate(createdAt)) + '</div>' + (meta.length ? '<div class="help">' + escapeHtml(meta.join(' • ')) + '</div>' : '') + '</div><div class="kitchen-ticket-actions">' + (kitchenAgeEnabled() ? '<div class="kitchen-age" data-kitchen-created="' + attr(createdAt) + '" aria-label="Ticket age">' + escapeHtml(formatKitchenAge(age.elapsedMs)) + '</div>' : '') + (!complete ? '<button class="danger kitchen-complete-all" data-action="complete-kitchen" data-id="' + attr(k.KitchenID) + '"' + (state.kitchenPendingUpdates[k.KitchenID] ? ' disabled' : '') + '>' + (state.kitchenPendingUpdates[k.KitchenID] ? 'Saving…' : 'Complete both') + '</button>' : '<button class="secondary" data-action="reopen-kitchen" data-id="' + attr(k.KitchenID) + '"' + (state.kitchenPendingUpdates[k.KitchenID] ? ' disabled' : '') + '>' + (state.kitchenPendingUpdates[k.KitchenID] ? 'Saving…' : 'Reopen ticket') + '</button>') + '</div></div>' +
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

  function kitchenUpdateRequestFor(id, change) {
    if (change && change.completeAll) return { KitchenID: id, CompleteAll: true };
    if (change && change.reopenAll) return { KitchenID: id, ReopenAll: true };
    return { KitchenID: id, SectionName: change.sectionName, SectionStatus: change.status };
  }

  async function retryDeferredKitchenUpdates() {
    var ids = Object.keys(state.kitchenDeferredUpdates || {});
    for (var i = 0; i < ids.length; i += 1) {
      var id = ids[i];
      var change = state.kitchenDeferredUpdates[id];
      if (!change || state.kitchenPendingUpdates[id]) continue;
      state.kitchenPendingUpdates[id] = true;
      try {
        var result = await api('kitchenUpdate', kitchenUpdateRequestFor(id, change));
        var row = (state.data.kitchenQueue || []).find(function (x) { return x.KitchenID === id; });
        if (row && result && result.saved) {
          row.Status = result.saved.Status || row.Status;
          row.PayloadJSON = result.saved.PayloadJSON || row.PayloadJSON;
        }
        delete state.kitchenDeferredUpdates[id];
        state.status.mode = 'live';
        state.status.read = 'OK';
        state.status.write = 'OK';
        state.status.message = 'Ready';
      } catch (err) {
        state.status.mode = 'warn';
        state.status.read = 'OK';
        state.status.write = 'kitchen retrying';
        state.status.message = 'Kitchen change saved on this display and awaiting server synchronisation';
      } finally {
        delete state.kitchenPendingUpdates[id];
      }
    }
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
      state.kitchenDeferredUpdates[id] = { sectionName: sectionName, status: status };
      state.status.mode = 'warn';
      state.status.read = 'OK';
      state.status.write = 'kitchen retrying';
      state.status.message = 'Kitchen change saved on this display and awaiting server synchronisation';
      toast('Kitchen change retained. It will synchronise automatically.', 'warning');
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
      state.kitchenDeferredUpdates[id] = { completeAll: true };
      state.status.mode = 'warn';
      state.status.read = 'OK';
      state.status.write = 'kitchen retrying';
      state.status.message = 'Kitchen ticket closed on this display and awaiting server synchronisation';
      toast('Ticket remains closed here and will synchronise automatically.', 'warning');
    } finally {
      delete state.kitchenPendingUpdates[id];
      if (state.activeTab === 'Kitchen') render();
      renderStatus();
      if (isConfiguredUrl()) syncKitchenQueue({ silent: true });
    }
  }

  async function reopenKitchen(id) {
    if (state.kitchenPendingUpdates[id]) return;
    var k = (state.data.kitchenQueue || []).find(function (x) { return x.KitchenID === id; });
    if (!k) return;
    var payload = safeJson(k.PayloadJSON);
    payload.Sections = payload.Sections || {};
    payload.Sections.FoodStatus = 'OPEN';
    payload.Sections.DrinksStatus = 'OPEN';
    payload.Sections.CompletedAt = '';
    k.Status = 'OPEN';
    k.PayloadJSON = JSON.stringify(payload);
    delete state.kitchenRecentlyCompleted[id];
    state.kitchenPendingUpdates[id] = true;
    renderKitchen();
    try {
      var result = await api('kitchenUpdate', { KitchenID: id, ReopenAll: true });
      if (result && result.saved) {
        k.Status = result.saved.Status || 'OPEN';
        k.PayloadJSON = result.saved.PayloadJSON || k.PayloadJSON;
      }
      delete state.kitchenDeferredUpdates[id];
      state.status.mode = 'live';
      state.status.read = 'OK';
      state.status.write = 'OK';
      state.status.message = 'Ready';
    } catch (err) {
      state.kitchenDeferredUpdates[id] = { reopenAll: true };
      state.status.mode = 'warn';
      state.status.read = 'OK';
      state.status.write = 'kitchen retrying';
      state.status.message = 'Kitchen ticket reopened on this display and awaiting server synchronisation';
      toast('Ticket remains reopened here and will synchronise automatically.', 'warning');
    } finally {
      delete state.kitchenPendingUpdates[id];
      if (state.activeTab === 'Kitchen') renderKitchen();
      renderStatus();
    }
  }

  async function removeSyncedLocalTicketFromDevice(localId) {
    var rows = localTickets();
    var record = rows.find(function (x) { return x.localId === localId; });
    if (!record) { toast('The local ticket copy is no longer stored on this device.'); renderLocalTickets(); return; }
    if (record.syncStatus !== 'SYNCED') {
      toast('This ticket is still waiting to sync and cannot be removed with the normal Remove button.', 'warning');
      return;
    }
    showBusyMessage('Removing Local Ticket', 'Removing this confirmed ticket copy from this device only…');
    try {
      await QueueManager.removeTicketCopies(record.clientRequestId);
      state.dailyLocalTickets = (state.dailyLocalTickets || []).filter(function (x) { return x.clientRequestId !== record.clientRequestId; });
      saveLocalTickets(await QueueManager.all());
      hideBusyMessage();
      renderLocalTickets();
      toast('Local ticket copy removed. The live server ticket was not changed.');
    } catch (err) {
      hideBusyMessage();
      renderLocalTickets();
      toast('The local ticket could not be removed: ' + (err.message || String(err)), 'error');
    }
  }

  async function clearAllLocalTicketsFromDevice() {
    if (state.paymentInProgress) { toast('Finish the current payment before clearing local tickets.', 'warning'); return; }
    var rows = localTickets();
    if (!rows.length) { toast('There are no device-local tickets to clear.'); return; }
    var pending = rows.filter(function (x) { return x.syncStatus !== 'SYNCED'; }).length;
    var message = 'This permanently removes all ' + rows.length + ' local ticket copy/copies from this device only. It does not contact the server and does not delete live Ticket History.';
    if (pending) message += ' WARNING: ' + pending + ' ticket(s) have not been confirmed by the server. Clearing them will permanently remove this device\'s only queued copy and they will not upload later.';
    var confirmed = await themedConfirm({
      title: 'Clear all local tickets?',
      message: message,
      confirmText: pending ? 'Continue' : 'Clear local tickets',
      cancelText: 'Cancel',
      danger: true
    });
    if (!confirmed) return;
    if (pending) {
      var finalConfirmed = await themedConfirm({
        title: 'Unsynchronised tickets will be lost',
        message: 'There are ' + pending + ' unsynchronised ticket(s). This local-only clear cannot be undone and will not send them to the server. Remove them anyway?',
        confirmText: 'Delete unsynchronised tickets',
        cancelText: 'Keep tickets',
        danger: true
      });
      if (!finalConfirmed) return;
    }
    showBusyMessage('Clearing Local Tickets', 'Removing device-local ticket stores only. The server is not being changed…');
    try {
      // Stop new background work and invalidate any older local-ticket sync cycle before
      // clearing the stores. No delete/clear request is sent to the server.
      stopSyncCoordinator();
      localTicketStoreGeneration += 1;
      await QueueManager.clearTicketStores();
      state.dailyLocalTickets = [];
      saveLocalTickets([]);
      clearSyncFault('transaction-upload');
      if (localModeEnabled()) setLocalMode(false);
      state.status.write = 'OK';
      recoverStatusIfHealthy();
      hideBusyMessage();
      if (!manualSyncPaused && !maintenanceActionActive && state.serverReady && isConfiguredUrl()) startSyncCoordinator();
      renderLocalTickets();
      renderStatus();
      toast('All local ticket copies were removed from this device only. Live server tickets were not changed.');
    } catch (err) {
      hideBusyMessage();
      if (!manualSyncPaused && !maintenanceActionActive && state.serverReady && isConfiguredUrl()) startSyncCoordinator();
      renderLocalTickets();
      toast('Local tickets could not be cleared: ' + (err.message || String(err)), 'error');
    }
  }

  function renderLocalTickets() {
    var rows = localTickets().slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    var pending = rows.filter(function (x) { return x.syncStatus !== 'SYNCED'; }).length;
    var html = '<section class="panel"><div class="loader-header"><div><h2>Device Local Tickets</h2>' +
      '<div class="help">Paid tickets held safely on this device while the server is unavailable. They upload automatically using their unique request ID when synchronisation returns.</div></div>' +
      '<div class="kitchen-header-actions"><span class="kitchen-count"><strong>' + pending + '</strong> waiting</span><span class="kitchen-count"><strong>' + rows.length + '</strong> stored</span>' +
      '<button class="secondary" data-action="sync-local-tickets">Sync now</button><button class="danger" data-action="clear-all-local-tickets">Clear local tickets</button></div></div>';
    if (!rows.length) html += '<div class="empty">No device-local tickets are stored.</div>';
    html += '<div class="kitchen-grid">' + rows.map(renderLocalTicketCard).join('') + '</div></section>';
    $('main').innerHTML = html;
  }

  function renderLocalTicketCard(record) {
    var bundle = record.preview || previewTicketBundle(record.payload || {});
    var ticket = bundle.ticket || {};
    var items = bundle.ticketItems || [];
    var addons = bundle.ticketAddOns || [];
    var statusText = record.syncStatus === 'SYNCED' ? 'Synced' : (record.syncStatus === 'SYNCING' ? 'Syncing…' : 'Waiting to sync');
    var localStatus = record.localStatus === 'COMPLETE' ? 'Completed locally' : 'Open locally';
    return '<article class="kitchen-ticket local-ticket-card ' + (record.localStatus === 'COMPLETE' ? 'complete' : '') + '">' +
      '<header><div><strong>Local #' + escapeHtml(String(record.localId || '').slice(-8)) + '</strong><div class="help">' + escapeHtml(new Date(record.createdAt).toLocaleString()) + '</div></div>' +
      '<div><span class="status-pill">' + escapeHtml(statusText) + '</span><span class="status-pill">' + escapeHtml(localStatus) + '</span></div></header>' +
      '<div class="ticket-meta"><span>' + escapeHtml(ticket.OrderType || '') + '</span><span>Table ' + escapeHtml(ticket.TableNumber || '—') + '</span><span>' + escapeHtml(ticket.CustomerName || '') + '</span><span>' + escapeHtml(ticket.PaymentMethod || '') + ' £' + Core.toNumber(ticket.Total, 0).toFixed(2) + '</span></div>' +
      '<div class="kitchen-section"><h4>Order details</h4>' + items.map(function (item) {
        var itemAddons = addons.filter(function (a) { return a.TicketItemID === item.TicketItemID; });
        return '<div class="kitchen-line"><strong>' + escapeHtml(String(item.Quantity || 1)) + '× ' + escapeHtml(item.ItemName || '') + '</strong>' +
          (itemAddons.length ? '<div class="kitchen-addons">' + itemAddons.map(function (a) { return '<div>' + escapeHtml(String(a.Quantity || 1)) + '× ' + escapeHtml(a.OptionText || '') + (a.PromptTitle ? ' <span class="help">(' + escapeHtml(a.PromptTitle) + ')</span>' : '') + '</div>'; }).join('') + '</div>' : '') +
          (item.Note ? '<div class="ticket-note">Note: ' + escapeHtml(item.Note) + '</div>' : '') + '</div>';
      }).join('') + '</div>' +
      (record.lastError ? '<div class="warning-box">Last sync error: ' + escapeHtml(record.lastError) + '</div>' : '') +
      '<div class="row"><button class="' + (record.localStatus === 'COMPLETE' ? 'secondary' : 'primary') + '" data-action="toggle-local-ticket-complete" data-id="' + attr(record.localId) + '">' + (record.localStatus === 'COMPLETE' ? 'Reopen locally' : 'Complete locally') + '</button>' +
      (record.syncStatus === 'SYNCED' ? '<button class="danger" data-action="remove-synced-local-ticket" data-id="' + attr(record.localId) + '">Remove from device</button>' : '') + '</div></article>';
  }


  function openAdminWizard(kind, parentId) {
    var cats = categories();
    var html = '';
    if (kind === 'item') {
      html = '<div class="modal-backdrop"><div class="modal admin-wizard-modal" role="dialog" aria-modal="true"><h2>Add menu item</h2><p class="help">Complete the required details. The item will open in protected edit mode so prompts can be added before saving.</p><div class="form-grid clean-form">' +
        '<label class="span2"><span>Item name *</span><input class="input" id="wizardItemName" placeholder="e.g. Bacon roll"></label>' +
        '<label><span>Category *</span><select class="select" id="wizardItemCategory">' + cats.map(function(c){return '<option value="'+attr(c.CategoryID)+'">'+escapeHtml(c.CategoryName)+'</option>';}).join('') + '</select></label>' +
        '<label><span>Selling price *</span><div class="money-input"><span>£</span><input class="input" id="wizardItemPrice" inputmode="decimal" placeholder="0.00"></div></label>' +
        '<label class="span2"><span>Description</span><textarea class="textarea" id="wizardItemDescription" placeholder="Optional till description"></textarea></label>' +
        '<label class="switchline"><input type="checkbox" id="wizardItemActive" checked> Show on till</label><label class="switchline"><input type="checkbox" id="wizardItemLoyalty"> Loyalty eligible</label></div>' +
        '<div class="wizard-validation" id="wizardValidation"></div><div class="row"><button class="secondary" data-modal-action="close">Cancel</button><button class="primary" data-modal-action="create-guided-item">Create item</button></div></div></div>';
    } else if (kind === 'prompt') {
      html = '<div class="modal-backdrop"><div class="modal admin-wizard-modal" role="dialog" aria-modal="true"><h2>Add prompt</h2><p class="help">Create the question first, then add its options in the protected item editor.</p><div class="form-grid clean-form">' +
        '<label class="span2"><span>Question shown at the till *</span><input class="input" id="wizardPromptTitle" placeholder="e.g. Choose your bread"></label>' +
        '<label><span>Selection type</span><select class="select" id="wizardPromptType"><option value="single">Single choice</option><option value="multi">Multiple / quantity choice</option></select></label>' +
        '<label class="switchline"><input type="checkbox" id="wizardPromptRequired"> Answer required</label><label class="switchline"><input type="checkbox" id="wizardPromptNotes"> Allow item note</label><label class="switchline"><input type="checkbox" id="wizardPromptKds" checked> Show title on Kitchen Display</label></div>' +
        '<input type="hidden" id="wizardPromptItemId" value="'+attr(parentId||'')+'"><div class="wizard-validation" id="wizardValidation"></div><div class="row"><button class="secondary" data-modal-action="close">Cancel</button><button class="primary" data-modal-action="create-guided-prompt">Add prompt</button></div></div></div>';
    } else {
      html = '<div class="modal-backdrop"><div class="modal admin-wizard-modal" role="dialog" aria-modal="true"><h2>Add category</h2><p class="help">Categories control Till grouping and whether Kitchen lines appear under Food or Drinks.</p><div class="form-grid clean-form">' +
        '<label class="span2"><span>Category name *</span><input class="input" id="wizardCategoryName" placeholder="e.g. Hot Drinks"></label>' +
        '<label><span>Sort order</span><input class="input" id="wizardCategorySort" inputmode="numeric" value="999"></label>' +
        '<label class="switchline"><input type="checkbox" id="wizardCategoryDrink"> Drink category for Kitchen</label><label class="switchline"><input type="checkbox" id="wizardCategoryActive" checked> Show on Till</label></div>' +
        '<div class="wizard-validation" id="wizardValidation"></div><div class="row"><button class="secondary" data-modal-action="close">Cancel</button><button class="primary" data-modal-action="create-guided-category">Create category</button></div></div></div>';
    }
    $('modalRoot').innerHTML = html;
  }

  function wizardError(message) {
    var target = $('wizardValidation');
    if (target) target.textContent = message || '';
  }

  function createGuidedItem() {
    var name = String(($('wizardItemName')||{}).value||'').trim();
    var priceText = String(($('wizardItemPrice')||{}).value||'').trim();
    var categoryId = String(($('wizardItemCategory')||{}).value||'');
    if (!name) return wizardError('Enter an item name.');
    if (!categoryId) return wizardError('Select a category.');
    if (priceText === '' || !isFinite(Number(priceText)) || Number(priceText) < 0) return wizardError('Enter a valid selling price.');
    if ((state.data.menuItems||[]).some(function(i){return String(i.ItemName||'').trim().toLowerCase()===name.toLowerCase();})) return wizardError('An item with this name already exists.');
    var item = { ItemID: Core.uid('I'), CategoryID: categoryId, CategoryName: categoryName(categoryId), ItemName: name, Description: String(($('wizardItemDescription')||{}).value||'').trim(), Price: Core.roundMoney(Number(priceText)), Active: !!(($('wizardItemActive')||{}).checked), Sort: nextScopedSort(state.data.menuItems, function(i){return i.CategoryID===categoryId;}), LoyaltyEligible: !!(($('wizardItemLoyalty')||{}).checked) };
    upsertLocal('menuItems','ItemID',item); state.selectedItemId=item.ItemID; state.adminItemBaselineId=item.ItemID; state.adminItemBaseline=normaliseAdminConfiguration({item:null,prompts:[],options:[]}); state.adminEditMode='item'; state.adminEditEntityId=item.ItemID; closeModal(); render(); updateConfigurationSaveState(); toast('Item created locally. Add prompts if required, then Save Configuration.','success');
  }

  function createGuidedPrompt() {
    var title=String(($('wizardPromptTitle')||{}).value||'').trim(); var itemId=String(($('wizardPromptItemId')||{}).value||state.selectedItemId||'');
    if(!title) return wizardError('Enter the question shown at the Till.');
    if((state.data.prompts||[]).some(function(p){return p.TriggerItemID===itemId && String(p.PromptTitle||'').trim().toLowerCase()===title.toLowerCase();})) return wizardError('This item already has a prompt with that title.');
    var p={PromptID:Core.uid('P'),TriggerItemID:itemId,PromptTitle:title,PromptType:String(($('wizardPromptType')||{}).value||'single'),Required:!!(($('wizardPromptRequired')||{}).checked),Sort:nextScopedSort(state.data.prompts,function(e){return e.TriggerItemID===itemId;}),Active:true,AllowNotes:!!(($('wizardPromptNotes')||{}).checked),ShowTitleOnKDS:!!(($('wizardPromptKds')||{}).checked)};
    upsertLocal('prompts','PromptID',p); closeModal(); render(); updateConfigurationSaveState(); toast('Prompt added. Add at least one option before saving.','success');
  }

  function createGuidedCategory() {
    var name=String(($('wizardCategoryName')||{}).value||'').trim(); if(!name) return wizardError('Enter a category name.');
    if((state.data.categories||[]).some(function(c){return String(c.CategoryName||'').trim().toLowerCase()===name.toLowerCase();})) return wizardError('A category with this name already exists.');
    var c={CategoryID:Core.uid('C'),CategoryName:name,Sort:Core.toNumber(($('wizardCategorySort')||{}).value,999),Active:!!(($('wizardCategoryActive')||{}).checked),ButtonColour:'',IsDrinkCategory:!!(($('wizardCategoryDrink')||{}).checked)};
    upsertLocal('categories','CategoryID',c); state.selectedCategoryId=c.CategoryID; closeModal(); render(); setAdminDirty('category',c.CategoryID,true); toast('Category created locally. Review it and save the changes.','success');
  }
  function renderAdmin() {
    var totalItems = (state.data.menuItems || []).length;
    var activeItems = (state.data.menuItems || []).filter(function (i) { return Core.active(i.Active); }).length;
    var totalCats = (state.data.categories || []).length;
    var totalPrompts = (state.data.prompts || []).length;
    var editLabel = state.adminEditMode === 'item' ? 'Editing complete item' : state.adminEditMode === 'category' ? 'Editing category' : state.adminEditMode === 'saving' ? 'Saving changes' : state.adminEditMode === 'reloading' ? 'Reloading confirmed data' : 'View mode';
    $('main').innerHTML = '<section class="panel admin-page"><div class="admin-hero"><div><h2>Menu admin</h2><p class="help">View mode receives validated server updates. Edit mode protects the whole item, including prompts, options and arrangement, until Save or Cancel.</p></div><div class="admin-summary"><div><strong>' + activeItems + '</strong><span>active items</span></div><div><strong>' + totalItems + '</strong><span>total items</span></div><div><strong>' + totalCats + '</strong><span>categories</span></div><div><strong>' + totalPrompts + '</strong><span>prompts</span></div></div></div>' +
      '<div class="admin-edit-status ' + (state.adminEditMode === 'view' ? 'view' : 'protected') + '"><strong>' + editLabel + '</strong><span>' + (state.adminEditMode === 'view' ? 'Automatic Menu Admin refresh is available.' : 'Menu Admin refresh application is paused; live sales and Kitchen synchronisation continue.') + '</span></div>' +
      '<div class="admin-tabs"><button class="pill-btn' + (state.adminMode === 'items' ? ' active' : '') + '" data-action="admin-mode" data-mode="items">Menu items</button><button class="pill-btn' + (state.adminMode === 'categories' ? ' active' : '') + '" data-action="admin-mode" data-mode="categories">Categories</button><button class="pill-btn' + (state.adminMode === 'deleted' ? ' active' : '') + '" data-action="admin-mode" data-mode="deleted">Deleted items</button><button class="secondary" data-action="export-menu-items">Download item list</button><button class="secondary" data-action="refresh-admin"' + (state.adminEditMode === 'view' ? '' : ' disabled') + '>Reload from server</button></div>' +
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
    var editing = state.adminEditMode === 'item' && state.adminEditEntityId === item.ItemID;
    return '<div class="card admin-card' + (inactive ? ' inactive-admin-panel' : '') + '"><div class="not-active-sticker">NOT ACTIVE</div><div class="section-title"><div><span class="step-badge">1</span><h3>Item details</h3></div><div class="row"><span class="badge ' + (Core.active(item.Active) ? 'ok' : 'danger') + '">' + (Core.active(item.Active) ? 'Active' : 'Inactive') + '</span>' + (editing ? '<span class="badge warn">Protected edit</span>' : '<button class="primary compact" data-action="edit-item" data-id="' + attr(item.ItemID) + '">Edit complete item</button>') + '</div></div><fieldset class="admin-edit-fieldset"' + (editing ? '' : ' disabled') + '><div class="form-grid clean-form">' +
      '<input type="hidden" id="itemId" value="' + attr(item.ItemID) + '">' +
      '<label><span>Item name</span><input class="input" id="itemName" placeholder="e.g. Bacon cob" value="' + attr(item.ItemName) + '"></label>' +
      '<label><span>Category</span><select class="select" id="itemCategory">' + cats.map(function (c) { return '<option value="' + attr(c.CategoryID) + '"' + (item.CategoryID === c.CategoryID ? ' selected' : '') + '>' + escapeHtml(c.CategoryName) + '</option>'; }).join('') + '</select></label>' +
      '<label><span>Price</span><div class="money-input"><span>£</span><input class="input" id="itemPrice" inputmode="decimal" placeholder="0.00" value="' + attr(item.Price) + '"></div></label>' +
      '<label><span>Sort order</span><input class="input" id="itemSort" inputmode="numeric" placeholder="Sort" value="' + attr(item.Sort) + '"></label>' +
      '<label class="span2"><span>Description</span><textarea class="textarea" id="itemDescription" placeholder="Optional description shown on the till button">' + escapeHtml(item.Description) + '</textarea></label>' +
      '<label class="switchline"><input type="checkbox" id="itemActive"' + (Core.active(item.Active) ? ' checked' : '') + '> Show on till</label>' +
      '<label class="switchline"><input type="checkbox" id="itemLoyalty"' + (Core.truthy(item.LoyaltyEligible) ? ' checked' : '') + '> Loyalty eligible</label>' +
      '<div class="row span2 admin-save-row"><button class="danger" data-action="delete-item">Delete item</button></div>' +
    '</div></fieldset></div>';
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
    // Active is now explicitly editable. New options default to active when the field is absent.
    option.Active = Object.prototype.hasOwnProperty.call(option, 'Active') ? Core.truthy(option.Active) : true;
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
    if (state.adminEditMode !== 'item' || state.adminMode !== 'items' || !state.selectedItemId || !state.adminItemBaseline) return false;
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
    var editing = state.adminEditMode === 'item' && state.adminEditEntityId === state.selectedItemId;
    if (!editing) return '<div class="item-configuration-savebar"><div><strong>View mode</strong><div class="help">Press Edit complete item to change item details, prompts, selections, quantities or arrangement.</div></div></div>';
    return '<div class="item-configuration-savebar protected"><div><strong data-configuration-save-status>Configuration saved</strong><div class="help">One Save writes item details, prompts, options and their order together.</div></div><div class="row"><button class="secondary" data-action="cancel-item-edit">Cancel edit</button><button class="primary" data-action="save-item-configuration" disabled>Configuration saved</button></div></div>';
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

  function configurationComparable(config) {
    return normaliseAdminConfiguration(config || {});
  }

  function configurationMismatchMessage(expected, actual) {
    var left = configurationComparable(expected);
    var right = configurationComparable(actual);
    if (JSON.stringify(left.item) !== JSON.stringify(right.item)) return 'The item details returned by Google Sheets do not match the saved values.';
    if (JSON.stringify(left.prompts) !== JSON.stringify(right.prompts)) return 'One or more prompts, prompt settings or prompt positions were not confirmed by Google Sheets.';
    if (JSON.stringify(left.options) !== JSON.stringify(right.options)) return 'One or more prompt options, prices, behaviours, quantities, active states or positions were not confirmed by Google Sheets.';
    return '';
  }

  function replaceItemConfigurationInState(itemId, authoritative) {
    authoritative = configurationComparable(authoritative);
    state.data.menuItems = (state.data.menuItems || []).filter(function (entry) { return entry.ItemID !== itemId; });
    if (authoritative.item) state.data.menuItems.push(authoritative.item);
    var previousPromptIds = (state.data.prompts || []).filter(function (entry) { return entry.TriggerItemID === itemId; }).map(function (entry) { return entry.PromptID; });
    state.data.prompts = (state.data.prompts || []).filter(function (entry) { return entry.TriggerItemID !== itemId; }).concat(authoritative.prompts || []);
    state.data.promptOptions = (state.data.promptOptions || []).filter(function (entry) { return previousPromptIds.indexOf(entry.PromptID) < 0; }).concat(authoritative.options || []);
    return authoritative;
  }


  function adminValuesEqual(left, right) {
    return JSON.stringify(left == null ? '' : left) === JSON.stringify(right == null ? '' : right);
  }

  function adminObjectPatch(original, current, idField) {
    original = original || {}; current = current || {};
    var patch = {};
    if (current[idField]) patch[idField] = current[idField];
    Object.keys(current).forEach(function (key) {
      if (key === idField) return;
      if (!adminValuesEqual(original[key], current[key])) patch[key] = current[key];
    });
    return patch;
  }

  function buildItemConfigurationPatch(baseline, current) {
    baseline = configurationComparable(baseline || {});
    current = configurationComparable(current || {});
    var oldPrompts = {}; var oldOptions = {};
    (baseline.prompts || []).forEach(function (row) { oldPrompts[String(row.PromptID)] = row; });
    (baseline.options || []).forEach(function (row) { oldOptions[String(row.OptionID)] = row; });
    var currentPromptIds = {}; var currentOptionIds = {};
    var promptPatches = (current.prompts || []).map(function (row) {
      currentPromptIds[String(row.PromptID)] = true;
      return adminObjectPatch(oldPrompts[String(row.PromptID)], row, 'PromptID');
    }).filter(function (patch) { return Object.keys(patch).length > 1; });
    var optionPatches = (current.options || []).map(function (row) {
      currentOptionIds[String(row.OptionID)] = true;
      return adminObjectPatch(oldOptions[String(row.OptionID)], row, 'OptionID');
    }).filter(function (patch) { return Object.keys(patch).length > 1; });
    return {
      itemId: current.item && current.item.ItemID,
      itemPatch: adminObjectPatch(baseline.item || {}, current.item || {}, 'ItemID'),
      promptPatches: promptPatches,
      optionPatches: optionPatches,
      deletedPromptIds: Object.keys(oldPrompts).filter(function (id) { return !currentPromptIds[id]; }),
      deletedOptionIds: Object.keys(oldOptions).filter(function (id) { return !currentOptionIds[id]; })
    };
  }

  async function saveItemConfiguration() {
    var config = collectAdminItemConfiguration();
    if (!config.item || !config.item.ItemName) { toast('Item needs a name.', 'warning'); return false; }
    var id = config.item.ItemID;
    var patch = buildItemConfigurationPatch(state.adminItemBaseline || {}, config);
    var changedFieldCount = Math.max(0, Object.keys(patch.itemPatch || {}).length - 1) +
      (patch.promptPatches || []).reduce(function (total, row) { return total + Math.max(0, Object.keys(row).length - 1); }, 0) +
      (patch.optionPatches || []).reduce(function (total, row) { return total + Math.max(0, Object.keys(row).length - 1); }, 0) +
      (patch.deletedPromptIds || []).length + (patch.deletedOptionIds || []).length;
    if (!changedFieldCount) { toast('No item configuration changes to save.', 'info'); return true; }
    try {
      state.adminEditMode = 'saving';
      await AdminSaveService.save({
        key: 'item-configuration:' + id,
        action: 'saveItemConfigurationPatch',
        payload: { patch: patch },
        busyMessage: 'Saving only ' + changedFieldCount + ' changed menu field' + (changedFieldCount === 1 ? '' : 's') + ' to Google Sheets.',
        reload: async function (response) {
          var savedResponse = response && response.configuration ? response.configuration : config;
          var authoritative = replaceItemConfigurationInState(id, savedResponse);
          if (isConfiguredUrl()) {
            state.adminEditMode = 'reloading';
            var confirmation = await api('itemConfigurationSnapshot', { itemId: id });
            if (!confirmation || !confirmation.configuration) throw new Error('Google Sheets did not return a complete item confirmation. Your editing copy has been retained.');
            var confirmed = normaliseAdminConfiguration(confirmation.configuration);
            var mismatch = configurationMismatchMessage(config, confirmed);
            if (mismatch) throw new Error(mismatch);
            authoritative = replaceItemConfigurationInState(id, confirmed);
          }
          ensureActiveCategory();
          return authoritative;
        },
        afterReload: function () {
          state.selectedItemId = id;
          state.dirtyPromptOptions = {};
          state.promptOptionOriginals = {};
          state.adminDirty.item = {};
          state.adminDirty.prompt = {};
          captureAdminItemBaseline(id);
          state.adminEditMode = 'view';
          state.adminEditEntityId = '';
          pendingMenuData = null;
          lastMenuSignature = menuSignature(state.data);
          saveLocal(); saveServerCache(); render();
        },
        successMessage: isConfiguredUrl() ? 'Complete item configuration verified in Google Sheets and is available to the Till.' : 'Complete item configuration saved locally for testing only.',
        errorPrefix: 'Item configuration not saved'
      });
      return true;
    } catch (err) { state.adminEditMode = 'item'; state.adminEditEntityId = id; render(); return false; }
  }

  async function guardAdminNavigation() {
    var dirty = state.adminMode === 'items' ? adminItemConfigurationDirty() : Object.keys((state.adminDirty.category || {})).length > 0;
    if (state.adminEditMode === 'view') return true;
    if (!dirty) {
      if (state.adminMode === 'items') discardItemConfigurationChanges();
      state.adminEditMode = 'view'; state.adminEditEntityId = '';
      return true;
    }
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
    var editing = state.adminEditMode === 'item' && state.adminEditEntityId === item.ItemID;
    return '<fieldset class="admin-edit-fieldset"' + (editing ? '' : ' disabled') + '><div class="card admin-card"><div class="section-title"><div><span class="step-badge">2</span><h3>Item configuration</h3></div><button class="secondary" data-action="add-prompt" data-id="' + attr(item.ItemID) + '">+ Add prompt</button></div>' +
      '<div class="help">Use prompts for add-ons, choices and upsells. Tick Qty on an option when staff should enter a quantity, such as 3 x sausage.</div><div class="unsaved-option-warning" data-unsaved-option-warning' + (hasDirtyPromptOptions() ? '' : ' hidden') + '>' + (hasDirtyPromptOptions() ? (dirtyPromptOptionCount('') + ' unsaved prompt option change' + (dirtyPromptOptionCount('') === 1 ? '' : 's') + '. Use Save Configuration before leaving this item.') : '') + '</div>' +
      '<div class="prompt-copy-panel"><div><strong>Duplicate prompts from another menu item</strong><div class="help">The latest prompt configuration is retrieved from the server before anything is copied. Existing prompts on this item are kept.</div></div><div class="prompt-copy-controls"><select class="select" id="copyPromptsSource"><option value="">Select an item…</option>' + copyOptions + '</select><button class="secondary" data-action="copy-prompts" data-id="' + attr(item.ItemID) + '"' + (copyOptions ? '' : ' disabled') + '>Duplicate prompts</button></div></div>' +
      (prompts.length ? prompts.map(function (prompt, index) { return renderPromptAdminCard(prompt, index, prompts.length); }).join('') : '<div class="empty-admin"><h3>No prompts yet</h3><p class="help">Add a prompt or copy prompts from another menu item.</p></div>') + '</div></fieldset>';
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
      '<div class="money-input option-money-input"><span>£</span><input class="input" data-option-field="Price" inputmode="decimal" value="' + attr(option.Price) + '" placeholder="0.00"></div>' +
      '<input type="hidden" data-option-field="Sort" value="' + attr(option.Sort) + '">' +
      '<select class="select" data-option-field="Action" aria-label="Option behaviour"><option value="Modifier"' + (option.Action === 'Modifier' ? ' selected' : '') + '>Modifier / add-on</option><option value="none"' + (String(option.Action || '').toLowerCase() === 'none' ? ' selected' : '') + '>Selection only</option></select>' +
      '<label class="switchline"><input type="checkbox" data-option-field="AllowValue"' + (Core.truthy(option.AllowValue) ? ' checked' : '') + '> Qty</label>' +
      '<label class="switchline"><input type="checkbox" data-option-field="Active"' + (Core.active(option.Active) ? ' checked' : '') + '> Active</label>' +
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
    if (!item.CategoryID) { toast('Select a category.', 'warning'); return; }
    if (!isFinite(item.Price) || item.Price < 0) { toast('Enter a valid item price.', 'warning'); return; }
    if ((state.data.menuItems || []).some(function(existing){ return existing.ItemID !== id && String(existing.ItemName||'').trim().toLowerCase() === item.ItemName.toLowerCase(); })) { toast('An item with this name already exists.', 'warning'); return; }
    try {
      await AdminSaveService.save({
        key: 'item:' + id,
        action: 'saveItem',
        payload: { item: item, patch: adminObjectPatch((state.data.menuItems || []).find(function (row) { return row.ItemID === id; }) || {}, item, 'ItemID') },
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
    if ((state.data.categories || []).some(function(existing){ return existing.CategoryID !== id && String(existing.CategoryName||'').trim().toLowerCase() === category.CategoryName.toLowerCase(); })) { toast('A category with this name already exists.', 'warning'); return; }
    try {
      await AdminSaveService.save({
        key: 'category:' + id,
        action: 'saveCategory',
        payload: { category: category, patch: adminObjectPatch((state.data.categories || []).find(function (row) { return row.CategoryID === id; }) || {}, category, 'CategoryID') },
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
    if (!String(prompt.PromptTitle || '').trim()) { toast('Prompt needs a question title.', 'warning'); return; }
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
    try {
      showBusyMessage('Loading prompts — Please wait', 'Retrieving the latest prompt groups and options from the server.');
      state.status.read = 'fetching prompt source';
      state.status.message = 'Fetching the latest prompts from Google Sheets…';
      renderStatus();
      var sourceSnapshot = isConfiguredUrl() ? await api('itemConfigurationSnapshot', { itemId: sourceItemId }) : null;
      var sourceConfig = sourceSnapshot && sourceSnapshot.configuration ? sourceSnapshot.configuration : null;
      var sourcePrompts = sourceConfig ? (sourceConfig.prompts || []).slice().sort(bySort) : (state.data.prompts || []).filter(function (p) { return p.TriggerItemID === sourceItemId; }).sort(bySort);
      if (!sourcePrompts.length) { hideBusyMessage(); recoverStatusIfHealthy(); renderStatus(); toast('That item has no prompts to duplicate.'); return; }
      var label = sourceItem ? sourceItem.ItemName : 'selected item';
      hideBusyMessage();
      if (!(await themedConfirm({ title: 'Duplicate prompts?', message: 'Copy ' + sourcePrompts.length + ' prompt' + (sourcePrompts.length === 1 ? '' : 's') + ' from ' + label + ' to ' + (targetItem ? targetItem.ItemName : 'this item') + '. Existing prompts will be kept.', confirmLabel: 'Duplicate prompts', cancelLabel: 'Cancel', tone: 'info' }))) { recoverStatusIfHealthy(); renderStatus(); return; }
      showBusyMessage('Duplicating prompts — Please wait', 'Creating independent copies and confirming them with the server.');
      state.status.write = 'saving';
      state.status.message = 'Duplicating prompts in Google Sheets…';
      renderStatus();
      var res = await saveServerEntity('copyItemPrompts', { sourceItemId: sourceItemId, targetItemId: targetItemId });
      if (isConfiguredUrl()) {
        var targetSnapshot = await api('itemConfigurationSnapshot', { itemId: targetItemId });
        var confirmed = targetSnapshot && targetSnapshot.configuration ? targetSnapshot.configuration : null;
        if (!confirmed) throw new Error('The copied prompts could not be confirmed from Google Sheets.');
        state.data.prompts = (state.data.prompts || []).filter(function (p) { return p.TriggerItemID !== targetItemId; }).concat(confirmed.prompts || []);
        var confirmedPromptIds = {};
        (confirmed.prompts || []).forEach(function (p) { confirmedPromptIds[p.PromptID] = true; });
        state.data.promptOptions = (state.data.promptOptions || []).filter(function (o) { return !confirmedPromptIds[o.PromptID]; }).concat(confirmed.options || []);
      } else {
        if (res && res.prompts) res.prompts.forEach(function (p) { upsertLocal('prompts', 'PromptID', p); });
        if (res && res.options) res.options.forEach(function (o) { upsertLocal('promptOptions', 'OptionID', o); });
      }
      saveLocal();
      saveServerCache();
      hideBusyMessage();
      recoverStatusIfHealthy();
      render();
      toast((res && res.promptCount ? res.promptCount : sourcePrompts.length) + ' prompt' + ((res && res.promptCount ? res.promptCount : sourcePrompts.length) === 1 ? '' : 's') + ' copied from ' + label + ' and confirmed from Google Sheets.');
    } catch (err) {
      hideBusyMessage();
      persistFailed('Prompts not duplicated', err);
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

  async function beginSyncMaintenance(reason) {
    maintenanceActionActive = true;
    syncPauseReason = String(reason || 'Maintenance');
    stopSyncCoordinator();
    ServerCoordinator.beginMaintenance();
    var writesFinished = await ServerCoordinator.waitForWritesIdle(15000);
    if (!writesFinished) throw new Error('An essential server write is still finishing. Please try again in a few seconds.');
  }

  function endSyncMaintenance(options) {
    options = options || {};
    maintenanceActionActive = false;
    syncPauseReason = manualSyncPaused ? 'Paused manually' : '';
    ServerCoordinator.endMaintenance();
    if (!manualSyncPaused && options.resume !== false) startSyncCoordinator();
  }

  async function setManualSyncPaused(paused) {
    paused = !!paused;
    if (paused === manualSyncPaused) return;
    if (paused) {
      if (state.paymentInProgress) { toast('Finish the current payment before pausing synchronisation.', 'warning'); return; }
      manualSyncPaused = true;
      syncPauseReason = 'Paused manually';
      stopSyncCoordinator();
      ServerCoordinator.beginMaintenance();
      if (syncPauseAutoResumeTimer) window.clearTimeout(syncPauseAutoResumeTimer);
      syncPauseAutoResumeTimer = window.setTimeout(function () { setManualSyncPaused(false); }, MANUAL_SYNC_AUTO_RESUME_MS);
      state.status.mode = 'warn';
      state.status.read = 'paused';
      state.status.write = 'local queue';
      state.status.message = 'Sync paused manually — transactions are being stored locally. Automatic resume in 30 minutes.';
      render();
      return;
    }
    manualSyncPaused = false;
    syncPauseReason = '';
    if (syncPauseAutoResumeTimer) window.clearTimeout(syncPauseAutoResumeTimer);
    syncPauseAutoResumeTimer = null;
    ServerCoordinator.endMaintenance();
    state.status.mode = 'syncing';
    state.status.read = 'resuming';
    state.status.write = 'checking queue';
    state.status.message = 'Resuming synchronisation…';
    renderStatus();
    startSyncCoordinator();
    window.setTimeout(function () { syncLocalTickets(); processDurableOutbox(); syncKitchenQueue({ silent: true }); syncTillLiveData(); }, 0);
    toast('Synchronisation resumed. Queued transactions are being sent first.', 'success');
  }

  async function saveScriptUrlSetting() {
    var input = $('scriptUrl');
    var url = String(input ? input.value : '').trim();
    var previousUrl = getScriptUrl();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:[?#].*)?$/.test(url)) {
      toast('Enter the deployed Google Apps Script /exec URL.', 'error');
      return;
    }
    showBusyMessage('Checking connection…', 'Confirming the deployed script and version before loading the database.');
    try {
      await beginSyncMaintenance('Testing Script URL');
      setScriptUrl(url);
      var info = await api('connectionCheck');
      var versions = info.versions || {};
      var mode = versionMode(versions);
      if (mode === 'error') {
        var compatibility = releaseCompatibility(versions);
        throw new Error('Version mismatch: this POS accepts backend ' + compatibility.acceptedBackends.join(', ') + ' and database ' + compatibility.acceptedDatabases.join(', ') + ', but the script reports backend ' + (versions.BackendVersion || 'unknown') + ' and database ' + (versions.DatabaseVersion || 'unknown') + '.');
      }
      state.status = {
        mode: 'syncing', read: 'connection confirmed', write: 'checking database',
        backendVersion: versions.BackendVersion || '', databaseVersion: versions.DatabaseVersion || '',
        spreadsheetName: versions.SpreadsheetName || '', spreadsheetId: versions.SpreadsheetID || '',
        message: 'Script confirmed. Loading the full database…'
      };
      renderStatus();
      showBusyMessage('Connection confirmed', 'Loading menu and operational data. A Google Apps Script cold start may take up to 45 seconds.');
      var loaded = await bootstrap({ preserveData: true });
      hideBusyMessage();
      if (loaded && state.serverReady) {
        endSyncMaintenance();
        window.setTimeout(function () { syncLocalTickets(); processDurableOutbox(); syncKitchenQueue({ silent: true }); syncTillLiveData(); }, 0);
        toast('Script URL saved, database confirmed and synchronisation resumed.', 'success');
      } else {
        endSyncMaintenance();
        toast('The script URL is valid, but the full database load did not complete. The Till remains on its last confirmed data and will retry in the background.', 'warning');
      }
    } catch (err) {
      setScriptUrl(previousUrl);
      endSyncMaintenance();
      hideBusyMessage();
      // Rejecting a proposed URL is not itself a live-system outage. If the
      // previous server was healthy, restore its healthy status and report the
      // rejected URL as a toast instead of leaving staff with a persistent alarm.
      if (previousUrl && state.serverReady) {
        clearSyncFault('connection');
        recoverStatusIfHealthy();
        renderStatus();
        toast('Script URL not saved: ' + friendlyServerError(err), 'error');
      } else {
        markSyncFault('connection', err);
        state.status.mode = 'error';
        state.status.read = 'connection test failed';
        state.status.write = 'local queue ready';
        state.status.message = 'Script URL rejected: ' + friendlyServerError(err);
        renderStatus();
        toast('Script URL not saved.', 'error');
      }
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
      try {
        var res = await api(action, payload);
        clearSyncFault('write');
        state.status.write = 'OK';
        state.status.read = 'OK';
        recoverStatusIfHealthy();
        renderStatus();
        return res;
      } catch (err) {
        markSyncFault('write', err);
        throw err;
      }
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
    markSyncFault('write', err);
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
      '<button class="primary" data-action="save-settings">Save &amp; Test Script URL</button><button class="secondary" data-action="refresh">Test / reload from server</button>' +
      '</div><h3>Secondary Service URL</h3><div class="card confirmed-url-card"><div class="url-version-label">Prepared for future expansion</div><label><span>Secondary Kitchen or local service URL</span><input class="input" id="secondaryServiceUrl" readonly placeholder="Disabled — single protected server currently active"></label><div class="help">Reserved for a future dedicated Kitchen service, local mini-PC service or failover endpoint. It remains disabled while the primary Apps Script owns all spreadsheet writes, preventing two scripts from editing the same data without a shared lock.</div><div class="row"><button class="secondary" disabled>Secondary service disabled</button></div><details><summary>Current confirmed primary URL</summary><div class="url-version-label">' + escapeHtml(savedVersionText) + '</div><label><span>Last confirmed good URL saved in database</span><input class="input" id="confirmedScriptUrl" readonly value="' + attr(savedUrlText) + '"></label><div class="row"><button class="secondary" data-action="copy-confirmed-url">Copy primary URL</button><button class="primary" data-action="save-confirmed-url">Save current confirmed URL</button></div><div class="help">Last saved: ' + escapeHtml(formatDate(savedUrl.savedAt) || 'Not saved yet') + '</div></details></div>' +
      '<h3>Device Local Mode</h3><div class="card"><p class="help">Continue taking payments when the internet or server is unavailable. This device can hold a maximum of ' + LOCAL_TICKET_LIMIT + ' unsynchronised paid tickets.</p><div class="row"><strong>' + (localModeEnabled() ? 'ACTIVE' : 'OFF') + '</strong><button class="' + (localModeEnabled() ? 'danger' : 'secondary') + '" data-action="' + (localModeEnabled() ? 'disable-local-mode' : 'enable-local-mode') + '">' + (localModeEnabled() ? 'Exit Local Mode' : 'Enable Local Mode') + '</button><button class="secondary" data-tab="Local Tickets">Open Device Local Tickets</button></div><div class="help">Waiting to sync: ' + localTickets().filter(function (x) { return x.syncStatus !== 'SYNCED'; }).length + ' / ' + LOCAL_TICKET_LIMIT + '</div></div>' +
      '<h3>Connection</h3><div class="cards"><div class="card"><h3>Server ready</h3><div class="item-price">' + (state.serverReady ? 'YES' : 'NO') + '</div></div><div class="card"><h3>Spreadsheet</h3><div>' + escapeHtml(state.status.spreadsheetName || 'Not confirmed') + '</div></div><div class="card"><h3>Strict persistence</h3><div class="item-price">' + (strictPersistence() ? 'ON' : 'OFF') + '</div></div></div>' +
      '<h3>Database maintenance</h3><div class="cards"><div class="card"><h3>Schema status</h3><div class="item-price">' + (schemaOk ? 'OK' : 'Check') + '</div><p class="help">Startup is read-only. Repairs run only after you preview and explicitly approve them.</p></div><div class="card span2"><h3>Repair preview / last result</h3>' + repairHtml + '</div></div>' +
      '<div class="row"><button class="secondary" data-action="preview-database-repair">Preview required changes</button><button class="primary" data-action="repair-database">Apply additive repair</button><button class="secondary" data-action="refresh">Reload status</button></div><p class="help"><strong>Safety:</strong> the repair may create missing sheets, append missing columns, create missing settings and update version metadata. It will not delete or overwrite existing sales, items, prompts, options, staff or settings values.</p>' +
      '<h3>Kitchen display</h3><div class="card"><label class="switchline"><input type="checkbox" id="kitchenDisplayEnabled"' + (kitchenDisplayEnabled() ? ' checked' : '') + '> Enable Kitchen Ticket Display</label><div class="help">When switched off, kitchen polling stops and newly paid tickets are not added to the kitchen queue. Sales, receipts and reports continue normally.</div><div class="kitchen-settings-grid"><label class="switchline"><input type="checkbox" id="kitchenAgeEnabled"' + (kitchenAgeEnabled() ? ' checked' : '') + '> Show ticket age timer</label><label class="switchline"><input type="checkbox" id="kitchenPromptTitlesEnabled"' + (kitchenPromptTitlesEnabled() ? ' checked' : '') + '> Show prompt titles</label><label><span>Warning after (minutes)</span><input class="input" id="kitchenAgeWarning" inputmode="numeric" min="1" value="' + attr(kitchenAgeWarningMinutes()) + '"></label><label><span>Overdue after (minutes)</span><input class="input" id="kitchenAgeOverdue" inputmode="numeric" min="2" value="' + attr(kitchenAgeOverdueMinutes()) + '"></label><label><span>Timer style</span><select class="input" id="kitchenAgeFormat"><option value="seconds"' + (kitchenAgeFormat() === 'seconds' ? ' selected' : '') + '>Minutes and seconds</option><option value="minutes"' + (kitchenAgeFormat() === 'minutes' ? ' selected' : '') + '>Minutes only</option></select></label></div><div class="help">New kitchen tickets briefly fade green. Warning and overdue borders are calculated locally, so the timer does not create extra Google Sheets requests.</div><div class="row"><button class="primary" data-action="save-kitchen-setting">Save kitchen settings</button></div></div>' +
      '<h3>Receipts</h3><div class="card"><label class="switchline"><input type="checkbox" id="printReceiptsEnabled"' + (printReceiptsEnabled() ? ' checked' : '') + '> Show Print Receipt after payment</label><label class="switchline"><input type="checkbox" id="emailReceiptsEnabled"' + (emailReceiptsEnabled() ? ' checked' : '') + '> Show Email Receipt after payment</label><div class="help">Print Receipt is hidden completely unless enabled. Email requests are stored in the durable outbox and retried automatically.</div><div class="row"><button class="primary" data-action="save-receipt-settings">Save receipt settings</button></div></div>' +
      '<h3>Staff discount</h3><div class="form-grid"><label><span>Staff discount percentage</span><input class="input" id="staffDiscountPercent" inputmode="decimal" value="' + attr(staffDiscountPercent()) + '" placeholder="e.g. 10"></label><button class="primary" data-action="save-staff-discount">Save staff discount</button><div class="help span2">This percentage is used by the Staff Discount button on the till. The discount is taken off before cash/change is calculated and is reported under Discount given.</div></div>' +
      diagnosticsHtml() +
      '<h3>Version diagnostics</h3>' + versionDiagnosticsHtml() + '<p class="help">The browser and Apps Script must report the same application version. The database schema has its own independently managed version.</p>' +
      '<h3>Safety</h3><p class="help">Payments are secured locally before the basket clears. Essential server writes use controlled priority lanes and durable queues where loss would be unacceptable. Reads are deduplicated and retried without storing stale requests.</p>' +
      '<h3>Device maintenance</h3><div class="card"><h3>Synchronisation control</h3><p class="help">Use only for diagnostics. Pausing stops new background reads and queued uploads; payments remain available and are stored locally. Sync resumes automatically after 30 minutes.</p><div class="row"><strong>' + (manualSyncPaused ? 'PAUSED' : 'RUNNING') + '</strong><button class="' + (manualSyncPaused ? 'primary' : 'secondary') + '" data-action="toggle-sync-pause">' + (manualSyncPaused ? 'Resume Sync' : 'Pause Background Sync') + '</button></div></div><div class="maintenance-actions-grid">' +
      '<div class="card maintenance-action-card"><h3>Refresh Local Data</h3><p class="help">Clears the cached menu, Reports, Ticket History and Kitchen display data, then reloads the latest confirmed information. Keeps the server URL, daily local tickets, pending transactions, receipt outbox and device identity.</p><button class="secondary" data-action="refresh-local-data">Refresh Local Data</button></div>' +
      '<div class="card maintenance-action-card"><h3>Repair Connection</h3><p class="help">Stops polling, clears the cached server reference on this device, restores the last confirmed URL where available, validates backend and database versions, reloads operational data and resumes synchronisation. No tickets or queued writes are deleted.</p><button class="primary" data-action="repair-connection">Repair Connection</button></div>' +
      '<div class="card maintenance-action-card danger-panel"><h3>Factory Reset Device</h3><p class="help">Removes the local menu on this device, drafts, daily tickets, pending transactions, queued emails, device registration and Kitchen cache. This cannot be undone.</p><button class="danger" data-action="factory-reset-device">Factory Reset Device</button></div>' +
      '</div><div class="row"><button class="secondary" data-action="download-backup">Download local backup JSON</button></div></section>';
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
      hasConfirmedServerData = state.serverReady;
      hasUsableCachedData = state.serverReady;
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

  document.addEventListener('dragstart', function (event) {
    if (!state.tillLayoutEditMode) return;
    var row = event.target.closest('[data-layout-type][data-layout-id]');
    if (!row) return;
    state.tillLayoutDrag = { type: row.getAttribute('data-layout-type'), id: row.getAttribute('data-layout-id') };
    row.classList.add('layout-dragging');
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', state.tillLayoutDrag.id); }
  });

  document.addEventListener('dragover', function (event) {
    if (!state.tillLayoutEditMode || !state.tillLayoutDrag) return;
    var row = event.target.closest('[data-layout-type][data-layout-id]');
    if (!row || row.getAttribute('data-layout-type') !== state.tillLayoutDrag.type) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });

  document.addEventListener('drop', function (event) {
    if (!state.tillLayoutEditMode || !state.tillLayoutDrag) return;
    var row = event.target.closest('[data-layout-type][data-layout-id]');
    if (!row || row.getAttribute('data-layout-type') !== state.tillLayoutDrag.type) return;
    event.preventDefault();
    reorderTillLayoutByDrop(state.tillLayoutDrag.type, state.tillLayoutDrag.id, row.getAttribute('data-layout-id'));
    state.tillLayoutDrag = null;
  });

  document.addEventListener('dragend', function () {
    state.tillLayoutDrag = null;
    document.querySelectorAll('.layout-dragging').forEach(function (el) { el.classList.remove('layout-dragging'); });
  });

  document.addEventListener('click', async function (event) {
    var tabBtn = event.target.closest('[data-tab]');
    if (tabBtn) {
      var requestedTab = tabBtn.getAttribute('data-tab');
      if (state.activeTab === 'Admin' && requestedTab !== 'Admin' && !(await guardAdminNavigation())) return;
      applyPendingMenuIfSafe(requestedTab);
      if (requestedTab !== state.activeTab) uiReadGeneration += 1;
      state.activeTab = requestedTab;
      setNavExpanded(false);
      await openFocusedTab(requestedTab);
      updateKitchenPolling();
      return;
    }
    var modalBtn = event.target.closest('[data-modal-action]');
    if (modalBtn) {
      var ma = modalBtn.getAttribute('data-modal-action');
      if (ma === 'close') closeModal();
      if (ma === 'create-guided-item') createGuidedItem();
      if (ma === 'create-guided-prompt') createGuidedPrompt();
      if (ma === 'create-guided-category') createGuidedCategory();
      if (ma === 'print-receipt') window.print();
      if (ma === 'open-order-review') togglePaymentOrderReview(true);
      if (ma === 'close-order-review') togglePaymentOrderReview(false);
      if (ma === 'back-to-till') closeModal();
      if (ma === 'enable-local-mode') { setLocalMode(true); closeModal(); render(); }
      if (ma === 'decline-local-mode') { localModeOfferShown = false; localModeOfferPending = false; closeModal(); }
      if (ma === 'select-order-type') selectOrderType(modalBtn.getAttribute('data-order-type'));
      if (ma === 'cancel-order-type') cancelOrderTypePrompt();
      if (ma === 'add-configured') addConfiguredItem(modalBtn.getAttribute('data-item-id'));
      if (ma === 'select-payment-method') { var selectedMethod = modalBtn.getAttribute('data-method'); if (selectedMethod === 'Cash') openCashKeypad(); else takePayment('Card'); }
      if (ma === 'confirm-payment') confirmPaymentFromPrompt(modalBtn.getAttribute('data-method'));
      if (ma === 'complete-cash-sale') completeCashSale();
      if (ma === 'report-code-digit') editReportClearPasscode('digit', modalBtn.getAttribute('data-digit'));
      if (ma === 'report-code-delete') editReportClearPasscode('delete');
      if (ma === 'report-code-clear') editReportClearPasscode('clear');
      if (ma === 'report-code-submit') submitClearReportsPasscode();
      if (ma === 'send-receipt-email') sendReceiptEmail(modalBtn.getAttribute('data-ticket-id'), modalBtn.getAttribute('data-client-request-id'), modalBtn);
      if (ma === 'email-saved-receipt') openEmailReceiptModal(modalBtn.getAttribute('data-ticket-id'), modalBtn.getAttribute('data-client-request-id'));
      if (ma === 'refund-minus') editRefundQuantity(modalBtn.getAttribute('data-ticket-item-id'), -1);
      if (ma === 'refund-plus') editRefundQuantity(modalBtn.getAttribute('data-ticket-item-id'), 1);
      if (ma === 'process-item-refund') processItemRefund(modalBtn.getAttribute('data-ticket-id'), modalBtn);
      if (ma === 'cash-digit') editCashKeypad('digit', modalBtn.getAttribute('data-digit'));
      if (ma === 'cash-delete') editCashKeypad('delete');
      if (ma === 'cash-clear') editCashKeypad('clear');
      if (ma === 'cash-exact') editCashKeypad('exact');
      if (ma === 'cash-quick') editCashKeypad('quick', modalBtn.getAttribute('data-amount'));
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
    if (action === 'toggle-main-menu') { setNavExpanded(!navExpanded); return; }
    var id = btn.getAttribute('data-id');
    if (action === 'set-category') { state.activeCategoryId = id; render(); }
    if (action === 'edit-till-layout') { enterTillLayoutEditMode(); return; }
    if (action === 'cancel-till-layout') { await cancelTillLayoutEditMode(); return; }
    if (action === 'save-till-layout') { await saveTillLayoutArrangement(); return; }
    if (action === 'move-layout-category') { moveTillLayoutEntry('category', id, Number(btn.getAttribute('data-direction'))); return; }
    if (action === 'move-layout-item') { moveTillLayoutEntry('item', id, Number(btn.getAttribute('data-direction'))); return; }
    if (action === 'select-layout-item') { return; }
    if (action === 'add-item') requestAddItem(id);
    if (action === 'line-minus') { var i = +btn.getAttribute('data-index'); Core.setLineQuantity(state.cart[i], Core.toNumber(state.cart[i].Quantity, 1) - 1); state.pendingPaymentRequestId = ''; saveLocal(); render(); }
    if (action === 'line-plus') { var ip = +btn.getAttribute('data-index'); Core.setLineQuantity(state.cart[ip], Core.toNumber(state.cart[ip].Quantity, 1) + 1); state.pendingPaymentRequestId = ''; saveLocal(); render(); }
    if (action === 'remove-line') { state.cart.splice(+btn.getAttribute('data-index'), 1); state.pendingPaymentRequestId = ''; if (!state.cart.length) resetCurrentOrderState({ keepServerName: true }); saveLocal(); render(); }
    if (action === 'clear-cart') { resetCurrentOrderState({ keepServerName: true }); saveLocal(); render(); }
    if (action === 'toggle-staff-discount') { state.ticketMeta.StaffDiscountApplied = !(staffDiscountApplied() && staffDiscountPercent() > 0); state.pendingPaymentRequestId = ''; saveLocal(); render(); }
    if (action === 'toggle-loyalty') { var loyaltyResult = applyLoyaltyToBestEligibleLine(); state.pendingPaymentRequestId = ''; saveLocal(); render(); toast(loyaltyResult.message); }
    if (action === 'open-payment-method') openPaymentMethodModal();
    if (action === 'hold-current') holdCurrent();
    if (action === 'recall-held') recallHeld(id);
    if (action === 'delete-held') deleteHeld(id);
    if (action === 'refresh') refresh();
    if (action === 'refresh-kitchen') refreshKitchenOnly();
    if (action === 'refresh-admin') { if (state.adminEditMode !== 'view') return; showBusyMessage('Reloading — Please wait', 'Loading the latest confirmed Menu Admin data from Google Sheets.'); try { await reloadAdminAuthority(); pendingMenuData = null; lastMenuSignature = menuSignature(state.data); hideBusyMessage(); render(); } catch (err) { hideBusyMessage(); persistFailed('Menu Admin reload failed', err); } }
    if (action === 'refresh-reports') refreshReportsData({ showOverlay: true });
    if (action === 'refresh-ticket-history') refreshTicketHistoryData({ showOverlay: true });
    if (action === 'history-today') { state.historyDate = todayDateString(new Date()); renderLiveTickets(); refreshTicketHistoryData(); }
    if (action === 'report-today') { state.reportFrom = todayDateString(new Date()); state.reportTo = state.reportFrom; state.reportComparisonAvailability = { previous: false, lastWeek: false }; renderReports(); refreshReportsData(); }
    if (action === 'export-reports') exportReports();
    if (action === 'export-menu-items') exportMenuItemsByCategory();
    if (action === 'clear-reports') openClearReportsKeypad();
    if (action === 'view-ticket') viewTicket(id);
    if (action === 'export-daily-ticket-backup') exportDailyTicketBackup();
    if (action === 'email-ticket') openEmailReceiptModal(id, btn.getAttribute('data-client-request-id') || '');
    if (action === 'refund-ticket') openRefundModal(id);
    if (action === 'complete-kitchen') completeKitchen(id);
    if (action === 'reopen-kitchen') reopenKitchen(id);
    if (action === 'force-till-update') forceTillUpdate();
    if (action === 'complete-kitchen-section') updateKitchenSection(id, btn.getAttribute('data-section'), 'COMPLETE');
    if (action === 'reopen-kitchen-section') updateKitchenSection(id, btn.getAttribute('data-section'), 'OPEN');
    if (action === 'admin-mode') { if (btn.getAttribute('data-mode') !== state.adminMode && !(await guardAdminNavigation())) return; state.adminMode = btn.getAttribute('data-mode'); state.adminEditMode = 'view'; state.adminEditEntityId = ''; state.adminItemBaseline = null; state.adminItemBaselineId = ''; render(); }
    if (action === 'select-admin-item') { if (id !== state.selectedItemId && !(await guardAdminNavigation())) return; state.selectedItemId = id; state.adminEditMode = 'view'; state.adminEditEntityId = ''; state.adminItemBaseline = null; state.adminItemBaselineId = ''; render(); }
    if (action === 'select-admin-category') { if (id !== state.selectedCategoryId && !(await guardAdminNavigation())) return; state.selectedCategoryId = id; render(); }
    if (action === 'edit-item') { if (!(await guardAdminNavigation())) return; state.adminEditMode = 'item'; state.adminEditEntityId = id; captureAdminItemBaseline(id); render(); }
    if (action === 'new-item') { if (!(await guardAdminNavigation())) return; openAdminWizard('item'); }
    if (action === 'new-category') { if (!(await guardAdminNavigation())) return; openAdminWizard('category'); }
    if (action === 'save-item') saveItem();
    if (action === 'save-item-configuration') saveItemConfiguration();
    if (action === 'discard-item-configuration' || action === 'cancel-item-edit') { discardItemConfigurationChanges(); state.adminEditMode = 'reloading'; showBusyMessage('Reloading — Please wait', 'Discarding local edits and loading the latest confirmed menu from Google Sheets.'); try { await reloadAdminAuthority(); state.adminEditMode = 'view'; state.adminEditEntityId = ''; pendingMenuData = null; lastMenuSignature = menuSignature(state.data); hideBusyMessage(); render(); } catch (err) { hideBusyMessage(); state.adminEditMode = 'item'; state.adminEditEntityId = state.selectedItemId; render(); persistFailed('Latest menu could not be reloaded', err); } }
    if (action === 'delete-item') archiveDeleteEntity('MenuItem', state.selectedItemId);
    if (action === 'save-category') saveCategory();
    if (action === 'delete-category') deactivateEntity('categories', 'CategoryID', state.selectedCategoryId, 'saveCategory', 'category');
    if (action === 'add-prompt') openAdminWizard('prompt', id);
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
    if (action === 'save-receipt-settings') {
      var printEnabled = !!($('printReceiptsEnabled') && $('printReceiptsEnabled').checked);
      var emailEnabled = !!($('emailReceiptsEnabled') && $('emailReceiptsEnabled').checked);
      await saveServerEntity('saveSetting', { key: 'PrintReceiptsEnabled', value: printEnabled ? 'TRUE' : 'FALSE' });
      await saveServerEntity('saveSetting', { key: 'EmailReceiptsEnabled', value: emailEnabled ? 'TRUE' : 'FALSE' });
      state.data.settings.PrintReceiptsEnabled = printEnabled ? 'TRUE' : 'FALSE';
      state.data.settings.EmailReceiptsEnabled = emailEnabled ? 'TRUE' : 'FALSE';
      saveServerCache(); renderSettings(); toast('Receipt settings saved.'); return;
    }
    if (action === 'save-kitchen-setting') saveKitchenDisplaySetting();
    if (action === 'copy-confirmed-url') copyTextToClipboard((confirmedUrlInfo().url || getScriptUrl()));
    if (action === 'save-confirmed-url') saveConfirmedUrlManually();
    if (action === 'preview-database-repair') previewDatabaseRepair();
    if (action === 'repair-database') runDatabaseRepair();
    if (action === 'run-diagnostics') runDiagnostics();
    if (action === 'test-email') testDiagnosticEmail(btn);
    if (action === 'test-print') openPrintDiagnostic();
    if (action === 'download-backup') downloadBackup();
    if (action === 'sync-local-tickets') { await syncLocalTickets(); return; }
    if (action === 'toggle-local-ticket-complete') { var localRows = localTickets(); var localRow = localRows.find(function (x) { return x.localId === id; }); if (localRow) { localRow.localStatus = localRow.localStatus === 'COMPLETE' ? 'OPEN' : 'COMPLETE'; saveLocalTickets(localRows); renderLocalTickets(); } return; }
    if (action === 'remove-synced-local-ticket') { await removeSyncedLocalTicketFromDevice(id); return; }
    if (action === 'clear-all-local-tickets') { await clearAllLocalTicketsFromDevice(); return; }
    if (action === 'enable-local-mode') { setLocalMode(true); render(); return; }
    if (action === 'disable-local-mode') { setLocalMode(false); render(); return; }
    if (action === 'retry-safe-render') { lastRenderError = null; if (state.serverReady) startSyncCoordinator(); render(); }
    if (action === 'refresh-local-data') { await refreshLocalDataWorkflow(); return; }
    if (action === 'repair-connection') { await repairConnectionWorkflow(); return; }
    if (action === 'toggle-sync-pause') { await setManualSyncPaused(!manualSyncPaused); return; }
    if (action === 'factory-reset-device') { await factoryResetDeviceWorkflow(); return; }
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
    if (event.target.id === 'reportDate') { state.reportFrom = event.target.value || todayDateString(new Date()); state.reportTo = state.reportFrom; state.reportComparisonAvailability = { previous: false, lastWeek: false }; renderReports(); refreshReportsData(); }
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
    if (!handle || state.adminEditMode !== 'item') return;
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

  function invalidateReadsForHiddenPage() {
    uiReadGeneration += 1;
    wakeRecoveryGeneration += 1;
    wakeSyncInProgress = false;
    kitchenPollEpoch += 1;
    kitchenPollInFlight = false;
    kitchenRefreshAgain = false;
    if (ServerCoordinator && typeof ServerCoordinator.invalidateReads === 'function') {
      ServerCoordinator.invalidateReads('Read cancelled because the browser moved to the background.');
    }
  }

  function wakeWatchdogPromise(generation) {
    return new Promise(function (_, reject) {
      window.setTimeout(function () {
        if (generation !== wakeRecoveryGeneration) return;
        var err = new Error('Browser resume recovery exceeded the 12 second safety limit.');
        err.code = 'WAKE_RECOVERY_TIMEOUT';
        reject(err);
      }, WAKE_RECOVERY_WATCHDOG_MS);
    });
  }

  async function runWakeConsistencyCheck(generation) {
    if (manualSyncPaused || maintenanceActionActive || document.visibilityState === 'hidden') return;
    if (!isConfiguredUrl()) return;

    if (!state.serverReady) {
      // Do not clear or rebuild the current Till. Trigger the normal reconnect path and
      // let its local-first safeguards decide when the server is usable again.
      reconnectServer();
      return { reconnectStarted: true, operationalFailed: false };
    }

    // Kitchen wake is time-critical: refresh its queue immediately rather than waiting
    // for a separate connection check or the next polling interval. Other screens retain
    // the explicit connection check before their normal focused refresh.
    if (state.activeTab === 'Kitchen') {
      await syncKitchenQueue({ silent: true, foregroundWake: true });
      if (generation !== wakeRecoveryGeneration || document.visibilityState === 'hidden') return;
    } else {
      await api('connectionCheck');
      if (generation !== wakeRecoveryGeneration || document.visibilityState === 'hidden') return;
      if (state.activeTab === 'Till' || state.activeTab === 'Held') {
        await syncTillLiveData();
      } else if (state.activeTab === 'Admin' || state.activeTab === 'Settings') {
        await syncMenuData();
      }
    }
    var operationalFailed = /retrying|failed|offline/i.test(String(state.status.read || '') + ' ' + String(state.status.message || ''));

    // Writes remain separate from the visual wake check. Kick durable queues without
    // waiting for them so a slow upload can never hold the browser-resume state open.
    window.setTimeout(function () {
      if (!manualSyncPaused && !maintenanceActionActive) {
        syncLocalTickets();
        processDurableOutbox();
      }
    }, 0);
    return { reconnectStarted: false, operationalFailed: operationalFailed };
  }

  async function resumeBackgroundSyncAfterWake() {
    if (wakeSyncInProgress || document.visibilityState === 'hidden') return;
    if (manualSyncPaused || maintenanceActionActive) {
      renderStatus();
      return;
    }

    wakeSyncInProgress = true;
    var generation = ++wakeRecoveryGeneration;
    if (state.serverReady) {
      state.status.read = 'checking';
      state.status.message = 'Browser resumed — checking connection and current screen';
      renderStatus();
    }

    try {
      var wakeResult = await Promise.race([runWakeConsistencyCheck(generation), wakeWatchdogPromise(generation)]);
      if (generation !== wakeRecoveryGeneration || document.visibilityState === 'hidden') return;
      if (state.serverReady && !(wakeResult && wakeResult.operationalFailed)) {
        state.status.read = 'OK';
        recoverStatusIfHealthy();
        if (state.status.message === 'Browser resumed — checking connection and current screen') state.status.message = 'System OK';
        renderStatus();
      }
    } catch (error) {
      if (generation !== wakeRecoveryGeneration) return;
      console.warn('Wake synchronisation check failed', error);
      state.status.mode = state.serverReady ? 'warn' : state.status.mode;
      state.status.read = state.serverReady ? 'retrying' : state.status.read;
      state.status.message = state.serverReady
        ? (error && error.code === 'WAKE_RECOVERY_TIMEOUT'
          ? 'Browser resume check timed out — Till remains available; normal sync will retry'
          : 'Browser resume check failed — Till remains available; normal sync will retry: ' + friendlyServerError(error))
        : state.status.message;
      renderStatus();
    } finally {
      if (generation === wakeRecoveryGeneration) wakeSyncInProgress = false;
    }
  }

  function scheduleWakeResume(delayMs) {
    if (visibilityResumeTimer) clearTimeout(visibilityResumeTimer);
    var delay = delayMs == null ? 750 : Math.max(0, Number(delayMs) || 0);
    visibilityResumeTimer = setTimeout(function () {
      visibilityResumeTimer = null;
      resumeBackgroundSyncAfterWake();
    }, delay);
  }

  window.addEventListener('offline', function () {
    state.serverReady = false;
    state.status.mode = 'warn';
    state.status.read = 'offline';
    state.status.message = 'Internet connection lost — current Till remains available';
    renderStatus();
    setLocalMode(true);
    runSyncCoordinator();
  });
  window.addEventListener('online', function () {
    kitchenLastActivityAt = Date.now();
    state.status.read = 'checking';
    state.status.message = 'Internet connection restored — checking server and local tickets';
    renderStatus();
    runSyncCoordinator();
    window.setTimeout(function () { reconnectServer(); syncLocalTickets(); }, 250);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      kitchenLastActivityAt = Date.now();
      scheduleWakeResume(state.activeTab === 'Kitchen' ? 0 : 750);
    } else {
      if (visibilityResumeTimer) { clearTimeout(visibilityResumeTimer); visibilityResumeTimer = null; }
      invalidateReadsForHiddenPage();
    }
  });
  window.addEventListener('pageshow', function () { if (document.visibilityState !== 'hidden') scheduleWakeResume(state.activeTab === 'Kitchen' ? 0 : 750); });
  window.addEventListener('focus', function () { if (document.visibilityState !== 'hidden') scheduleWakeResume(state.activeTab === 'Kitchen' ? 0 : 750); });
  window.addEventListener('beforeunload', function (event) {
    stopSyncCoordinator();
    clearMenuRetryTimer();
    if (state.adminEditMode !== 'view' || hasDirtyPromptOptions()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  window.setInterval(updateKitchenAgeIndicators, 1000);
  QueueManager.hydrateFallback().catch(function (err) { console.warn('Durable queue restore failed', err); }).then(function () { return refreshDailyLocalTickets(); }).catch(function (err) { console.warn('Daily local ticket restore failed', err); }).finally(function () { bootstrap(); startSyncCoordinator(); });
})();

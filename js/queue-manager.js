(function (root) {
  'use strict';
  var DB_NAME = 'nook_epos_durable_queue';
  var DB_VERSION = 3;
  var STORE = 'transactions';
  var OUTBOX_STORE = 'outbox';
  var DAILY_STORE = 'dailyTickets';
  var OUTBOX_FALLBACK_KEY = 'nook_epos_durable_outbox_v1';
  var FALLBACK_KEY = 'nook_epos_device_local_tickets_v1';
  var dbPromise = null;

  function fallbackRows() {
    try { var rows = JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]'); return Array.isArray(rows) ? rows : []; }
    catch (err) { return []; }
  }
  function saveFallback(rows) { try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(rows || [])); } catch (err) { console.warn('Queue mirror storage unavailable; IndexedDB remains authoritative', err); } }
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!root.indexedDB) { resolve(null); return; }
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: 'clientRequestId' });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          var outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
          outbox.createIndex('status', 'status', { unique: false });
          outbox.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(DAILY_STORE)) {
          var daily = db.createObjectStore(DAILY_STORE, { keyPath: 'clientRequestId' });
          daily.createIndex('syncStatus', 'syncStatus', { unique: false });
          daily.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('IndexedDB could not be opened.')); };
    });
    return dbPromise;
  }
  async function all() {
    var db = await openDb();
    if (!db) return fallbackRows();
    return new Promise(function (resolve, reject) {
      var req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = function () { resolve((req.result || []).sort(function(a,b){ return String(a.createdAt).localeCompare(String(b.createdAt)); })); };
      req.onerror = function () { reject(req.error); };
    });
  }
  async function put(record) {
    var db = await openDb();
    if (db) await new Promise(function (resolve, reject) {
      var req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(record);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
    var rows = fallbackRows();
    var i = rows.findIndex(function(x){ return x.clientRequestId === record.clientRequestId; });
    if (i >= 0) rows[i] = record; else rows.push(record);
    saveFallback(rows);
    return record;
  }

  async function remove(clientRequestId) {
    var db = await openDb();
    if (db) await new Promise(function (resolve, reject) {
      var req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(clientRequestId);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
    saveFallback(fallbackRows().filter(function(x){ return x.clientRequestId !== clientRequestId; }));
  }
  async function hydrateFallback() {
    var rows = await all();
    saveFallback(rows);
    return rows;
  }
  async function pendingCount() {
    var rows = await all();
    return rows.filter(function(x){ return x.syncStatus !== 'SYNCED'; }).length;
  }

  function outboxFallbackRows() { try { var rows=JSON.parse(localStorage.getItem(OUTBOX_FALLBACK_KEY)||'[]'); return Array.isArray(rows)?rows:[]; } catch(err){ return []; } }
  function saveOutboxFallback(rows) { try { localStorage.setItem(OUTBOX_FALLBACK_KEY, JSON.stringify(rows||[])); } catch(err){} }
  async function outboxAll() {
    var db=await openDb();
    if (!db) return outboxFallbackRows();
    return new Promise(function(resolve,reject){ var req=db.transaction(OUTBOX_STORE,'readonly').objectStore(OUTBOX_STORE).getAll(); req.onsuccess=function(){ resolve((req.result||[]).sort(function(a,b){return String(a.createdAt).localeCompare(String(b.createdAt));}));}; req.onerror=function(){reject(req.error);}; });
  }
  async function outboxPut(record) {
    var db=await openDb();
    if (db) await new Promise(function(resolve,reject){ var req=db.transaction(OUTBOX_STORE,'readwrite').objectStore(OUTBOX_STORE).put(record); req.onsuccess=function(){resolve();}; req.onerror=function(){reject(req.error);}; });
    var rows=outboxFallbackRows(), i=rows.findIndex(function(x){return x.id===record.id;}); if(i>=0) rows[i]=record; else rows.push(record); saveOutboxFallback(rows); return record;
  }
  async function outboxRemove(id) {
    var db=await openDb();
    if (db) await new Promise(function(resolve,reject){ var req=db.transaction(OUTBOX_STORE,'readwrite').objectStore(OUTBOX_STORE).delete(id); req.onsuccess=function(){resolve();}; req.onerror=function(){reject(req.error);}; });
    saveOutboxFallback(outboxFallbackRows().filter(function(x){return x.id!==id;}));
  }
  async function outboxPendingCount(){ var rows=await outboxAll(); return rows.filter(function(x){return x.status!=='SYNCED';}).length; }

  async function dailyAll() {
    var db = await openDb();
    if (!db) return fallbackRows();
    return new Promise(function (resolve, reject) {
      var req = db.transaction(DAILY_STORE, 'readonly').objectStore(DAILY_STORE).getAll();
      req.onsuccess = function () { resolve((req.result || []).sort(function(a,b){ return String(a.createdAt).localeCompare(String(b.createdAt)); })); };
      req.onerror = function () { reject(req.error); };
    });
  }
  async function dailyPut(record) {
    var db = await openDb();
    if (!db) return record;
    return new Promise(function (resolve, reject) {
      var req = db.transaction(DAILY_STORE, 'readwrite').objectStore(DAILY_STORE).put(record);
      req.onsuccess = function () { resolve(record); };
      req.onerror = function () { reject(req.error); };
    });
  }
  async function dailyRemove(clientRequestId) {
    var db = await openDb();
    if (!db) return;
    return new Promise(function (resolve, reject) {
      var req = db.transaction(DAILY_STORE, 'readwrite').objectStore(DAILY_STORE).delete(clientRequestId);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  }

  // Permanently removes one device-local ticket copy from both IndexedDB ticket stores.
  // This is deliberately local-only: it never contacts or mutates the server database.
  async function removeTicketCopies(clientRequestId) {
    var id = String(clientRequestId || '');
    if (!id) return;
    var db = await openDb();
    if (db) await new Promise(function (resolve, reject) {
      var tx = db.transaction([STORE, DAILY_STORE], 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.objectStore(DAILY_STORE).delete(id);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error('Local ticket removal failed.')); };
      tx.onabort = function () { reject(tx.error || new Error('Local ticket removal was aborted.')); };
    });
    saveFallback(fallbackRows().filter(function (x) { return x.clientRequestId !== id; }));
  }

  // Clears only device-local paid-ticket stores. Receipt outbox and every server-side
  // Tickets/TicketItems/TicketAddOns record remain untouched.
  async function clearTicketStores() {
    var db = await openDb();
    if (db) await new Promise(function (resolve, reject) {
      var tx = db.transaction([STORE, DAILY_STORE], 'readwrite');
      tx.objectStore(STORE).clear();
      tx.objectStore(DAILY_STORE).clear();
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error('Local ticket clear failed.')); };
      tx.onabort = function () { reject(tx.error || new Error('Local ticket clear was aborted.')); };
    });
    saveFallback([]);
  }


  async function healthCheck() {
    var probeId = '__nook_health_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    var db = await openDb();
    if (!db) {
      try {
        var key = '__nook_epos_storage_probe__';
        localStorage.setItem(key, probeId);
        if (localStorage.getItem(key) !== probeId) throw new Error('Local storage verification failed.');
        localStorage.removeItem(key);
        return { ok: true, storage: 'localStorage' };
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    }
    try {
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(OUTBOX_STORE, 'readwrite');
        var store = tx.objectStore(OUTBOX_STORE);
        store.put({ id: probeId, type: 'HEALTH_CHECK', status: 'PROBE', createdAt: new Date().toISOString() });
        store.delete(probeId);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB write verification failed.')); };
        tx.onabort = function () { reject(tx.error || new Error('IndexedDB write verification was aborted.')); };
      });
      return { ok: true, storage: 'IndexedDB' };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }


  async function clearStore(db, storeName) {
    if (!db || !db.objectStoreNames.contains(storeName)) return;
    await new Promise(function (resolve, reject) {
      var req = db.transaction(storeName, 'readwrite').objectStore(storeName).clear();
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  }
  async function clearAll() {
    var db = await openDb();
    if (db) {
      await clearStore(db, STORE);
      await clearStore(db, OUTBOX_STORE);
      await clearStore(db, DAILY_STORE);
    }
    saveFallback([]);
    saveOutboxFallback([]);
    try { localStorage.removeItem(FALLBACK_KEY); localStorage.removeItem(OUTBOX_FALLBACK_KEY); } catch (err) {}
  }

  root.NookQueueManager = Object.freeze({ open: openDb, all: all, put: put, remove: remove, hydrateFallback: hydrateFallback, pendingCount: pendingCount, outboxAll: outboxAll, outboxPut: outboxPut, outboxRemove: outboxRemove, outboxPendingCount: outboxPendingCount, dailyAll: dailyAll, dailyPut: dailyPut, dailyRemove: dailyRemove, removeTicketCopies: removeTicketCopies, clearTicketStores: clearTicketStores, healthCheck: healthCheck, clearAll: clearAll });
})(typeof window !== 'undefined' ? window : globalThis);

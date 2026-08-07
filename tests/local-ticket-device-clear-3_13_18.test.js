const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const queueSource = fs.readFileSync(path.join(root, 'js', 'queue-manager.js'), 'utf8');

function localStorageMock() {
  const rows = new Map();
  return {
    getItem: key => rows.has(key) ? rows.get(key) : null,
    setItem: (key, value) => rows.set(key, String(value)),
    removeItem: key => rows.delete(key),
    clear: () => rows.clear()
  };
}

test('individual local-ticket removal is persistent and local-only', () => {
  assert.match(queueSource, /async function removeTicketCopies\(clientRequestId\)/);
  assert.match(queueSource, /db\.transaction\(\[STORE, DAILY_STORE\], 'readwrite'\)/);
  assert.match(queueSource, /tx\.objectStore\(STORE\)\.delete\(id\)/);
  assert.match(queueSource, /tx\.objectStore\(DAILY_STORE\)\.delete\(id\)/);
  assert.match(app, /await QueueManager\.removeTicketCopies\(record\.clientRequestId\)/);
  assert.match(app, /if \(action === 'remove-synced-local-ticket'\) \{ await removeSyncedLocalTicketFromDevice\(id\); return; \}/);
  const fn = app.slice(app.indexOf('async function removeSyncedLocalTicketFromDevice'), app.indexOf('async function clearAllLocalTicketsFromDevice'));
  assert.doesNotMatch(fn, /api\(/);
  assert.doesNotMatch(fn, /commitTicket|deleteTicket|clearReports/);
});

test('clear all local tickets clears only local ticket stores with destructive protection', () => {
  assert.match(queueSource, /async function clearTicketStores\(\)/);
  assert.match(queueSource, /tx\.objectStore\(STORE\)\.clear\(\)/);
  assert.match(queueSource, /tx\.objectStore\(DAILY_STORE\)\.clear\(\)/);
  assert.match(app, /data-action="clear-all-local-tickets"/);
  assert.match(app, /localTicketStoreGeneration \+= 1/);
  assert.match(app, /await QueueManager\.clearTicketStores\(\)/);
  assert.match(app, /Unsynchronised tickets will be lost/);
  assert.match(app, /Delete unsynchronised tickets/);
  const fn = app.slice(app.indexOf('async function clearAllLocalTicketsFromDevice'), app.indexOf('function renderLocalTickets'));
  assert.doesNotMatch(fn, /api\(/);
  assert.doesNotMatch(fn, /commitTicket|deleteTicket|clearReports/);
});

test('local ticket sync is generation-protected against resurrection after a clear', () => {
  const start = app.indexOf('async function syncLocalTickets');
  const sync = app.slice(start, app.indexOf('function saveLocal()', start));
  assert.match(sync, /var storeGeneration = localTicketStoreGeneration/);
  assert.ok((sync.match(/storeGeneration !== localTicketStoreGeneration/g) || []).length >= 5);
});

test('queue manager fallback removes and clears device-local tickets permanently', async () => {
  const sandbox = {
    globalThis: {},
    localStorage: localStorageMock(),
    console,
    Promise,
    Date,
    Math,
    Error,
    Object,
    Array,
    Number,
    String,
    JSON,
    Map,
    Set
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(queueSource, sandbox);
  const q = sandbox.NookQueueManager;
  await q.put({ clientRequestId: 'A', localId: 'A', createdAt: '2026-08-07T10:00:00Z', syncStatus: 'SYNCED' });
  await q.put({ clientRequestId: 'B', localId: 'B', createdAt: '2026-08-07T11:00:00Z', syncStatus: 'PENDING_SYNC' });
  assert.equal((await q.all()).length, 2);
  await q.removeTicketCopies('A');
  assert.deepEqual((await q.all()).map(x => x.clientRequestId), ['B']);
  await q.clearTicketStores();
  assert.equal((await q.all()).length, 0);
});

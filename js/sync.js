import { backendRequest } from "./api.js";
import { saveState, todayISO, uid } from "./store.js";

export function addSyncLog(state, status, message, action = "", extra = {}) {
  state.syncLog.unshift({
    LogID: uid("LOG"),
    CreatedAt: todayISO(),
    DeviceID: state.deviceId,
    Action: action,
    Status: status,
    Message: message,
    QueueSize: state.syncQueue.length,
    Json: JSON.stringify(extra)
  });
  state.syncLog = state.syncLog.slice(0, 250);
}

export function enqueue(state, action, payload) {
  state.syncQueue.push({
    QueueID: uid("Q"),
    CreatedAt: todayISO(),
    Action: action,
    Payload: payload,
    Attempts: 0,
    LastError: ""
  });
  addSyncLog(state, "queued", action, action);
  saveState(state);
}

export async function processQueue(state) {
  if (state.settings.offlineMode) {
    addSyncLog(state, "paused", "Offline mode is switched on");
    saveState(state);
    return { ok: false, paused: true };
  }
  if (!state.settings.scriptUrl) {
    return { ok: false, local: true };
  }
  if (!state.syncQueue.length) {
    state.lastRead = "waiting";
    state.lastWrite = "waiting";
    saveState(state);
    return { ok: true, empty: true };
  }

  const item = state.syncQueue[0];
  item.Attempts += 1;
  try {
    state.lastWrite = "checking";
    const result = await backendRequest(state, item.Action, item.Payload);
    if (item.Action === "saveTicket") {
      state.lastRead = "checking";
      const verify = await backendRequest(state, "verifyTicket", { TicketID: item.Payload.ticket.TicketID });
      if (!verify.ok || !verify.ticket) {
        throw new Error("Written but read-back verification failed");
      }
    }

    state.syncQueue.shift();
    state.lastWrite = "OK";
    state.lastRead = "OK";
    state.lastSync = todayISO();
    addSyncLog(state, "ok", `${item.Action} synced`, item.Action, result);
    saveState(state);
    return { ok: true, result };
  } catch (err) {
    item.LastError = err.message;
    state.lastWrite = "failed";
    state.lastRead = "failed";
    addSyncLog(state, "error", err.message, item.Action);
    saveState(state);
    return { ok: false, error: err.message };
  }
}

export function syncStatusText(state) {
  const now = new Date().toLocaleTimeString("en-GB");
  if (state.settings.offlineMode) {
    return `${now} • Sync paused: Offline mode • Queue: ${state.syncQueue.length} • Write: waiting • Read: waiting`;
  }
  if (!state.settings.scriptUrl) {
    return `${now} • Local fallback • Queue: ${state.syncQueue.length} • Write: waiting • Read: waiting`;
  }
  return `${now} • Queue: ${state.syncQueue.length} • Write: ${state.lastWrite || "waiting"} • Read: ${state.lastRead || "waiting"}`;
}

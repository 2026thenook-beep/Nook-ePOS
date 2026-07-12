import { APP_VERSION, BACKEND_VERSION } from "./config.js";

function withTimeout(promise, ms = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    run: promise(controller.signal).finally(() => clearTimeout(timeout))
  };
}

export async function backendRequest(state, action, payload = {}, options = {}) {
  const url = String(state.settings.scriptUrl || "").trim();
  if (!url) {
    throw new Error("No Apps Script URL is saved. Running in local fallback mode.");
  }

  const body = {
    action,
    payload,
    meta: {
      frontendVersion: APP_VERSION,
      expectedBackendVersion: BACKEND_VERSION,
      deviceId: state.deviceId,
      sentAt: new Date().toISOString()
    }
  };

  const request = withTimeout((signal) => fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
    signal
  }), options.timeoutMs || 20000);

  const response = await request.run;
  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`Backend returned non-JSON response. Check the Apps Script deployment URL. Response started: ${text.slice(0, 120)}`);
  }

  if (!json.ok) {
    throw new Error(json.error || `Backend action failed: ${action}`);
  }
  return json;
}

export async function testBackend(state) {
  return backendRequest(state, "ping", {});
}

export async function getBootstrap(state) {
  return backendRequest(state, "getBootstrap", {});
}

export async function setupDatabase(state) {
  return backendRequest(state, "setupDatabase", {});
}

export async function getTicketHistory(state, payload) {
  return backendRequest(state, "getTicketHistory", payload);
}

export async function getKitchenQueue(state) {
  return backendRequest(state, "getKitchenQueue", {});
}

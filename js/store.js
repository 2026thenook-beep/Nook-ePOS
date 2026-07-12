import { APP_VERSION } from "./config.js";
import { LOCAL_SEED } from "./localSeed.js";

const KEY = "nook-pos-core-1-8-8-state";

export function uid(prefix = "ID") {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

export function todayISO() {
  return new Date().toISOString();
}

export function businessDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function ticketNoFor(state) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const todays = state.tickets.filter(t => t.BusinessDate === businessDate(d)).length;
  return `${dd}${mm}${yyyy}-${1001 + todays}`;
}

export function lineTotal(line) {
  const addons = (line.addOns || []).reduce((sum, a) => sum + (Number(a.PriceEach || a.price || 0) * Number(a.Qty || a.qty || 1)), 0);
  const base = Number(line.BasePrice ?? line.basePrice ?? 0);
  const qty = Number(line.Qty ?? line.qty ?? 1);
  return (base + addons) * qty;
}

export function ticketTotals(state) {
  const subtotal = state.currentTicket.lines.reduce((sum, line) => {
    if (line.LoyaltyRedeemed) return sum;
    return sum + lineTotal(line);
  }, 0);
  const discountPercent = state.currentTicket.staffDiscount ? Number(state.settings.StaffDiscountPercent || 0) : 0;
  const discountAmount = subtotal * (discountPercent / 100);
  const total = Math.max(0, subtotal - discountAmount);
  return {
    subtotal: round2(subtotal),
    discountPercent,
    discountAmount: round2(discountAmount),
    total: round2(total)
  };
}

export function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

export function money(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(n || 0));
}

export function routeFor(category) {
  const c = String(category || "").trim().toLowerCase();
  return ["hot drinks", "cold drinks", "drinks"].includes(c) ? "drink" : "food";
}

export function newBlankTicket() {
  return {
    orderType: "Takeaway",
    serverName: "",
    tableNumber: "",
    customerName: "",
    orderNote: "",
    loyaltyRedeemedQty: 0,
    staffDiscount: false,
    cashPaid: 0,
    lines: []
  };
}

function defaultState() {
  const deviceId = localStorage.getItem("nook-device-id") || uid("DEV");
  localStorage.setItem("nook-device-id", deviceId);

  return {
    version: APP_VERSION,
    activeTab: "till",
    activeCategory: "",
    db: {
      categories: LOCAL_SEED.categories,
      menu: LOCAL_SEED.menu,
      modifiers: LOCAL_SEED.modifiers,
      prompts: LOCAL_SEED.prompts,
      promptOptions: LOCAL_SEED.promptOptions,
      staff: LOCAL_SEED.staff
    },
    settings: {
      ...LOCAL_SEED.settings,
      scriptUrl: "",
      savedUrls: [],
      offlineMode: false,
      printerOpen: false,
      staffDiscountOpen: false
    },
    deviceId,
    currentTicket: newBlankTicket(),
    heldOrders: [],
    tickets: [],
    ticketItems: [],
    ticketAddOns: [],
    refunds: [],
    kitchenQueue: [],
    syncQueue: [],
    syncLog: [],
    lastSync: null,
    lastRead: null,
    lastWrite: null,
    ui: {
      filter: "",
      dateFrom: businessDate(),
      dateTo: businessDate(),
      historySearch: "",
      reportRows: []
    }
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const loaded = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...loaded,
      db: { ...base.db, ...(loaded.db || {}) },
      settings: { ...base.settings, ...(loaded.settings || {}) },
      currentTicket: loaded.currentTicket || base.currentTicket,
      ui: { ...base.ui, ...(loaded.ui || {}) }
    };
  } catch (err) {
    console.error("State load failed, using defaults", err);
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function hardResetLocalState() {
  localStorage.removeItem(KEY);
  return defaultState();
}

export function exportBackup(state) {
  return JSON.stringify({ exportedAt: todayISO(), appVersion: APP_VERSION, state }, null, 2);
}

export function importBackup(text) {
  const parsed = JSON.parse(text);
  return parsed.state ? parsed.state : parsed;
}

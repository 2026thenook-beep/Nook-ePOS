import { APP_VERSION, DB_VERSION, TABS, DRINK_CATEGORIES } from "./config.js";
import { getBootstrap, setupDatabase, testBackend, getKitchenQueue, getTicketHistory } from "./api.js";
import { enqueue, processQueue, syncStatusText, addSyncLog } from "./sync.js";
import {
  loadState, saveState, hardResetLocalState, uid, todayISO, businessDate, ticketNoFor,
  lineTotal, ticketTotals, money, routeFor, newBlankTicket, exportBackup, importBackup, round2
} from "./store.js";
import { $, $$, escapeHtml, field, selectField, toast, downloadText, openModal } from "./ui.js";

let state = loadState();
let syncTimer = null;

const root = $("#app");

function setState(mutator) {
  mutator(state);
  saveState(state);
  render();
}

function activeCategories() {
  return (state.db.categories || [])
    .filter(c => asBool(c.Active))
    .sort((a, b) => Number(a.Sort || 0) - Number(b.Sort || 0));
}

function visibleMenu() {
  return (state.db.menu || [])
    .filter(item => asBool(item.Active) && asBool(item.ShowOnTill))
    .sort((a, b) => Number(a.Sort || 0) - Number(b.Sort || 0));
}

function asBool(v) {
  return v === true || v === "TRUE" || v === "true" || v === 1 || v === "1";
}

function isDrink(category) {
  return DRINK_CATEGORIES.includes(String(category || "").toLowerCase());
}

function render() {
  if (!state.activeCategory) {
    const first = activeCategories()[0];
    if (first) state.activeCategory = first.CategoryName;
  }

  root.innerHTML = `
    <header class="top-card">
      <div class="brand">
        <div class="brand-small">THE NOOK</div>
        <div class="brand-title">POS Core</div>
        <div class="brand-version">${APP_VERSION}</div>
        <div class="brand-sub">CORE-${APP_VERSION.replaceAll(".", "-")}</div>
      </div>
      <nav class="tabs">
        ${TABS.map(tab => `<button class="pill ${state.activeTab === tab.id ? "active" : ""}" data-tab="${tab.id}">${escapeHtml(tab.label)}</button>`).join("")}
      </nav>
    </header>

    <div id="syncStatus" class="sync-bar ${state.syncQueue.length ? "warn" : "ok"}">${escapeHtml(syncStatusText(state))}</div>

    <main id="screen" class="screen">${renderActiveTab()}</main>
  `;

  bindScreenEvents();
}

function renderActiveTab() {
  switch (state.activeTab) {
    case "till": return renderTill();
    case "held": return renderHeld();
    case "reports": return renderReports();
    case "history": return renderHistory();
    case "refunds": return renderRefunds();
    case "menu-print": return renderMenuPrint();
    case "stock": return renderStock();
    case "kitchen": return renderKitchen();
    case "online": return renderOnline();
    case "staff": return renderStaff();
    case "admin": return renderAdmin();
    case "settings": return renderSettings();
    case "sync": return renderSync();
    default: return renderTill();
  }
}

function renderTill() {
  const categories = activeCategories();
  const items = visibleMenu().filter(i => i.CategoryName === state.activeCategory);
  const totals = ticketTotals(state);
  const cashPaid = Number(state.currentTicket.cashPaid || 0);
  const change = Math.max(0, cashPaid - totals.total);

  return `
    <section class="till-layout">
      <div class="menu-panel card">
        <div class="category-row">
          ${categories.map(cat => `<button class="category ${cat.CategoryName === state.activeCategory ? "active" : ""}" data-category="${escapeHtml(cat.CategoryName)}">${escapeHtml(cat.CategoryName)}</button>`).join("")}
        </div>
        <div class="item-grid">
          ${items.map(item => `
            <button class="item-card" data-item-id="${escapeHtml(item.ItemID)}">
              <b>${escapeHtml(item.ItemName)}</b>
              <span>${money(item.Price)}</span>
            </button>
          `).join("") || `<div class="empty">No active items in this category.</div>`}
        </div>
      </div>

      <aside class="ticket-panel card">
        <h2>Ticket next<br>from server</h2>
        <div class="ticket-fields">
          ${selectField("", "orderType", ["Takeaway", "Eat in"], state.currentTicket.orderType)}
          <input id="serverName" placeholder="Server name" value="${escapeHtml(state.currentTicket.serverName)}">
          <input id="tableNumber" placeholder="Table number" value="${escapeHtml(state.currentTicket.tableNumber)}">
          <input id="customerName" placeholder="Customer name for receipt" value="${escapeHtml(state.currentTicket.customerName)}">
        </div>

        <div class="ticket-lines ${state.currentTicket.lines.length ? "" : "empty-ticket"}">
          ${state.currentTicket.lines.length ? state.currentTicket.lines.map(renderTicketLine).join("") : `<span>Tap an item to start</span>`}
        </div>

        <label class="loyalty-box">
          <span><b>Customer redeemed a loyalty drink</b><small>This records free loyalty drinks in reports but does not add money to the ticket total.</small></span>
          <input id="loyaltyRedeemOn" type="checkbox" ${Number(state.currentTicket.loyaltyRedeemedQty || 0) > 0 ? "checked" : ""}>
        </label>
        <div class="qty-line">
          <button data-loyalty-dec>-</button>
          <input id="loyaltyQty" type="number" min="0" value="${escapeHtml(state.currentTicket.loyaltyRedeemedQty || 0)}">
          <button data-loyalty-inc>+</button>
        </div>

        <label class="field"><span>Full order note</span><textarea id="orderNote" placeholder="e.g. allergy, rush order, customer note">${escapeHtml(state.currentTicket.orderNote)}</textarea></label>

        <div class="totals">
          <div><span>Subtotal</span><b>${money(totals.subtotal)}</b></div>
          <label><span>Staff discount ${totals.discountPercent}%</span><input id="staffDiscount" type="checkbox" ${state.currentTicket.staffDiscount ? "checked" : ""}></label>
          <div><span>Discount</span><b>-${money(totals.discountAmount)}</b></div>
          <div class="grand"><span>Total</span><b>${money(totals.total)}</b></div>
        </div>

        <div class="payment-box">
          <input id="cashPaid" type="number" step="0.01" min="0" value="${escapeHtml(cashPaid || "0.00")}" placeholder="Cash paid">
          <div>Change: <b>${money(change)}</b></div>
        </div>

        <div class="actions">
          <button class="secondary" data-action="hold-order">Hold order</button>
          <button class="secondary" data-action="clear-order">Clear</button>
          <button class="pay" data-action="pay-cash">Cash</button>
          <button class="pay" data-action="pay-card">Card</button>
        </div>
      </aside>
    </section>
  `;
}

function renderTicketLine(line) {
  const addons = (line.addOns || []);
  return `
    <div class="ticket-line" data-line-id="${escapeHtml(line.LineID)}">
      <div class="line-head">
        <b>${escapeHtml(line.ItemName)}</b>
        <span>${money(lineTotal(line))}</span>
      </div>
      <div class="line-controls">
        <button data-line-dec="${escapeHtml(line.LineID)}">-</button>
        <b>${escapeHtml(line.Qty || 1)}</b>
        <button data-line-inc="${escapeHtml(line.LineID)}">+</button>
        <button data-line-copy="${escapeHtml(line.LineID)}">+ same</button>
        <button data-line-remove="${escapeHtml(line.LineID)}">remove</button>
      </div>
      ${addons.length ? `<ul>${addons.map(a => `<li>${escapeHtml(a.PromptTitle)}: ${escapeHtml(a.OptionText)} ${Number(a.Qty || 1) > 1 ? `x${escapeHtml(a.Qty)}` : ""} ${Number(a.PriceEach || 0) ? money(Number(a.PriceEach || 0) * Number(a.Qty || 1)) : ""}</li>`).join("")}</ul>` : ""}
      ${line.ItemNote ? `<small class="note">Note: ${escapeHtml(line.ItemNote)}</small>` : ""}
      ${line.LoyaltyEligible ? `<small class="note">Loyalty eligible</small>` : ""}
    </div>
  `;
}

function bindScreenEvents() {
  $$(".tabs .pill").forEach(btn => btn.addEventListener("click", () => setState(s => s.activeTab = btn.dataset.tab)));
  $$(".category").forEach(btn => btn.addEventListener("click", () => setState(s => s.activeCategory = btn.dataset.category)));
  $$(".item-card").forEach(btn => btn.addEventListener("click", () => openItemFlow(btn.dataset.itemId)));

  const orderType = $("#orderType");
  if (orderType) orderType.addEventListener("change", e => setState(s => s.currentTicket.orderType = e.target.value));
  ["serverName", "tableNumber", "customerName", "orderNote", "cashPaid"].forEach(id => {
    const el = $("#" + id);
    if (el) el.addEventListener("input", e => {
      state.currentTicket[id] = e.target.value;
      saveState(state);
      if (id === "cashPaid") render();
    });
  });
  const discount = $("#staffDiscount");
  if (discount) discount.addEventListener("change", e => setState(s => s.currentTicket.staffDiscount = e.target.checked));
  const loyaltyOn = $("#loyaltyRedeemOn");
  if (loyaltyOn) loyaltyOn.addEventListener("change", e => setState(s => s.currentTicket.loyaltyRedeemedQty = e.target.checked ? Math.max(1, Number(s.currentTicket.loyaltyRedeemedQty || 0)) : 0));
  const loyaltyQty = $("#loyaltyQty");
  if (loyaltyQty) loyaltyQty.addEventListener("input", e => setState(s => s.currentTicket.loyaltyRedeemedQty = Math.max(0, Number(e.target.value || 0))));

  $$("[data-loyalty-inc]").forEach(b => b.addEventListener("click", () => setState(s => s.currentTicket.loyaltyRedeemedQty = Number(s.currentTicket.loyaltyRedeemedQty || 0) + 1)));
  $$("[data-loyalty-dec]").forEach(b => b.addEventListener("click", () => setState(s => s.currentTicket.loyaltyRedeemedQty = Math.max(0, Number(s.currentTicket.loyaltyRedeemedQty || 0) - 1))));

  $$("[data-line-inc]").forEach(b => b.addEventListener("click", () => changeLineQty(b.dataset.lineInc, 1)));
  $$("[data-line-dec]").forEach(b => b.addEventListener("click", () => changeLineQty(b.dataset.lineDec, -1)));
  $$("[data-line-remove]").forEach(b => b.addEventListener("click", () => setState(s => s.currentTicket.lines = s.currentTicket.lines.filter(l => l.LineID !== b.dataset.lineRemove))));
  $$("[data-line-copy]").forEach(b => b.addEventListener("click", () => copyLine(b.dataset.lineCopy)));

  $$("[data-action]").forEach(b => b.addEventListener("click", () => handleAction(b.dataset.action)));

  bindTabSpecificEvents();
}

function bindTabSpecificEvents() {
  if (state.activeTab === "settings") bindSettingsEvents();
  if (state.activeTab === "admin") bindAdminEvents();
  if (state.activeTab === "reports") bindReportEvents();
  if (state.activeTab === "history") bindHistoryEvents();
  if (state.activeTab === "kitchen") bindKitchenEvents();
  if (state.activeTab === "held") bindHeldEvents();
  if (state.activeTab === "refunds") bindRefundEvents();
  if (state.activeTab === "stock") bindStockEvents();
  if (state.activeTab === "staff") bindStaffEvents();
}

function changeLineQty(lineId, delta) {
  setState(s => {
    const line = s.currentTicket.lines.find(l => l.LineID === lineId);
    if (!line) return;
    line.Qty = Math.max(1, Number(line.Qty || 1) + delta);
  });
}

function copyLine(lineId) {
  setState(s => {
    const line = s.currentTicket.lines.find(l => l.LineID === lineId);
    if (!line) return;
    const copy = JSON.parse(JSON.stringify(line));
    copy.LineID = uid("L");
    s.currentTicket.lines.push(copy);
  });
}

function openItemFlow(itemId) {
  const item = state.db.menu.find(i => i.ItemID === itemId);
  if (!item) return;

  const prompts = (state.db.prompts || [])
    .filter(p => p.TriggerItemID === itemId && asBool(p.Active))
    .sort((a, b) => Number(a.Sort || 0) - Number(b.Sort || 0));

  if (!prompts.length) {
    addLineFromSelections(item, []);
    return;
  }

  let step = 0;
  const selections = [];
  const modal = openModal(`<div id="promptRoot"></div>`);
  const promptRoot = $("#promptRoot", modal.root);

  function renderPrompt() {
    const prompt = prompts[step];
    const options = (state.db.promptOptions || [])
      .filter(o => o.PromptID === prompt.PromptID && asBool(o.Active))
      .sort((a, b) => Number(a.Sort || 0) - Number(b.Sort || 0));

    const isMulti = String(prompt.PromptType || "").toLowerCase() === "multi";
    promptRoot.innerHTML = `
      <h2>${escapeHtml(prompt.PromptTitle)}</h2>
      <p class="muted">${escapeHtml(item.ItemName)} • step ${step + 1} of ${prompts.length}${asBool(prompt.Required) ? " • required" : ""}</p>
      <div class="prompt-options ${isMulti ? "multi" : "single"}">
        ${options.map(o => renderPromptOption(prompt, o, isMulti)).join("")}
      </div>
      ${asBool(prompt.AllowNotes) ? `
        <label class="field prompt-note">
          <span>Order note</span>
          <textarea id="promptNote" placeholder="Type any notes for this item e.g. no beans, extra hot, allergy note"></textarea>
          <small>This note is saved with the item on the ticket, kitchen view and reports.</small>
        </label>
      ` : ""}
      <div class="modal-actions">
        <button class="secondary" id="promptCancel">Cancel</button>
        <button class="primary" id="promptContinue">Continue</button>
      </div>
    `;

    $("#promptCancel", modal.root).addEventListener("click", () => modal.close());
    $("#promptContinue", modal.root).addEventListener("click", () => {
      const picked = collectPromptSelection(prompt, options, isMulti);
      if (asBool(prompt.Required) && !picked.options.length) {
        toast("Pick an option before continuing.");
        return;
      }
      selections.push(picked);
      step += 1;
      if (step >= prompts.length) {
        addLineFromSelections(item, selections);
        modal.close();
      } else {
        renderPrompt();
      }
    });

    if (!isMulti) {
      $$(".prompt-card", modal.root).forEach(card => card.addEventListener("click", () => {
        $$(".prompt-card", modal.root).forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        const radio = card.querySelector("input[type=radio]");
        if (radio) radio.checked = true;
      }));
    }
    function updateQtyCard(input) {
      const card = input.closest(".prompt-card");
      if (!card) return;
      const qty = Math.max(0, Number(input.value || 0));
      input.value = qty;
      card.classList.toggle("selected", qty > 0);
      const total = card.querySelector(".option-total");
      if (total) total.textContent = money(Number(card.dataset.price || 0) * qty);
    }
    $$(".qty button", modal.root).forEach(btn => btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const delta = btn.dataset.delta === "1" ? 1 : -1;
      input.value = Math.max(0, Number(input.value || 0) + delta);
      updateQtyCard(input);
    }));
    $$("[data-option-qty]", modal.root).forEach(input => input.addEventListener("input", () => updateQtyCard(input)));
  }

  renderPrompt();
}

function renderPromptOption(prompt, option, isMulti) {
  const allowValue = asBool(option.AllowValue);
  const optId = escapeHtml(option.OptionID);
  const price = Number(option.Price || 0);
  if (isMulti || allowValue) {
    return `
      <div class="prompt-card qty-card" data-option-id="${optId}" data-price="${escapeHtml(price)}">
        <div><b>${escapeHtml(option.OptionText)}</b><small>${money(price)} each</small><strong class="option-total">${money(0)} total</strong></div>
        <div class="qty"><button type="button" data-delta="-1">−</button><input type="number" min="0" value="0" data-option-qty="${optId}"><button type="button" data-delta="1">+</button></div>
      </div>
    `;
  }
  return `
    <label class="prompt-card" data-option-id="${optId}">
      <input type="radio" name="prompt_${escapeHtml(prompt.PromptID)}" value="${optId}">
      <span><b>${escapeHtml(option.OptionText)}</b>${price ? `<small>+ ${money(price)}</small>` : ""}</span>
    </label>
  `;
}

function collectPromptSelection(prompt, options, isMulti) {
  const selected = [];
  if (isMulti) {
    options.forEach(o => {
      const input = $(`[data-option-qty="${CSS.escape(o.OptionID)}"]`);
      const qty = input ? Number(input.value || 0) : 0;
      if (qty > 0) selected.push({ ...o, Qty: qty });
    });
  } else {
    const checked = $(`input[name="prompt_${CSS.escape(prompt.PromptID)}"]:checked`);
    if (checked) {
      const o = options.find(x => x.OptionID === checked.value);
      if (o && String(o.OptionText).toLowerCase() !== "none") selected.push({ ...o, Qty: 1 });
    }
  }
  return {
    prompt,
    options: selected,
    note: $("#promptNote") ? $("#promptNote").value.trim() : ""
  };
}

function addLineFromSelections(item, selections) {
  const addOns = [];
  const notes = [];

  selections.forEach(sel => {
    if (sel.note) notes.push(sel.note);
    sel.options.forEach(o => {
      addOns.push({
        AddOnID: uid("A"),
        PromptID: sel.prompt.PromptID,
        PromptTitle: sel.prompt.PromptTitle,
        OptionID: o.OptionID,
        OptionText: o.OptionText,
        Qty: Number(o.Qty || 1),
        PriceEach: Number(o.Price || 0),
        Total: round2(Number(o.Price || 0) * Number(o.Qty || 1)),
        Action: o.Action || "",
        AllowValue: asBool(o.AllowValue)
      });
    });
  });

  setState(s => {
    s.currentTicket.lines.push({
      LineID: uid("L"),
      ItemID: item.ItemID,
      ItemName: item.ItemName,
      Category: item.CategoryName,
      Qty: 1,
      BasePrice: Number(item.Price || 0),
      addOns,
      AddOnsTotal: round2(addOns.reduce((sum, a) => sum + Number(a.Total || 0), 0)),
      LineTotal: 0,
      LoyaltyEligible: asBool(item.LoyaltyEligible),
      LoyaltyRedeemed: false,
      ItemNote: notes.join(" | "),
      Route: item.KitchenRoute || routeFor(item.CategoryName),
      Sort: item.Sort || 0
    });
  });
}

function handleAction(action) {
  switch (action) {
    case "hold-order": return holdCurrentOrder();
    case "clear-order": return setState(s => s.currentTicket = newBlankTicket());
    case "pay-cash": return completeTicket("Cash");
    case "pay-card": return completeTicket("Card");
  }
}

function applyLoyalty(lines, count) {
  let remaining = Number(count || 0);
  return lines.map(line => {
    const copy = { ...line, addOns: (line.addOns || []).map(a => ({ ...a })) };
    if (remaining > 0 && copy.LoyaltyEligible) {
      copy.LoyaltyRedeemed = true;
      remaining -= 1;
    } else {
      copy.LoyaltyRedeemed = false;
    }
    return copy;
  });
}

function completeTicket(paymentType) {
  if (!state.currentTicket.lines.length) {
    toast("Add at least one item first.");
    return;
  }

  const preparedLines = applyLoyalty(state.currentTicket.lines, state.currentTicket.loyaltyRedeemedQty);
  state.currentTicket.lines = preparedLines;
  const totals = ticketTotals(state);
  const createdAt = todayISO();
  const ticketId = uid("T");
  const ticketNo = ticketNoFor(state);
  const bDate = businessDate();

  const ticket = {
    TicketID: ticketId,
    TicketNo: ticketNo,
    CreatedAt: createdAt,
    BusinessDate: bDate,
    OrderType: state.currentTicket.orderType,
    ServerName: state.currentTicket.serverName,
    TableNumber: state.currentTicket.tableNumber,
    CustomerName: state.currentTicket.customerName,
    PaymentType: paymentType,
    Subtotal: totals.subtotal,
    DiscountPercent: totals.discountPercent,
    DiscountAmount: totals.discountAmount,
    LoyaltyRedeemedQty: Number(state.currentTicket.loyaltyRedeemedQty || 0),
    Total: totals.total,
    CashPaid: paymentType === "Cash" ? Number(state.currentTicket.cashPaid || 0) : 0,
    ChangeDue: paymentType === "Cash" ? Math.max(0, Number(state.currentTicket.cashPaid || 0) - totals.total) : 0,
    Status: "paid",
    DeviceID: state.deviceId,
    FrontendVersion: APP_VERSION,
    BackendVersion: "",
    UpdatedAt: createdAt,
    OrderNote: state.currentTicket.orderNote
  };

  const ticketItems = preparedLines.map(line => ({
    TicketID: ticketId,
    LineID: line.LineID,
    ItemID: line.ItemID,
    ItemName: line.ItemName,
    Category: line.Category,
    Qty: Number(line.Qty || 1),
    BasePrice: Number(line.BasePrice || 0),
    AddOnsTotal: round2((line.addOns || []).reduce((sum, a) => sum + Number(a.Total || 0), 0)),
    LineTotal: line.LoyaltyRedeemed ? 0 : round2(lineTotal(line)),
    LoyaltyRedeemed: !!line.LoyaltyRedeemed,
    ItemNote: line.ItemNote || "",
    Route: line.Route || routeFor(line.Category),
    Sort: line.Sort || 0,
    CreatedAt: createdAt
  }));

  const ticketAddOns = preparedLines.flatMap(line => (line.addOns || []).map(add => ({
    TicketID: ticketId,
    LineID: line.LineID,
    AddOnID: add.AddOnID,
    PromptID: add.PromptID,
    PromptTitle: add.PromptTitle,
    OptionID: add.OptionID,
    OptionText: add.OptionText,
    Qty: Number(add.Qty || 1),
    PriceEach: Number(add.PriceEach || 0),
    Total: line.LoyaltyRedeemed ? 0 : Number(add.Total || 0),
    Action: add.Action || "",
    AllowValue: !!add.AllowValue,
    CreatedAt: createdAt
  })));

  const kitchen = {
    TicketID: ticketId,
    TicketNo: ticketNo,
    CreatedAt: createdAt,
    OrderType: ticket.OrderType,
    ServerName: ticket.ServerName,
    TableNumber: ticket.TableNumber,
    CustomerName: ticket.CustomerName,
    FoodStatus: ticketItems.some(i => i.Route !== "drink") ? "open" : "none",
    DrinkStatus: ticketItems.some(i => i.Route === "drink") ? "open" : "none",
    OrderStatus: "open",
    UpdatedAt: createdAt,
    Json: JSON.stringify({ ticket, items: ticketItems, addOns: ticketAddOns, orderNote: ticket.OrderNote })
  };

  setState(s => {
    s.tickets.unshift(ticket);
    s.ticketItems.push(...ticketItems);
    s.ticketAddOns.push(...ticketAddOns);
    s.kitchenQueue.unshift(kitchen);
    enqueue(s, "saveTicket", { ticket, items: ticketItems, addOns: ticketAddOns, kitchen });
    s.currentTicket = newBlankTicket();
  });

  toast(`Ticket ${ticketNo} saved`);
}

function holdCurrentOrder() {
  if (!state.currentTicket.lines.length) {
    toast("Nothing to hold.");
    return;
  }

  const hold = {
    HoldID: uid("H"),
    CreatedAt: todayISO(),
    UpdatedAt: todayISO(),
    ServerName: state.currentTicket.serverName,
    TableNumber: state.currentTicket.tableNumber,
    CustomerName: state.currentTicket.customerName,
    OrderType: state.currentTicket.orderType,
    Json: JSON.stringify(state.currentTicket),
    Status: "held",
    DeviceID: state.deviceId
  };

  setState(s => {
    s.heldOrders.unshift(hold);
    enqueue(s, "saveHeldOrder", { hold });
    s.currentTicket = newBlankTicket();
  });
  toast("Order held");
}

function renderHeld() {
  return `
    <section class="card">
      <div class="section-head"><h2>Held orders</h2><p>Reload held orders back to the till with all add-ons and notes.</p></div>
      <div class="list">
        ${state.heldOrders.filter(h => h.Status !== "deleted").map(h => `
          <div class="row-card">
            <b>${escapeHtml(h.CustomerName || h.TableNumber || h.HoldID)}</b>
            <span>${escapeHtml(h.OrderType)} • ${escapeHtml(h.CreatedAt)}</span>
            <div class="actions">
              <button data-held-load="${escapeHtml(h.HoldID)}">Load to till</button>
              <button data-held-delete="${escapeHtml(h.HoldID)}">Delete</button>
            </div>
          </div>`).join("") || `<div class="empty">No held orders.</div>`}
      </div>
    </section>
  `;
}

function bindHeldEvents() {
  $$("[data-held-load]").forEach(b => b.addEventListener("click", () => {
    const hold = state.heldOrders.find(h => h.HoldID === b.dataset.heldLoad);
    if (!hold) return;
    setState(s => {
      s.currentTicket = JSON.parse(hold.Json);
      hold.Status = "loaded";
      s.activeTab = "till";
      enqueue(s, "deleteHeldOrder", { HoldID: hold.HoldID });
    });
  }));
  $$("[data-held-delete]").forEach(b => b.addEventListener("click", () => setState(s => {
    const hold = s.heldOrders.find(h => h.HoldID === b.dataset.heldDelete);
    if (hold) hold.Status = "deleted";
    enqueue(s, "deleteHeldOrder", { HoldID: b.dataset.heldDelete });
  })));
}

function renderReports() {
  const report = buildReport();
  return `
    <section class="card">
      <div class="section-head">
        <h2>Reports</h2>
        <p>Accounting report from ticket, item, add-on and refund records.</p>
      </div>
      <div class="toolbar">
        ${field("From", "dateFrom", state.ui.dateFrom, "date")}
        ${field("To", "dateTo", state.ui.dateTo, "date")}
        <button id="refreshReports">Refresh tickets</button>
        <button id="exportReportCsv">Export CSV</button>
      </div>
      <div class="kpi-grid">
        <div class="kpi"><span>Total revenue</span><b>${money(report.totalRevenue)}</b></div>
        <div class="kpi"><span>Cash</span><b>${money(report.cashTotal)}</b></div>
        <div class="kpi"><span>Card</span><b>${money(report.cardTotal)}</b></div>
        <div class="kpi"><span>Refunds</span><b>${money(report.refundTotal)}</b></div>
        <div class="kpi"><span>Loyalty drinks</span><b>${escapeHtml(report.loyaltyQty)}</b></div>
        <div class="kpi"><span>Tickets</span><b>${escapeHtml(report.tickets.length)}</b></div>
      </div>
      <div class="report-grid">
        ${renderReportTable("Top 20 products", report.topProducts)}
        ${renderReportTable("Sold by category", report.byCategory)}
        ${renderReportTable("Sold by hour", report.byHour)}
        ${renderReportTable("Most popular add-ons", report.topAddOns)}
        ${renderReportTable("Least popular items", report.leastPopular)}
      </div>
    </section>
  `;
}

function buildReport() {
  const from = state.ui.dateFrom || "0000-00-00";
  const to = state.ui.dateTo || "9999-99-99";
  const tickets = state.tickets.filter(t => t.BusinessDate >= from && t.BusinessDate <= to && t.Status !== "refunded");
  const refunds = state.refunds.filter(r => String(r.CreatedAt || "").slice(0, 10) >= from && String(r.CreatedAt || "").slice(0, 10) <= to);
  const items = state.ticketItems.filter(i => tickets.some(t => t.TicketID === i.TicketID));
  const addons = state.ticketAddOns.filter(a => tickets.some(t => t.TicketID === a.TicketID));

  const sum = (arr, fieldName) => arr.reduce((n, x) => n + Number(x[fieldName] || 0), 0);
  const group = (arr, keyFn, valFn = () => 1) => Object.entries(arr.reduce((acc, row) => {
    const k = keyFn(row) || "Unknown";
    acc[k] = (acc[k] || 0) + Number(valFn(row) || 0);
    return acc;
  }, {})).map(([name, value]) => ({ name, value: round2(value) })).sort((a, b) => b.value - a.value);

  return {
    tickets,
    refunds,
    totalRevenue: round2(sum(tickets, "Total") - sum(refunds, "RefundTotal")),
    cashTotal: round2(sum(tickets.filter(t => t.PaymentType === "Cash"), "Total")),
    cardTotal: round2(sum(tickets.filter(t => t.PaymentType === "Card"), "Total")),
    refundTotal: round2(sum(refunds, "RefundTotal")),
    loyaltyQty: sum(tickets, "LoyaltyRedeemedQty"),
    topProducts: group(items, i => i.ItemName, i => i.Qty).slice(0, 20),
    byCategory: group(items, i => i.Category, i => i.LineTotal),
    byHour: group(tickets, t => String(t.CreatedAt || "").slice(11, 13) + ":00", t => t.Total).sort((a,b) => a.name.localeCompare(b.name)),
    topAddOns: group(addons, a => a.OptionText, a => a.Qty).slice(0, 20),
    leastPopular: group(items, i => i.ItemName, i => i.Qty).sort((a,b) => a.value - b.value).slice(0, 20)
  };
}

function renderReportTable(title, rows) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return `
    <div class="mini-card">
      <h3>${escapeHtml(title)}</h3>
      <table>
        <tbody>${rows.map(r => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.value)}</td><td><div class="bar" style="width:${Math.max(3, (r.value / max) * 100)}%"></div></td></tr>`).join("") || `<tr><td>No data</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function bindReportEvents() {
  $("#dateFrom")?.addEventListener("change", e => setState(s => s.ui.dateFrom = e.target.value));
  $("#dateTo")?.addEventListener("change", e => setState(s => s.ui.dateTo = e.target.value));
  $("#refreshReports")?.addEventListener("click", async () => {
    await refreshHistoryFromServer();
    toast("Reports refreshed");
  });
  $("#exportReportCsv")?.addEventListener("click", () => {
    const report = buildReport();
    const rows = [["TicketNo","Date","Payment","Subtotal","Discount","LoyaltyQty","Total"]];
    report.tickets.forEach(t => rows.push([t.TicketNo, t.CreatedAt, t.PaymentType, t.Subtotal, t.DiscountAmount, t.LoyaltyRedeemedQty, t.Total]));
    downloadText(`nook-report-${state.ui.dateFrom}-to-${state.ui.dateTo}.csv`, rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"), "text/csv");
  });
}

async function refreshHistoryFromServer() {
  if (!state.settings.scriptUrl) return;
  try {
    const res = await getTicketHistory(state, { dateFrom: state.ui.dateFrom, dateTo: state.ui.dateTo, search: state.ui.historySearch || "" });
    setState(s => {
      if (res.tickets) s.tickets = res.tickets;
      if (res.items) s.ticketItems = res.items;
      if (res.addOns) s.ticketAddOns = res.addOns;
      if (res.refunds) s.refunds = res.refunds;
      s.lastRead = "OK";
    });
  } catch (err) {
    toast(err.message);
    addSyncLog(state, "error", err.message, "getTicketHistory");
  }
}

function renderHistory() {
  const search = String(state.ui.historySearch || "").toLowerCase();
  const rows = state.tickets.filter(t => !search || String(t.TicketNo + t.CustomerName + t.TableNumber).toLowerCase().includes(search));
  return `
    <section class="card">
      <div class="section-head"><h2>Ticket history</h2><p>Tickets stay on screen until Refresh tickets is pressed.</p></div>
      <div class="toolbar">
        <input id="historySearch" placeholder="Ticket number, customer or table" value="${escapeHtml(state.ui.historySearch || "")}">
        <button id="refreshHistory">Refresh tickets</button>
      </div>
      <div class="list">
        ${rows.map(t => `
          <div class="row-card">
            <b>${escapeHtml(t.TicketNo)}</b>
            <span>${escapeHtml(t.CreatedAt)} • ${escapeHtml(t.PaymentType)} • ${money(t.Total)} • ${escapeHtml(t.CustomerName || t.TableNumber || "")}</span>
            <div class="actions">
              <button data-ticket-view="${escapeHtml(t.TicketID)}">View</button>
              <button data-ticket-reload="${escapeHtml(t.TicketID)}">Reload to till</button>
              <button data-ticket-refund="${escapeHtml(t.TicketID)}">Refund</button>
              <button data-ticket-print="${escapeHtml(t.TicketID)}">Print</button>
            </div>
          </div>`).join("") || `<div class="empty">No tickets loaded.</div>`}
      </div>
    </section>
  `;
}

function bindHistoryEvents() {
  $("#historySearch")?.addEventListener("input", e => { state.ui.historySearch = e.target.value; saveState(state); });
  $("#refreshHistory")?.addEventListener("click", async () => { await refreshHistoryFromServer(); render(); });
  $$("[data-ticket-view]").forEach(b => b.addEventListener("click", () => openTicketView(b.dataset.ticketView)));
  $$("[data-ticket-reload]").forEach(b => b.addEventListener("click", () => reloadTicketToTill(b.dataset.ticketReload)));
  $$("[data-ticket-refund]").forEach(b => b.addEventListener("click", () => openRefundModal(b.dataset.ticketRefund)));
  $$("[data-ticket-print]").forEach(b => b.addEventListener("click", () => printTicket(b.dataset.ticketPrint)));
}

function ticketBundle(ticketId) {
  const ticket = state.tickets.find(t => t.TicketID === ticketId);
  const items = state.ticketItems.filter(i => i.TicketID === ticketId);
  const addOns = state.ticketAddOns.filter(a => a.TicketID === ticketId);
  return { ticket, items, addOns };
}

function openTicketView(ticketId) {
  const { ticket, items, addOns } = ticketBundle(ticketId);
  if (!ticket) return;
  openModal(`
    <h2>Ticket ${escapeHtml(ticket.TicketNo)}</h2>
    <p>${escapeHtml(ticket.CreatedAt)} • ${escapeHtml(ticket.OrderType)} • ${escapeHtml(ticket.CustomerName || ticket.TableNumber || "")}</p>
    <div class="receipt-view">
      ${items.map(i => {
        const a = addOns.filter(x => x.LineID === i.LineID);
        return `<div><b>${escapeHtml(i.Qty)} x ${escapeHtml(i.ItemName)}</b><span>${money(i.LineTotal)}</span>${a.length ? `<ul>${a.map(x => `<li>${escapeHtml(x.PromptTitle)}: ${escapeHtml(x.OptionText)} ${Number(x.Qty)>1 ? "x"+x.Qty : ""}</li>`).join("")}</ul>` : ""}${i.ItemNote ? `<small>${escapeHtml(i.ItemNote)}</small>` : ""}</div>`;
      }).join("")}
      <hr><b>Total: ${money(ticket.Total)}</b>
    </div>
    <div class="modal-actions"><button onclick="this.closest('.modal-backdrop').remove()">Close</button></div>
  `);
}

function reloadTicketToTill(ticketId) {
  const { ticket, items, addOns } = ticketBundle(ticketId);
  if (!ticket) return;
  setState(s => {
    s.currentTicket = {
      orderType: ticket.OrderType,
      serverName: ticket.ServerName,
      tableNumber: ticket.TableNumber,
      customerName: ticket.CustomerName,
      orderNote: ticket.OrderNote || "",
      loyaltyRedeemedQty: 0,
      staffDiscount: false,
      cashPaid: 0,
      lines: items.map(i => ({
        LineID: uid("L"),
        ItemID: i.ItemID,
        ItemName: i.ItemName,
        Category: i.Category,
        Qty: i.Qty,
        BasePrice: i.BasePrice,
        AddOnsTotal: i.AddOnsTotal,
        LoyaltyRedeemed: false,
        LoyaltyEligible: false,
        ItemNote: i.ItemNote,
        Route: i.Route,
        Sort: i.Sort,
        addOns: addOns.filter(a => a.LineID === i.LineID).map(a => ({ ...a, AddOnID: uid("A") }))
      }))
    };
    s.activeTab = "till";
  });
}

function openRefundModal(ticketId) {
  const { ticket, items, addOns } = ticketBundle(ticketId);
  if (!ticket) return;
  const modal = openModal(`
    <h2>Refund ticket ${escapeHtml(ticket.TicketNo)}</h2>
    <p>Select the lines to refund. Add-on prices are included with that line.</p>
    <div class="refund-lines">
      ${items.map(i => `<label class="refund-line"><input type="checkbox" value="${escapeHtml(i.LineID)}"> <span>${escapeHtml(i.Qty)} x ${escapeHtml(i.ItemName)} ${money(i.LineTotal)}</span></label>`).join("")}
    </div>
    <label class="field"><span>Reason</span><input id="refundReason" placeholder="Customer return / error / goodwill"></label>
    <div class="modal-actions"><button id="cancelRefund">Cancel</button><button id="confirmRefund" class="danger">Refund selected</button></div>
  `);
  $("#cancelRefund", modal.root).addEventListener("click", () => modal.close());
  $("#confirmRefund", modal.root).addEventListener("click", () => {
    const selected = $$("input[type=checkbox]:checked", modal.root).map(x => x.value);
    if (!selected.length) return toast("Select at least one line.");
    createRefund(ticket, items.filter(i => selected.includes(i.LineID)), addOns.filter(a => selected.includes(a.LineID)), $("#refundReason", modal.root).value);
    modal.close();
  });
}

function createRefund(ticket, items, addOns, reason) {
  const total = round2(items.reduce((sum, i) => sum + Number(i.LineTotal || 0), 0));
  const refund = {
    RefundID: uid("R"),
    OriginalTicketID: ticket.TicketID,
    TicketNo: ticket.TicketNo,
    CreatedAt: todayISO(),
    Reason: reason || "Refund",
    PaymentType: ticket.PaymentType,
    RefundTotal: total,
    Status: "refunded",
    DeviceID: state.deviceId,
    Json: JSON.stringify({ items, addOns })
  };
  setState(s => {
    s.refunds.unshift(refund);
    enqueue(s, "saveRefund", { refund });
  });
  toast(`Refund logged: ${money(total)}`);
}

function printTicket(ticketId) {
  const { ticket, items, addOns } = ticketBundle(ticketId);
  if (!ticket) return;
  const html = `
    <html><head><title>${escapeHtml(ticket.TicketNo)}</title><style>body{font-family:monospace;width:280px} .r{display:flex;justify-content:space-between} ul{margin:0 0 0 15px;padding:0}</style></head>
    <body><h2>THE NOOK</h2><b>${escapeHtml(ticket.TicketNo)}</b><hr>
    ${items.map(i => `<div class="r"><span>${escapeHtml(i.Qty)} x ${escapeHtml(i.ItemName)}</span><span>${money(i.LineTotal)}</span></div>${addOns.filter(a=>a.LineID===i.LineID).map(a=>`<div> - ${escapeHtml(a.OptionText)} ${Number(a.Qty)>1 ? "x"+a.Qty : ""}</div>`).join("")}`).join("")}
    <hr><div class="r"><b>Total</b><b>${money(ticket.Total)}</b></div></body></html>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

function renderRefunds() {
  return `
    <section class="card">
      <div class="section-head"><h2>Refunds</h2><p>Every refund is logged and deducted from reports.</p></div>
      <div class="list">
        ${state.refunds.map(r => `<div class="row-card"><b>${escapeHtml(r.TicketNo)} • ${money(r.RefundTotal)}</b><span>${escapeHtml(r.CreatedAt)} • ${escapeHtml(r.Reason)}</span></div>`).join("") || `<div class="empty">No refunds.</div>`}
      </div>
    </section>
  `;
}
function bindRefundEvents() {}

function renderKitchen() {
  const queue = state.kitchenQueue.filter(k => k.OrderStatus !== "complete");
  return `
    <section class="card">
      <div class="section-head"><h2>Kitchen display</h2><p>Orders update without a full screen reload. Complete food and drinks separately.</p></div>
      <div class="toolbar"><button id="refreshKitchen">Refresh kitchen queue</button></div>
      <div class="kitchen-grid">
        ${queue.map(renderKitchenTicket).join("") || `<div class="empty">No open kitchen tickets.</div>`}
      </div>
    </section>
  `;
}

function renderKitchenTicket(k) {
  let parsed = {};
  try { parsed = JSON.parse(k.Json || "{}"); } catch {}
  const items = parsed.items || state.ticketItems.filter(i => i.TicketID === k.TicketID);
  const addOns = parsed.addOns || state.ticketAddOns.filter(a => a.TicketID === k.TicketID);
  const food = items.filter(i => i.Route !== "drink");
  const drinks = items.filter(i => i.Route === "drink");

  const section = (title, rows, status, route) => `
    <div class="kds-section ${status === "complete" || status === "none" ? "done" : ""}">
      <h4>${title}</h4>
      ${rows.map(i => `<div><b>${escapeHtml(i.Qty)} x ${escapeHtml(i.ItemName)}</b>${addOns.filter(a=>a.LineID===i.LineID).map(a=>`<small>${escapeHtml(a.OptionText)} ${Number(a.Qty)>1 ? "x"+a.Qty : ""}</small>`).join("")}${i.ItemNote ? `<em>${escapeHtml(i.ItemNote)}</em>` : ""}</div>`).join("") || `<small>None</small>`}
      ${status !== "complete" && status !== "none" ? `<button data-kds-complete="${escapeHtml(k.TicketID)}" data-route="${route}">Complete ${title}</button>` : `<b class="tick">✓ complete</b>`}
    </div>`;

  return `
    <div class="kds-ticket ${k.OrderStatus === "complete" ? "complete" : ""}">
      <div class="kds-head">
        <b>${escapeHtml(k.TicketNo?.slice(-4) || k.TicketNo)}</b>
        <span>${escapeHtml(k.OrderType)} ${escapeHtml(k.TableNumber ? "Table " + k.TableNumber : "")}</span>
      </div>
      <small>${escapeHtml(k.CustomerName || "")} ${escapeHtml(k.ServerName ? "• " + k.ServerName : "")}</small>
      ${section("Food", food, k.FoodStatus, "food")}
      ${section("Drinks", drinks, k.DrinkStatus, "drink")}
      ${k.OrderStatus === "complete" ? `<div class="stamp">ORDER COMPLETE</div>` : ""}
    </div>
  `;
}

function bindKitchenEvents() {
  $("#refreshKitchen")?.addEventListener("click", async () => {
    if (!state.settings.scriptUrl) return toast("No backend URL saved; showing local queue.");
    try {
      const res = await getKitchenQueue(state);
      setState(s => s.kitchenQueue = res.queue || s.kitchenQueue);
    } catch (err) { toast(err.message); }
  });
  $$("[data-kds-complete]").forEach(b => b.addEventListener("click", () => completeKdsPart(b.dataset.kdsComplete, b.dataset.route)));
}

function completeKdsPart(ticketId, route) {
  setState(s => {
    const k = s.kitchenQueue.find(x => x.TicketID === ticketId);
    if (!k) return;
    if (route === "food") k.FoodStatus = "complete";
    if (route === "drink") k.DrinkStatus = "complete";
    if ((k.FoodStatus === "complete" || k.FoodStatus === "none") && (k.DrinkStatus === "complete" || k.DrinkStatus === "none")) {
      k.OrderStatus = "complete";
      setTimeout(() => {
        const latest = loadState();
        latest.kitchenQueue = latest.kitchenQueue.filter(x => x.TicketID !== ticketId);
        saveState(latest);
        state = latest;
        render();
      }, 3000);
    }
    k.UpdatedAt = todayISO();
    enqueue(s, "updateKitchenStatus", { TicketID: ticketId, FoodStatus: k.FoodStatus, DrinkStatus: k.DrinkStatus, OrderStatus: k.OrderStatus });
  });
}

function renderAdmin() {
  const filter = state.ui.filter || "";
  const menu = state.db.menu.filter(i => !filter || String(i.CategoryName + i.ItemName).toLowerCase().includes(filter.toLowerCase()));
  return `
    <section class="admin-layout">
      <div class="card">
        <div class="section-head"><h2>Menu Admin</h2><p>Add/edit menu items, categories and add-on prompts. Saves are queued to the database.</p></div>
        <div class="toolbar">
          <input id="adminFilter" placeholder="Sort/filter by item or category" value="${escapeHtml(filter)}">
          <button id="addMenuItem">Add item</button>
          <button id="addCategory">Add category</button>
        </div>
        <h3>Categories</h3>
        <div class="chips">
          ${state.db.categories.map(c => `<span class="chip">${escapeHtml(c.CategoryName)} <button data-cat-del="${escapeHtml(c.CategoryID)}">×</button></span>`).join("")}
        </div>
        <h3>Items</h3>
        <div class="admin-list">
          ${menu.map(item => renderAdminItem(item)).join("")}
        </div>
      </div>
      <div class="card">
        <h2>Add-on prompts</h2>
        <label class="field"><span>Prompt item</span><select id="promptItemSelect">${state.db.menu.map(i => `<option value="${escapeHtml(i.ItemID)}">${escapeHtml(i.ItemName)}</option>`).join("")}</select></label>
        <button id="addPrompt">Add prompt to selected item</button>
        <div class="admin-list prompts-list">
          ${state.db.prompts.map(p => renderAdminPrompt(p)).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderAdminItem(item) {
  const cats = state.db.categories.map(c => `<option value="${escapeHtml(c.CategoryName)}" ${c.CategoryName === item.CategoryName ? "selected" : ""}>${escapeHtml(c.CategoryName)}</option>`).join("");
  return `
    <details class="admin-detail">
      <summary><b>${escapeHtml(item.ItemName)}</b><span>${escapeHtml(item.CategoryName)} • ${money(item.Price)}</span></summary>
      <div class="edit-grid" data-admin-item="${escapeHtml(item.ItemID)}">
        <label>Item name<input data-field="ItemName" value="${escapeHtml(item.ItemName)}"></label>
        <label>Category<select data-field="CategoryName">${cats}</select></label>
        <label>Price<input data-field="Price" type="number" step="0.01" value="${escapeHtml(item.Price)}"></label>
        <label>Sort<input data-field="Sort" type="number" value="${escapeHtml(item.Sort || 0)}"></label>
        <label>Description<textarea data-field="Description">${escapeHtml(item.Description || "")}</textarea></label>
        <label><input data-field="Active" type="checkbox" ${asBool(item.Active) ? "checked" : ""}> Active</label>
        <label><input data-field="ShowOnTill" type="checkbox" ${asBool(item.ShowOnTill) ? "checked" : ""}> Show on till</label>
        <label><input data-field="LoyaltyEligible" type="checkbox" ${asBool(item.LoyaltyEligible) ? "checked" : ""}> Loyalty item</label>
        <div class="actions"><button data-item-save="${escapeHtml(item.ItemID)}">Save changes</button><button data-item-delete="${escapeHtml(item.ItemID)}">Remove item</button></div>
      </div>
    </details>
  `;
}

function renderAdminPrompt(prompt) {
  const item = state.db.menu.find(i => i.ItemID === prompt.TriggerItemID);
  const opts = state.db.promptOptions.filter(o => o.PromptID === prompt.PromptID).sort((a,b)=>Number(a.Sort||0)-Number(b.Sort||0));
  return `
    <details class="admin-detail">
      <summary><b>${escapeHtml(prompt.PromptTitle)}</b><span>${escapeHtml(item?.ItemName || prompt.TriggerItemID)} • ${escapeHtml(prompt.PromptType)}</span></summary>
      <div class="edit-grid" data-admin-prompt="${escapeHtml(prompt.PromptID)}">
        <label>Title<input data-field="PromptTitle" value="${escapeHtml(prompt.PromptTitle)}"></label>
        <label>Type<select data-field="PromptType"><option ${prompt.PromptType==="single"?"selected":""}>single</option><option ${prompt.PromptType==="multi"?"selected":""}>multi</option></select></label>
        <label>Sort<input data-field="Sort" type="number" value="${escapeHtml(prompt.Sort || 0)}"></label>
        <label><input data-field="Required" type="checkbox" ${asBool(prompt.Required) ? "checked" : ""}> Required</label>
        <label><input data-field="AllowNotes" type="checkbox" ${asBool(prompt.AllowNotes) ? "checked" : ""}> Allow text note</label>
        <label><input data-field="Active" type="checkbox" ${asBool(prompt.Active) ? "checked" : ""}> Active</label>
        <div class="actions"><button data-prompt-save="${escapeHtml(prompt.PromptID)}">Save prompt</button><button data-option-add="${escapeHtml(prompt.PromptID)}">Add option</button></div>
      </div>
      <div class="option-list">
        ${opts.map(o => `
          <div class="option-edit" data-admin-option="${escapeHtml(o.OptionID)}">
            <input data-field="OptionText" value="${escapeHtml(o.OptionText)}">
            <input data-field="Price" type="number" step="0.01" value="${escapeHtml(o.Price || 0)}">
            <label><input data-field="AllowValue" type="checkbox" ${asBool(o.AllowValue) ? "checked" : ""}> qty</label>
            <label><input data-field="Active" type="checkbox" ${asBool(o.Active) ? "checked" : ""}> active</label>
            <button data-option-save="${escapeHtml(o.OptionID)}">Save</button>
            <button data-option-delete="${escapeHtml(o.OptionID)}">Delete</button>
          </div>`).join("")}
      </div>
    </details>
  `;
}

function bindAdminEvents() {
  $("#adminFilter")?.addEventListener("input", e => { state.ui.filter = e.target.value; saveState(state); render(); });
  $("#addCategory")?.addEventListener("click", () => {
    const name = prompt("New category name");
    if (!name) return;
    setState(s => {
      const cat = { CategoryID: uid("CAT"), CategoryName: name, Sort: s.db.categories.length + 1, Active: true, ButtonColour: "#E8EDDF", UpdatedAt: todayISO() };
      s.db.categories.push(cat);
      enqueue(s, "saveAdminData", { sheet: "Categories", key: "CategoryID", row: cat });
    });
  });
  $("#addMenuItem")?.addEventListener("click", () => setState(s => {
    const firstCat = s.db.categories[0]?.CategoryName || "Breakfast";
    const item = { ItemID: uid("I"), CategoryID: s.db.categories[0]?.CategoryID || "", CategoryName: firstCat, ItemName: "New item", Description: "", Price: 0, TaxRate: 0, Active: true, ShowOnTill: true, KitchenRoute: routeFor(firstCat), Sort: 999, LoyaltyEligible: false, CostPrice: "", Barcode: "", DeletedAt: "", UpdatedAt: todayISO() };
    s.db.menu.unshift(item);
    enqueue(s, "saveAdminData", { sheet: "Menu", key: "ItemID", row: item });
  }));
  $$("[data-item-save]").forEach(b => b.addEventListener("click", () => saveAdminItem(b.dataset.itemSave)));
  $$("[data-item-delete]").forEach(b => b.addEventListener("click", () => setState(s => {
    const item = s.db.menu.find(i => i.ItemID === b.dataset.itemDelete);
    if (item) { item.Active = false; item.ShowOnTill = false; item.DeletedAt = todayISO(); enqueue(s, "saveAdminData", { sheet: "Menu", key: "ItemID", row: item }); }
  })));
  $$("[data-cat-del]").forEach(b => b.addEventListener("click", () => setState(s => {
    const cat = s.db.categories.find(c => c.CategoryID === b.dataset.catDel);
    if (cat) { cat.Active = false; enqueue(s, "saveAdminData", { sheet: "Categories", key: "CategoryID", row: cat }); }
  })));
  $("#addPrompt")?.addEventListener("click", () => {
    const itemId = $("#promptItemSelect").value;
    setState(s => {
      const prompt = { PromptID: uid("P"), TriggerItemID: itemId, PromptTitle: "New prompt", PromptType: "single", Required: false, Sort: 1, Active: true, AllowNotes: false, UpdatedAt: todayISO() };
      s.db.prompts.unshift(prompt);
      enqueue(s, "saveAdminData", { sheet: "Prompts", key: "PromptID", row: prompt });
    });
  });
  $$("[data-prompt-save]").forEach(b => b.addEventListener("click", () => saveAdminPrompt(b.dataset.promptSave)));
  $$("[data-option-add]").forEach(b => b.addEventListener("click", () => setState(s => {
    const option = { OptionID: uid("O"), PromptID: b.dataset.optionAdd, OptionText: "New option", Action: "Modifier", Value: "", Price: 0, Sort: 999, Active: true, AllowValue: false, UpdatedAt: todayISO() };
    s.db.promptOptions.push(option);
    enqueue(s, "saveAdminData", { sheet: "Prompt Options", key: "OptionID", row: option });
  })));
  $$("[data-option-save]").forEach(b => b.addEventListener("click", () => saveAdminOption(b.dataset.optionSave)));
  $$("[data-option-delete]").forEach(b => b.addEventListener("click", () => setState(s => {
    const opt = s.db.promptOptions.find(o => o.OptionID === b.dataset.optionDelete);
    if (opt) { opt.Active = false; enqueue(s, "saveAdminData", { sheet: "Prompt Options", key: "OptionID", row: opt }); }
  })));
}

function readEditFields(container) {
  const row = {};
  $$("[data-field]", container).forEach(el => {
    row[el.dataset.field] = el.type === "checkbox" ? el.checked : el.value;
  });
  return row;
}

function saveAdminItem(itemId) {
  const box = $(`[data-admin-item="${CSS.escape(itemId)}"]`);
  const item = state.db.menu.find(i => i.ItemID === itemId);
  if (!box || !item) return;
  setState(s => {
    Object.assign(item, readEditFields(box), { UpdatedAt: todayISO() });
    item.Price = Number(item.Price || 0);
    item.Sort = Number(item.Sort || 0);
    item.CategoryID = s.db.categories.find(c => c.CategoryName === item.CategoryName)?.CategoryID || item.CategoryID;
    item.KitchenRoute = routeFor(item.CategoryName);
    enqueue(s, "saveAdminData", { sheet: "Menu", key: "ItemID", row: item });
  });
  toast("Item saved");
}

function saveAdminPrompt(promptId) {
  const box = $(`[data-admin-prompt="${CSS.escape(promptId)}"]`);
  const p = state.db.prompts.find(x => x.PromptID === promptId);
  if (!box || !p) return;
  setState(s => {
    Object.assign(p, readEditFields(box), { UpdatedAt: todayISO() });
    p.Sort = Number(p.Sort || 0);
    enqueue(s, "saveAdminData", { sheet: "Prompts", key: "PromptID", row: p });
  });
}

function saveAdminOption(optionId) {
  const box = $(`[data-admin-option="${CSS.escape(optionId)}"]`);
  const opt = state.db.promptOptions.find(x => x.OptionID === optionId);
  if (!box || !opt) return;
  setState(s => {
    Object.assign(opt, readEditFields(box), { UpdatedAt: todayISO() });
    opt.Price = Number(opt.Price || 0);
    enqueue(s, "saveAdminData", { sheet: "Prompt Options", key: "OptionID", row: opt });
  });
}

function renderSettings() {
  return `
    <section class="settings-grid">
      <div class="card">
        <h2>Backend URL</h2>
        <label class="field"><span>Apps Script Web App URL</span><input id="scriptUrl" value="${escapeHtml(state.settings.scriptUrl || "")}" placeholder="https://script.google.com/macros/s/.../exec"></label>
        <div class="actions"><button id="saveUrl">Save URL</button><button id="testUrl">Test URL</button><button id="loadServerData">Load menu from database</button></div>
        <h3>Saved URLs</h3>
        <div class="saved-urls">${(state.settings.savedUrls || []).map(u => `<button data-use-url="${escapeHtml(u.url)}">${escapeHtml(u.version || "saved")} • ${escapeHtml(u.url.slice(0, 38))}...</button>`).join("") || "<small>No saved URLs yet.</small>"}</div>
      </div>
      <div class="card">
        <h2>Printer settings</h2>
        <label><input id="receiptPrintingEnabled" type="checkbox" ${asBool(state.settings.ReceiptPrintingEnabled) ? "checked" : ""}> Print receipts</label>
        <label><input id="printCustomer" type="checkbox" ${asBool(state.settings.PrintCustomerReceipt) ? "checked" : ""}> Customer receipt</label>
        <label><input id="printTill" type="checkbox" ${asBool(state.settings.PrintTillReceipt) ? "checked" : ""}> Till receipt</label>
        <label><input id="printKitchen" type="checkbox" ${asBool(state.settings.PrintKitchenReceipt) ? "checked" : ""}> Kitchen receipt</label>
        ${field("Printer / bridge IP", "printerIp", state.settings.PrinterIP || "")}
        ${field("Port", "printerPort", state.settings.PrinterPort || "9100", "number")}
        <button id="printerTest">Printer test</button>
        <p class="muted">iPad browser printing works through the browser print dialog. Raw ESC/POS network printing needs a local print bridge such as the Raspberry Pi option discussed.</p>
      </div>
      <div class="card">
        <h2>Discount and system</h2>
        ${field("Staff discount %", "staffDiscountPercent", state.settings.StaffDiscountPercent || 0, "number")}
        <label><input id="offlineMode" type="checkbox" ${state.settings.offlineMode ? "checked" : ""}> Offline mode: save locally and queue sync</label>
        <div class="actions"><button id="setupDb">Database builder / repairer</button><button id="backupNow">Backup app data</button><button id="restoreNow">Restore backup</button><button id="clearLocal">Clear local fallback</button></div>
        <div class="system-info">
          <div>Frontend: <b>${APP_VERSION}</b></div>
          <div>Expected database: <b>${DB_VERSION}</b></div>
          <div>Loaded menu items: <b>${state.db.menu.length}</b></div>
          <div>Queue: <b>${state.syncQueue.length}</b></div>
        </div>
      </div>
    </section>
  `;
}

function bindSettingsEvents() {
  $("#saveUrl")?.addEventListener("click", () => setState(s => {
    s.settings.scriptUrl = $("#scriptUrl").value.trim();
    if (s.settings.scriptUrl) {
      s.settings.savedUrls = [{ url: s.settings.scriptUrl, version: APP_VERSION, savedAt: todayISO() }, ...(s.settings.savedUrls || []).filter(x => x.url !== s.settings.scriptUrl)].slice(0, 5);
    }
  }));
  $$("[data-use-url]").forEach(b => b.addEventListener("click", () => setState(s => s.settings.scriptUrl = b.dataset.useUrl)));
  $("#testUrl")?.addEventListener("click", async () => {
    try { const res = await testBackend(state); toast(`Backend OK: ${res.backendVersion || "responded"}`); }
    catch (err) { toast(err.message); }
  });
  $("#setupDb")?.addEventListener("click", async () => {
    try { const res = await setupDatabase(state); toast(`Database checked: ${res.created?.length || 0} tabs created`); }
    catch (err) { toast(err.message); }
  });
  $("#loadServerData")?.addEventListener("click", loadBootstrap);
  ["receiptPrintingEnabled","printCustomer","printTill","printKitchen","offlineMode"].forEach(id => {
    $("#" + id)?.addEventListener("change", e => setState(s => {
      const map = { receiptPrintingEnabled:"ReceiptPrintingEnabled", printCustomer:"PrintCustomerReceipt", printTill:"PrintTillReceipt", printKitchen:"PrintKitchenReceipt", offlineMode:"offlineMode" };
      s.settings[map[id]] = e.target.checked;
    }));
  });
  $("#printerIp")?.addEventListener("input", e => { state.settings.PrinterIP = e.target.value; saveState(state); });
  $("#printerPort")?.addEventListener("input", e => { state.settings.PrinterPort = e.target.value; saveState(state); });
  $("#staffDiscountPercent")?.addEventListener("input", e => { state.settings.StaffDiscountPercent = e.target.value; saveState(state); });
  $("#printerTest")?.addEventListener("click", () => window.print());
  $("#backupNow")?.addEventListener("click", () => downloadText(`nook-pos-backup-${businessDate()}.json`, exportBackup(state)));
  $("#restoreNow")?.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/json";
    input.onchange = async () => {
      const text = await input.files[0].text();
      state = importBackup(text);
      saveState(state);
      render();
      toast("Backup restored");
    };
    input.click();
  });
  $("#clearLocal")?.addEventListener("click", () => {
    if (!confirm("Clear local app data on this browser?")) return;
    state = hardResetLocalState();
    saveState(state);
    render();
  });
}

async function loadBootstrap() {
  try {
    const res = await getBootstrap(state);
    setState(s => {
      s.db.categories = res.categories || s.db.categories;
      s.db.menu = res.menu || s.db.menu;
      s.db.prompts = res.prompts || s.db.prompts;
      s.db.promptOptions = res.promptOptions || s.db.promptOptions;
      s.db.modifiers = res.modifiers || s.db.modifiers;
      s.db.staff = res.staff || s.db.staff;
      s.settings = { ...s.settings, ...(res.settings || {}) };
      s.lastRead = "OK";
    });
    toast("Loaded menu/admin data from database");
  } catch (err) {
    toast(err.message);
  }
}

function renderSync() {
  return `
    <section class="card">
      <div class="section-head"><h2>Sync</h2><p>Queue, read/write status and error log.</p></div>
      <div class="toolbar"><button id="runSyncNow">Run sync now</button><button id="clearSyncLog">Clear log</button></div>
      <h3>Queue (${state.syncQueue.length})</h3>
      <div class="list">${state.syncQueue.map(q => `<div class="row-card"><b>${escapeHtml(q.Action)}</b><span>${escapeHtml(q.CreatedAt)} • attempts ${escapeHtml(q.Attempts)} • ${escapeHtml(q.LastError)}</span></div>`).join("") || "<div class='empty'>Queue empty.</div>"}</div>
      <h3>Log</h3>
      <div class="sync-log">${state.syncLog.map(l => `<div class="${escapeHtml(l.Status)}"><b>${escapeHtml(l.CreatedAt)} ${escapeHtml(l.Status)}</b> ${escapeHtml(l.Action)} — ${escapeHtml(l.Message)}</div>`).join("")}</div>
    </section>
  `;
}

function renderMenuPrint() {
  const cats = activeCategories();
  return `
    <section class="card printable-menu">
      <div class="section-head"><h2>Menu Print</h2><p>Live menu generated from active POS items.</p></div>
      <div class="toolbar"><button onclick="window.print()">Print / save PDF</button></div>
      <div class="menu-print-sheet">
        <h1>THE NOOK</h1>
        ${cats.map(cat => {
          const items = visibleMenu().filter(i => i.CategoryName === cat.CategoryName);
          if (!items.length) return "";
          return `<h2>${escapeHtml(cat.CategoryName)}</h2>${items.map(i => `<div class="print-row"><b>${escapeHtml(i.ItemName)}</b><span>${money(i.Price)}</span><small>${escapeHtml(i.Description || "")}</small></div>`).join("")}`;
        }).join("")}
      </div>
    </section>
  `;
}

function renderStock() {
  return `
    <section class="card">
      <div class="section-head"><h2>Stock</h2><p>Simple stock list ready for later stock movements. No stock control is forced into the till flow.</p></div>
      <div class="toolbar"><button id="seedStock">Build stock rows from menu</button></div>
      <table><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Reorder</th></tr></thead><tbody>${(state.stockItems || []).map(x=>`<tr><td>${escapeHtml(x.ItemName)}</td><td>${escapeHtml(x.Category)}</td><td>${escapeHtml(x.CurrentQty || 0)}</td><td>${escapeHtml(x.ReorderLevel || 0)}</td></tr>`).join("")}</tbody></table>
    </section>
  `;
}
function bindStockEvents() {
  $("#seedStock")?.addEventListener("click", () => setState(s => {
    s.stockItems = s.db.menu.map(i => ({ StockID: uid("S"), ItemID: i.ItemID, ItemName: i.ItemName, Category: i.CategoryName, Unit: "each", CurrentQty: 0, ReorderLevel: 0, CostPrice: i.CostPrice || 0, Active: true, UpdatedAt: todayISO() }));
    enqueue(s, "bulkSaveAdminData", { sheet: "Stock Items", key: "StockID", rows: s.stockItems });
  }));
}

function renderOnline() {
  return `<section class="card"><div class="section-head"><h2>Online Orders</h2><p>Holding area for future online order import.</p></div><div class="empty">No online orders loaded.</div></section>`;
}

function renderStaff() {
  return `
    <section class="card">
      <div class="section-head"><h2>Staff</h2><p>Default admin PIN is 0000. Staff rows save to the Staff sheet.</p></div>
      <button id="addStaff">Add staff</button>
      <div class="admin-list">${state.db.staff.map(st => `<div class="row-card"><b>${escapeHtml(st.StaffName)}</b><span>${escapeHtml(st.Role)} • PIN ${escapeHtml(st.PIN)} • ${asBool(st.Active) ? "active" : "inactive"}</span></div>`).join("")}</div>
    </section>
  `;
}
function bindStaffEvents() {
  $("#addStaff")?.addEventListener("click", () => {
    const name = prompt("Staff name");
    if (!name) return;
    setState(s => {
      const row = { StaffID: uid("S"), StaffName: name, PIN: "0000", Role: "staff", Active: true, CanRefund: false, CanAdmin: false, DiscountAllowed: true, UpdatedAt: todayISO() };
      s.db.staff.push(row);
      enqueue(s, "saveAdminData", { sheet: "Staff", key: "StaffID", row });
    });
  });
}

function bindSyncPanel() {
  $("#runSyncNow")?.addEventListener("click", async () => { await processQueue(state); state = loadState(); render(); });
  $("#clearSyncLog")?.addEventListener("click", () => setState(s => s.syncLog = []));
}

function bindTabSpecificEventsOriginal() {}
function bindRefundEventsOriginal() {}

function bindScreenEventsPatch() {}

function bindSyncEventsIfNeeded() {
  if (state.activeTab === "sync") bindSyncPanel();
}

// patch the earlier tab binding by calling sync binder every render
const originalBindTabSpecificEvents = bindTabSpecificEvents;
bindTabSpecificEvents = function () {
  originalBindTabSpecificEvents();
  bindSyncEventsIfNeeded();
};

function startSyncLoop() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(async () => {
    await processQueue(state);
    state = loadState();
    const bar = $("#syncStatus");
    if (bar) {
      bar.textContent = syncStatusText(state);
      bar.className = `sync-bar ${state.syncQueue.length ? "warn" : "ok"}`;
    }
  }, 10000);
}

render();
startSyncLoop();

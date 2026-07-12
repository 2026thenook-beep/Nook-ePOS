const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function makeSheet(name, rows) {
  return {
    name,
    rows: rows.map(r => r.slice()),
    frozen: 0,
    getLastRow() {
      for (let r = this.rows.length - 1; r >= 0; r--) {
        if ((this.rows[r] || []).some(v => v !== '' && v != null)) return r + 1;
      }
      return 0;
    },
    getLastColumn() {
      let max = 0;
      this.rows.forEach(row => row.forEach((v, i) => { if (v !== '' && v != null && i + 1 > max) max = i + 1; }));
      return max;
    },
    setFrozenRows(n) { this.frozen = n; },
    getRange(row, col, numRows = 1, numCols = 1) {
      const sheet = this;
      return {
        getValues() {
          const out = [];
          for (let r = 0; r < numRows; r++) {
            const arr = [];
            for (let c = 0; c < numCols; c++) {
              arr.push(((sheet.rows[row - 1 + r] || [])[col - 1 + c]) ?? '');
            }
            out.push(arr);
          }
          return out;
        },
        setValues(values) {
          for (let r = 0; r < values.length; r++) {
            const rr = row - 1 + r;
            sheet.rows[rr] = sheet.rows[rr] || [];
            for (let c = 0; c < values[r].length; c++) {
              sheet.rows[rr][col - 1 + c] = values[r][c];
            }
          }
        },
        setValue(value) {
          sheet.rows[row - 1] = sheet.rows[row - 1] || [];
          sheet.rows[row - 1][col - 1] = value;
        }
      };
    },
    appendRow(row) { this.rows.push(row.slice()); },
    deleteRow(row) { this.rows.splice(row - 1, 1); }
  };
}

const ss = {
  id: 'fake-db',
  name: 'Fake Nook DB',
  url: 'https://fake',
  sheets: {},
  getSheetByName(name) { return this.sheets[name] || null; },
  insertSheet(name) { const sh = makeSheet(name, []); this.sheets[name] = sh; return sh; },
  getId() { return this.id; },
  getName() { return this.name; },
  getUrl() { return this.url; }
};

ss.sheets.Metadata = makeSheet('Metadata', [['Key', 'Value'], ['AppName', 'The Nook ePOS'], ['BackendVersion', '1.0.3'], ['DatabaseVersion', '1.0.3'], ['NextTicketNumber', '77']]);
ss.sheets.Settings = makeSheet('Settings', [['Key', 'Value']]);
ss.sheets.Categories = makeSheet('Categories', [['CategoryID', 'CategoryName', 'Sort', 'Active', 'ButtonColour'], ['C1', 'Coffee', 1, true, '']]);
ss.sheets.Tickets = makeSheet('Tickets', [['TicketID', 'TicketNumber', 'CreatedAt', 'OrderType', 'ServerName', 'TableNumber', 'CustomerName', 'Subtotal', 'AddOnTotal', 'DiscountTotal', 'Total', 'PaymentMethod', 'CashTendered', 'ChangeDue', 'Status', 'ClientRequestID'], ['T1', 77, '2026-07-04', 'Takeaway', '', '', '', 3, 0, 0, 3, 'Card', '', 0, 'PAID', 'REQ1']]);
ss.sheets.TicketItems = makeSheet('TicketItems', [['TicketItemID', 'TicketID', 'ItemID', 'ItemName', 'CategoryID', 'Quantity', 'BasePrice', 'AddOnTotal', 'LineTotal', 'Note', 'Status'], ['TI1', 'T1', 'I1', 'Latte', 'C1', 1, 3, 0, 3, '', 'OPEN']]);
ss.sheets.MenuItems = makeSheet('MenuItems', [['ItemID', 'CategoryID', 'CategoryName', 'ItemName', 'Description', 'Price', 'Active', 'Sort', 'LoyaltyEligible'], ['I_DEL', 'C1', 'Coffee', 'Delete me', '', 1.5, true, 1, false]]);
ss.sheets.Prompts = makeSheet('Prompts', [['PromptID', 'TriggerItemID', 'PromptTitle', 'PromptType', 'Required', 'Sort', 'Active', 'AllowNotes'], ['P_DEL', 'I_DEL', 'Choice', 'single', false, 1, true, false]]);
ss.sheets.PromptOptions = makeSheet('PromptOptions', [['OptionID', 'PromptID', 'OptionText', 'Action', 'Value', 'Price', 'Sort', 'Active', 'AllowValue'], ['O_DEL', 'P_DEL', 'Option', 'Modifier', '', 0.5, 1, true, false]]);

const props = {};
const context = {
  console,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ss,
    openById: () => ss,
    create: () => ss
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: key => props[key] || '',
      setProperty: (key, value) => { props[key] = value; },
      deleteProperty: key => { delete props[key]; }
    })
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { getUuid: () => '11111111-2222-3333-4444-555555555555' },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync('google/Code.gs', 'utf8'), context);
const result = context.repairDatabase_({ seedIfEmpty: false });

assert.strictEqual(result.ok, true);
assert.strictEqual(result.status.ok, true);
assert(ss.sheets.Categories.rows[0].includes('IsDrinkCategory'), 'Categories should gain IsDrinkCategory');
assert(ss.sheets.Tickets.rows[0].includes('LoyaltyTotal'), 'Tickets should gain LoyaltyTotal');
assert(ss.sheets.TicketItems.rows[0].includes('LoyaltyRedeemed'), 'TicketItems should gain LoyaltyRedeemed');
assert(ss.sheets.TicketItems.rows[0].includes('LoyaltyDiscount'), 'TicketItems should gain LoyaltyDiscount');
assert.strictEqual(ss.sheets.Categories.rows[1][0], 'C1', 'existing category row must remain');
assert.strictEqual(ss.sheets.Tickets.rows[1][0], 'T1', 'existing ticket row must remain');
assert.strictEqual(context.getMeta_('NextTicketNumber'), '77', 'existing ticket number counter must remain');
assert.strictEqual(context.getMeta_('DatabaseVersion'), '1.0.6', 'database metadata should be upgraded');
assert.strictEqual(context.getSetting_('StaffDiscountPercent'), '10', 'missing setting should be defaulted');
assert(ss.sheets.AuditLog, 'missing sheets should be created');
assert(ss.sheets.DeletedItems, 'DeletedItems sheet should be created');
assert.strictEqual(context.getSetting_('LastConfirmedScriptUrl'), '', 'confirmed URL setting should be created empty');
const urlResult = context.saveConfirmedUrl_({ url: 'https://script.google.com/macros/s/abc123/exec', frontendVersion: '1.0.7', backendVersion: '1.0.7', databaseVersion: '1.0.6' });
assert.strictEqual(urlResult.ok, true);
assert.strictEqual(context.getSetting_('LastConfirmedScriptUrl'), 'https://script.google.com/macros/s/abc123/exec');
const deleteResult = context.archiveDeleteEntity_('MenuItem', 'I_DEL', 'tester', 'test delete');
assert.strictEqual(deleteResult.ok, true);
assert.strictEqual(deleteResult.deletedRecords.length, 3, 'item archive-delete should cascade item prompt and option');
assert.strictEqual(context.rowsToObjects_('MenuItems').some(x => x.ItemID === 'I_DEL'), false, 'deleted item should be removed from MenuItems');
assert.strictEqual(context.rowsToObjects_('Prompts').some(x => x.PromptID === 'P_DEL'), false, 'deleted item prompt should be removed from Prompts');
assert.strictEqual(context.rowsToObjects_('PromptOptions').some(x => x.OptionID === 'O_DEL'), false, 'deleted item option should be removed from PromptOptions');
assert.strictEqual(context.rowsToObjects_('DeletedItems').length, 3, 'deleted item cascade should be archived in DeletedItems');

console.log('Database repair mock tests passed');

**Current release: 3.2.0**

# The Nook ePOS Browser 3.0.0

Engineering-foundation release based on the approved 1.3.7 functionality.

## Deploy

1. Upload `index.html`, `css/` and `js/` to the same web host used by the POS.
2. Replace the Apps Script project code with `google/Code.gs`.
3. In Apps Script choose **Deploy → Manage deployments → Edit → New version → Deploy**.
4. Open the frontend and use **Settings → Save script URL**, then confirm the status shows:
   - Frontend 3.0.0
   - Backend 3.0.0
   - Database 1.0.6
5. Hard-refresh all POS devices after deployment.

## Architecture

- `js/release.js`: browser release metadata.
- `js/config.js`: deployment/runtime configuration.
- `js/core.js`: pure POS calculations and ticket construction.
- `js/foundation.js`: shared API transport, UI busy/modal service and compatibility helpers.
- `js/app.js`: screen rendering and workflow orchestration.
- `google/Code.gs`: Google Sheets persistence and server actions.
- `build-info.json`: packaging/version manifest.
- `scripts/verify-release.js`: pre-release version verification.
- `tests/`: regression suite.

No database migration is required from 1.3.7.


## 3.0.0 Kitchen ticket improvements
- Added **Complete both** to close food and drinks together from one kitchen ticket.
- Every configured/additional item now shows an explicit quantity, including ×1, on Till tickets, saved receipt screens, held orders, Kitchen Ticket Display and emailed HTML/plain-text receipts.
- Kitchen configured items use larger, heavier text for faster reading.

## 3.0.0 Prompt option drag-and-drop

Prompt options can be dragged into their required order using the handle at the start of each row. Changes remain queued until **Save option changes** is selected. The app then reloads the saved prompt data from Google Sheets and displays the confirmed order.

## 3.0.0 Prompt option final-order saving

- Prompt option rows now show clear headings: Position, Name, Price, Type, Quantity, and Status / action.
- Raw Sort values are hidden because they are internal database data.
- Dragging changes only the final visual sequence.
- Selecting Save option changes sends one atomic batch to Apps Script.
- Apps Script assigns clean sequential sort positions and reloads the saved data.

## 3.0.0 Variable quantities and kitchen completion

- Variable-quantity prompt options use only the touch-friendly minus/value/plus control; there is no redundant tick box.
- Standard options do not display an unnecessary ×1 marker.
- Kitchen completion stamps immediately and no longer disappears then reappears after the Google Sheets response.

## 3.0.0 version authority and patch merge

`build-info.json` is now the release authority. Run `node scripts/sync-release.js` before verification and packaging, then run `node scripts/verify-release.js`. Settings displays the expected and reported versions for the browser, Apps Script and database separately.


## 3.3.0 Menu Admin workflow
The selected menu item now has one sticky Save Configuration action covering item details, prompts and options. It is enabled only when the normalised working configuration differs from the last authoritative snapshot. Navigation is protected by Save, Discard or Stay choices. Categories remain separately saved because they are shared records.


## 3.8.1 focused screen refresh
Reports and Ticket History now reset to today when opened and fetch only the transaction data required for that screen.


## Apps Script maintenance tools (3.8.1)

The `google/Code.gs` file contains permanently visible manual functions: `authoriseEmailService`, `sendTestEmailToScriptOwner`, `runSystemDiagnostics`, `repairSpreadsheet`, `setupOrRepairDatabase`, and `verifyDatabaseConnection`.


## Database repair safety (3.8.4)

Application startup and server-info checks are read-only. They preview schema differences but never alter the spreadsheet. Use **Settings → Database maintenance → Preview required changes** first, then **Apply additive repair** and confirm. The repair only creates missing sheets, appends missing columns, creates absent settings/default metadata, and updates version metadata. Existing rows and configured values are retained. The Apps Script function `previewSpreadsheetRepair` provides the same no-write preview from the script editor.

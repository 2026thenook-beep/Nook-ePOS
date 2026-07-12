# Deployment steps

## 1. Create the Google Sheets database

1. Open Google Drive.
2. Upload `database/Nook_POS_Database_Template_1_8_8.xlsx`.
3. Open it with Google Sheets.
4. Keep the tab names exactly as supplied.

## 2. Add the backend

1. In the Google Sheet, open **Extensions → Apps Script**.
2. Delete any starter code.
3. Paste the full contents of `google/Code.gs`.
4. Save the Apps Script project.
5. Run `setupDatabase_` once from Apps Script and approve permissions.
6. Deploy as a **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone with the link** or your preferred restricted setting
7. Copy the `/exec` Web App URL.

## 3. Connect the browser app

1. Open the POS frontend.
2. Go to **Settings**.
3. Paste the Apps Script Web App URL.
4. Press **Save URL**.
5. Press **Test URL**.
6. Press **Database builder / repairer**.
7. Press **Load menu from database**.

## 4. Host the frontend

For the easiest browser/iPad setup, upload the folder contents to Netlify or another static host.

Minimum files required on the frontend host:

- `index.html`
- `css/app.css`
- `js/`

## 5. Device use

- Use the same frontend URL on each iPad/device.
- Use the same Apps Script URL in Settings.
- The browser stores a local queue and syncs when online.
- Settings → Offline mode pauses sync and keeps orders local until turned off.

## 6. Testing checklist before live use

1. Load menu from database.
2. Create a small cash ticket.
3. Confirm it appears in Ticket History.
4. Confirm it appears on Kitchen.
5. Complete food/drink on Kitchen.
6. Create a refund from Ticket History.
7. Check Reports for totals and refund deduction.
8. Hold an order and reload it.
9. Edit a menu item in Admin and confirm it queues/syncs.
10. Export a backup from Settings.

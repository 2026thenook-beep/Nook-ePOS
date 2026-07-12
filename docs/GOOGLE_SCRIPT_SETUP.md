# Google Apps Script setup - The Nook ePOS 1.1.5

1. Open the live Google Sheet database.
2. Go to Extensions > Apps Script.
3. Replace the existing script with the full contents of `google/Code.gs`.
4. Save.
5. Run `setupDatabase()` once.
6. Approve permissions.
7. Deploy > New deployment > Web app.
8. Execute as: Me.
9. Access: choose the safest option that still lets your iPads reach the script.
10. Copy the Web App URL ending `/exec`.
11. Put the `/exec` URL into the app Settings screen or into `js/config.js` before upload.
12. In Settings, press **Repair / update spreadsheet** and then **Test / reload from server**.

Do not use the `/dev` Apps Script URL for the iPads.

After the server test succeeds, the app stores the confirmed `/exec` URL and version in the Settings sheet. The database repair also creates the `DeletedItems` tab used for archived menu/prompt/option deletions.

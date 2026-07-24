# Test notes - The Nook ePOS 1.1.8

Checked in this build:

- `js/app.js` syntax check passed.
- `js/core.js` syntax check passed.
- `js/config.js` syntax check passed.
- `google/Code.gs` syntax check passed using a Node VM wrapper for Apps Script globals.
- Core payment/discount/loyalty tests passed.
- Backend loyalty static tests passed.
- Database repair static and mock tests passed.
- App static test confirmed:
  - payment customer prompt exists before commit;
  - confirmed customer name/table number are written into ticket metadata before the payload is built;
  - customer name and table number clear only after confirmed save;
  - admin inactive items/prompts have the NOT ACTIVE sticker and inactive CSS classes;
  - Settings contains the shared confirmed URL save/copy controls;
  - Menu Admin delete buttons call archive-delete rather than deactivate;
  - `DeletedItems` schema repair, confirmed URL saving, and cascade archive-delete were tested in the mock database.

Live Google Apps Script deployment still needs to be tested on the user's own Google Sheet because the actual Web App URL is private to that deployment.

## Consolidated lock and routing checks

- Confirmed `bootstrap` is no longer routed through `withLock_`.
- Confirmed `serverInfo` is no longer routed through `withLock_`.
- Confirmed writes, including `commitTicket`, still use write locks.
- Confirmed read-time repair uses a short non-blocking `tryLock(750)`.
- Lock routing static tests passed.


## Kitchen auto-refresh checks

- Kitchen tab polls the lightweight `kitchenSnapshot` endpoint every 3 seconds.
- Tickets created on another device appear without a manual page refresh.
- Polling runs only while the Kitchen tab is active and the browser page is visible.
- Kitchen reads do not request a write lock.
- Queue signatures prevent unnecessary kitchen rerenders when nothing changed.

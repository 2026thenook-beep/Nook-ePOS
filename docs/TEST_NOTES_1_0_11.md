# Test notes — 1.0.11

Verified:
- UI version is read from `js/config.js` and displays 1.0.11.
- Frontend and Apps Script backend both report 1.0.11.
- Reports can be exported as CSV for the selected From/To dates.
- Clearing report data requires both passwords 01287 and 01827.
- Clear reports removes Tickets, TicketItems, TicketAddOns, Refunds and KitchenQueue rows and resets NextTicketNumber to 0.
- Menu categories, items, prompts, options and deleted items refresh from Google Sheets every five seconds on connected visible devices.
- Existing regression tests pass.

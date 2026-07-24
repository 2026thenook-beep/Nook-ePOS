# 3.0.0 — Full architecture consolidation

## Purpose

This release merges the accumulated 1.x and 2.x implementation into a single maintainable foundation without changing the established till workflow.

## Consolidated

- Canonical application and database collection model in `js/models.js`.
- One modifier quantity rule shared by Till, Held Orders, receipts and Kitchen.
- One shared modifier renderer and HTML escaping layer in `js/presentation.js`.
- One poll coordinator for menu and Kitchen refreshes in `js/operations.js`.
- Existing calculations remain centralised in `js/core.js`.
- Existing API, UI and release compatibility services remain centralised in `js/foundation.js`.
- `app.js` is now the screen/controller layer rather than the owner of duplicated cross-screen rules.

## Preserved behaviour

- Variable-quantity prompt options use quantity controls rather than checkboxes.
- Kitchen completion stamp is immediate and does not reappear after server polling.
- Drag-and-drop prompt option ordering and authoritative reload remain in place.
- Refunds, reporting, held orders, email receipts, loyalty and staff discount behaviour remain compatible with 2.1.0.

## Versions

- Browser: 3.0.0
- Apps Script: 3.0.0
- Database schema: 1.0.6

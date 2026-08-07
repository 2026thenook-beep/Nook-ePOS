# The Nook ePOS 3.13.22 — Till Modifier Controls and Admin Layout Entry

Release reference: `NOOK-TILL-CONTROLS-ADMIN-LAYOUT-3.13.22`

- Frontend: **3.13.22**
- Compatible Apps Script backends: **3.13.16 / 3.13.17 / 3.13.18**
- Included Apps Script source: **3.13.18 (unchanged)**
- Database: **1.0.6 (unchanged)**

## What changed

- Apply Loyalty and Staff Discount remain together immediately above the Till totals/payment controls.
- Their container can no longer clip the buttons on short iPad viewports; both controls own a full, equal-width cell and remain visible.
- The permanent `Edit menu layout` button has been removed from the normal selling screen.
- Menu Admin now contains `Edit Till layout`. Selecting it opens the Till directly in layout-edit mode, preserving the existing Cancel/Save layout workflow.
- Unsaved Menu Admin edits are still guarded before entering Till layout edit mode.
- A live basket must be cleared or held before layout editing can start.

This is a **frontend-only release**. If the live status already reports backend 3.13.16, 3.13.17 or 3.13.18 with database 1.0.6, update the browser frontend files only. **Do not redeploy Google Apps Script for 3.13.22.**

3.13.22 retains the 3.13.21 item-card hierarchy, 3.13.20 iPad category-strip fix, 3.13.19 single-day Reports workflow, 3.13.18 local-ticket persistence/clear controls, and Kitchen wake/status reliability changes.

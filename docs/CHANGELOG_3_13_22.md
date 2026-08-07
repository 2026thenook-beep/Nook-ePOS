# The Nook ePOS 3.13.22 — Till Modifier Controls and Admin Layout Entry

Reference: `NOOK-TILL-CONTROLS-ADMIN-LAYOUT-3.13.22`

## Till modifier controls

- Removed the short-viewport max-height clipping that could partially hide Apply Loyalty and Staff Discount.
- Kept both actions in the operationally correct position immediately above totals.
- Preserved a two-column iPad layout with equal-width controls and a single-column layout only on very narrow phones.

## Till layout editor entry

- Removed the always-visible `Edit menu layout` launcher from the normal Till selling screen.
- Added `Edit Till layout` to Menu Admin.
- The new action checks for a live basket, guards unsaved Menu Admin changes, applies any safe pending menu update, moves to the Till, and opens the existing protected layout editor.
- Save/Cancel behaviour and backend position-saving logic are unchanged.

## Deployment

Frontend only. Apps Script remains 3.13.18 source-compatible with accepted live backends 3.13.16–3.13.18. Database remains 1.0.6.

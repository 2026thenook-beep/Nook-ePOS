# The Nook ePOS 3.13.22 — Test Report

Release reference: `NOOK-TILL-CONTROLS-ADMIN-LAYOUT-3.13.22`

## Result

**103 / 103 regression test files passed (120 individual tests).**

Additional release checks passed:

- `node --check` JavaScript syntax validation for the modified frontend and core runtime files.
- Release/version manifest validation.
- Dedicated 3.13.22 Till modifier-control and Menu Admin layout-entry regression coverage.
- Existing 3.13.21 Till item-card hierarchy regression coverage.
- Existing 3.13.20 iPad category-layout regression coverage.
- Existing 3.13.19 single-day Reports and export-isolation regression coverage.
- Existing Kitchen wake/status and local-ticket persistence regression coverage.
- Apps Script SHA-256 immutability check.
- Database 1.0.6 SHA-256 immutability check.

## 3.13.22 Till modifier-control coverage

The new regression verifies that:

- Apply Loyalty and Staff Discount remain together in `ticket-secondary-controls` directly above totals.
- The row remains a two-column layout on supported Till/iPad widths.
- The old short-height `max-height: 48px` clipping behaviour is explicitly overridden by the final 3.13.22 rules.
- The modifier row uses `max-height: none` and `overflow: visible` so the buttons cannot be partially hidden by their own container.
- Both buttons own the full width of their grid cell and keep a usable touch height.
- Narrow-phone behaviour can still stack the controls without imposing a clipping max-height.

## 3.13.22 Till-layout entry coverage

The new regression verifies that:

- The permanent `Edit menu layout` launcher is absent from the normal selling Till.
- Menu Admin exposes `Edit Till layout`.
- The Menu Admin action is wired to a dedicated guarded entry path.
- A live basket prevents layout editing until it is held or cleared.
- Unsaved Menu Admin changes are guarded before leaving Admin.
- Any safe pending menu update is applied before entering the layout editor.
- The action navigates to the Till and enables the existing protected layout-edit mode.
- Existing Save/Cancel and category/item position persistence remain unchanged.

## Backend/database immutability

`google/Code.gs` SHA-256:

`6895076f1cbac3dd4396c9c92c3ceb1c7739c63824982eafbf86a50d80bd8c17`

This is identical to the validated 3.13.21 backend source.

`database/Nook_ePOS_Database_Template_1_0_6.xlsx` SHA-256:

`7a11fe68eb7dc1f6b752a053bd78a6a403a2af277feb19c13a8475afd6e69dbe`

This is identical to the validated 3.13.21 database template.

## Deployment conclusion

3.13.22 is a frontend-only release. A live Apps Script backend already reporting 3.13.16, 3.13.17 or 3.13.18 on database 1.0.6 does not require redeployment.

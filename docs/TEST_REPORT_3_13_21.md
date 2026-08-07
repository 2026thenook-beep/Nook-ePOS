# The Nook ePOS 3.13.21 — Test Report

Release reference: `NOOK-TILL-ITEM-CARD-LAYOUT-3.13.21`

## Result

**102 / 102 regression test files passed (119 individual tests).**

Additional release checks passed:

- `node --check` JavaScript syntax validation.
- Apps Script syntax validation using the JavaScript parser.
- Release/version manifest validation.
- Dedicated Till item-card hierarchy regression coverage.
- Existing 3.13.20 iPad category-layout regression coverage.
- Existing 3.13.19 Reports behaviour and export-isolation regression coverage.
- Existing Kitchen wake/status and local-ticket persistence regression coverage.
- Apps Script SHA-256 immutability check.
- Database 1.0.6 SHA-256 immutability check.

## 3.13.21 Till item-card coverage

The new regression verifies that:

- Eligible items continue to display a `LOYALTY` indicator.
- The loyalty indicator is rendered before the item name and participates in normal layout flow.
- The loyalty indicator is no longer absolutely positioned over item text.
- The item name is a dedicated block row.
- The optional description is a dedicated block row immediately after the item name.
- The price remains after the descriptive copy and stays separated at the bottom of the button.
- The old anonymous inline wrapper around item name/description is no longer used.

## Backend/database immutability

`google/Code.gs` SHA-256:

`6895076f1cbac3dd4396c9c92c3ceb1c7739c63824982eafbf86a50d80bd8c17`

This is identical to the validated 3.13.20 backend source.

`database/Nook_ePOS_Database_Template_1_0_6.xlsx` SHA-256:

`7a11fe68eb7dc1f6b752a053bd78a6a403a2af277feb19c13a8475afd6e69dbe`

This is identical to the validated 3.13.20 database template.

## Deployment conclusion

3.13.21 is a frontend-only release. A live Apps Script backend already reporting 3.13.16, 3.13.17 or 3.13.18 on database 1.0.6 does not require redeployment.

# The Nook ePOS 3.13.20 — Test Report

Release reference: `NOOK-IPAD-CATEGORY-LAYOUT-3.13.20`

## Result

**101 / 101 regression test files passed (118 individual tests).**

Additional release checks passed:

- `node --check` JavaScript syntax validation.
- Apps Script syntax validation using the same JavaScript parser.
- Release/version manifest validation.
- Dedicated iPad category-layout regression coverage.
- Existing 3.13.19 Reports behaviour and export isolation regression coverage.
- Existing Kitchen wake/status and local-ticket persistence regression coverage.
- Apps Script SHA-256 immutability check against 3.13.19.
- Database 1.0.6 SHA-256 immutability check against 3.13.19.

## 3.13.20 category-layout coverage

The new regression verifies that:

- Till categories continue to render through `.layout-category-wrap`.
- Every category wrapper uses `flex: 0 0 auto`, so it cannot shrink beneath the width required by its button.
- The iPad/tablet horizontal category strip explicitly preserves non-shrinking wrappers.
- Category buttons remain horizontally scrollable at tablet widths.
- Long labels are bounded and may wrap inside the category button rather than overflowing into a neighbour.

## Backend/database immutability

`google/Code.gs` SHA-256:

`6895076f1cbac3dd4396c9c92c3ceb1c7739c63824982eafbf86a50d80bd8c17`

This is identical to the validated 3.13.19 backend source.

`database/Nook_ePOS_Database_Template_1_0_6.xlsx` SHA-256:

`7a11fe68eb7dc1f6b752a053bd78a6a403a2af277feb19c13a8475afd6e69dbe`

This is identical to the validated 3.13.19 database template.

## Deployment conclusion

3.13.20 is a frontend-only release. A live Apps Script backend already reporting 3.13.16, 3.13.17 or 3.13.18 on database 1.0.6 does not require redeployment.

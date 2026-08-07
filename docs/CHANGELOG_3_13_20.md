# The Nook ePOS 3.13.20 — iPad Till Category Layout Reliability

Reference: `NOOK-IPAD-CATEGORY-LAYOUT-3.13.20`

## Fix

- Fixed Till category buttons visually overlapping on iPad/tablet-width layouts.
- Category buttons are rendered inside layout-editor wrappers. On the horizontally scrolling tablet category strip those wrappers could shrink while the button retained its minimum width, allowing the button to overflow over the following category.
- Category wrappers now use non-shrinking flex sizing so each button owns its full layout width.
- Long category labels remain wrapped and are bounded to a sensible tablet width rather than overlapping adjacent controls.

## Deployment

Frontend-only update. No Apps Script redeployment or database migration is required when the existing backend is 3.13.16, 3.13.17 or 3.13.18 on database 1.0.6.

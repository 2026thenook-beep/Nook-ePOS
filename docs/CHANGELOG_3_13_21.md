# The Nook ePOS 3.13.21 — Till Item Card Readability

Reference: `NOOK-TILL-ITEM-CARD-LAYOUT-3.13.21`

## Fix

- Moved the Till **LOYALTY** indicator into the normal item-card layout above the item name.
- Removed absolute positioning that could place the loyalty badge over long item names on iPad/tablet widths.
- Made the item name an explicit block row.
- Made the optional item description an explicit block row directly below the item name.
- Kept the price separated at the bottom of the item button.
- Long names and descriptions may wrap inside their own card instead of colliding with neighbouring content.

## Deployment

Frontend-only update. No Apps Script redeployment or database migration is required when the existing backend is 3.13.16, 3.13.17 or 3.13.18 on database 1.0.6.

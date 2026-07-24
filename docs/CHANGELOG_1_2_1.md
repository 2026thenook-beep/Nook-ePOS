# The Nook ePOS 1.2.1

## Fixed

- Refund item-selection prompt now displays each item's category.
- Emailed HTML receipts now resolve category names from the current Categories and MenuItems sheets when older TicketItems rows contain only a CategoryID.
- Plain-text emailed receipts now include the category beneath every item.
- Missing category data falls back to `Uncategorised` rather than leaving the receipt blank.

## Compatibility

- Frontend: 1.2.1
- Backend: 1.2.1
- Database: 1.0.6
- No spreadsheet migration is required.

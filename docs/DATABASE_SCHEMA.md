# Database schema

The workbook has these tabs:

- Settings
- Categories
- Menu
- Modifiers
- Prompts
- Prompt Options
- Staff
- Held Orders
- Tickets
- Ticket Items
- Ticket AddOns
- Refunds
- Kitchen Queue
- Loyalty Customers
- Loyalty Ledger
- Stock Items
- Stock Movements
- Online Orders
- Sync Log
- Devices
- Backups
- Version

The core accounting record is split across:

- `Tickets`: one row per paid transaction
- `Ticket Items`: one row per item line
- `Ticket AddOns`: one row per selected prompt/add-on/quantity
- `Refunds`: one row per refund transaction
- `Kitchen Queue`: one row per kitchen ticket, with JSON copy for display

Do not rename the tabs unless the same names are changed in `google/Code.gs`.

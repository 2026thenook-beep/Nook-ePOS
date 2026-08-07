# The Nook ePOS 3.13.16 — NOOK-REFINE-B

Refinement release only. No new staff-facing features.

## Backend / spreadsheet efficiency
- Reports and Ticket History locate requested dates by scanning only the CreatedAt column, then read full rows only for matching tickets/refunds.
- Related TicketItems, TicketAddOns and RefundItems are located through narrow ID-column scans and targeted row reads.
- Duplicate payment recovery finds ClientRequestID with an exact targeted lookup instead of loading the full Tickets sheet.
- Kitchen completion reads Categories once and reuses an in-memory category map for the whole ticket.
- Confirmed Script URL metadata is written to Settings in one batch operation.
- Spreadsheet, sheet and header references are reused within each web-app request; caches reset at the beginning of every doGet/doPost request.
- Metadata/version reads and settings reads use fewer Spreadsheet service calls.
- Kitchen diagnostics now treats COMPLETE as the completed queue state.

## Browser cache refinement
- Last-known-good cache retains operational menu/settings/Kitchen/held-order data but excludes historical Tickets, TicketItems, TicketAddOns, Refunds and RefundItems.

## Database template continuity
- Bundled database template remains schema version 1.0.6 but is aligned with the existing 1.0.6 code schema, including RefundItems, ReceiptEmails, complete Refunds headers and required Metadata/Settings keys.

## Versions
- Frontend: 3.13.16
- Backend: 3.13.16
- Database: 1.0.6

# The Nook ePOS 3.8.1 — Permanent Maintenance Tools

- Added a clearly marked manual maintenance section in `google/Code.gs`.
- Kept `authoriseEmailService` permanently visible in the Apps Script function selector.
- Email authorisation now returns the executing account, remaining quota and timestamp.
- Added safe manual functions for test email, diagnostics, spreadsheet repair, setup/repair and database verification.
- Functions with destructive or ambiguous behaviour were deliberately excluded.

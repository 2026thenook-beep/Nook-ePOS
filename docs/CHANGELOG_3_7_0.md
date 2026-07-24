# The Nook ePOS 3.7.0 — Reports and Ticket History Smart Refresh

- Reports resets to today whenever its tab is opened.
- Ticket History resets to today whenever its tab is opened.
- Added focused read-only `reportsSnapshot` and `ticketHistorySnapshot` endpoints.
- Only transaction data needed by the selected screen is returned.
- Date/calendar changes trigger focused refreshes.
- Manual refresh and last-updated/failure status added.
- Failed refreshes retain previously visible data.
- Duplicate in-flight requests are suppressed.
- Europe/London is used for backend day boundaries.

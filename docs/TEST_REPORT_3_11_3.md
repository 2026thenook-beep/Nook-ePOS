# Test Report — 3.12.0

- 73 of 73 regression tests passed.
- JavaScript syntax validation passed for app, queue manager and request coordinator.
- Release manifest verified at 3.12.0 across frontend, backend and cache-busting assets.
- Newly completed local-first payments can queue receipt email before a Google Sheets ticket exists.
- Receipt email waits for the matching ClientRequestID transaction to synchronise, then uses the confirmed server TicketID.
- Payment Complete actions are positioned at the top and Print Receipt remains conditional on Settings.
- Reports and Ticket History show focused loading overlays and suppress duplicate concurrent refreshes.
- Kitchen revision polling and anti-blank-screen render containment remain covered by regression tests.

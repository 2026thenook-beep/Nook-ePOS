# 3.12.0 — Payment Receipt and Focused Refresh Workflow Polish

- Email receipts from Payment Complete are queued by local transaction request ID and wait for server ticket synchronisation.
- Removed the early “Ticket not found” failure for newly completed local-first payments.
- Moved Print Receipt, Email Receipt and Close controls to the top of Payment Complete.
- Print Receipt remains completely hidden unless enabled in Settings.
- Added modal loading overlays when Reports and Ticket History are opened or manually refreshed.
- Duplicate focused refresh requests remain blocked while an existing refresh is active.
- Retained Kitchen revision polling, request coordination and protected anti-blank-screen rendering.

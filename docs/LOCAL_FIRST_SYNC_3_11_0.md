# 3.11.0 Local-First Queue

- Every Cash/Card payment is durably stored in IndexedDB before the basket clears.
- Google Sheets is no longer on the cashier critical path.
- Four initial connection attempts are made at startup, followed by continuing retries.
- Transaction upload and Kitchen polling are independent jobs; Kitchen polling runs every 1.5 seconds while its screen is active.
- ClientRequestID provides idempotent server writes and duplicate protection.
- Sync status is shown in the persistent status bar, not in the payment workflow.
- Menu Admin writes remain online-only.

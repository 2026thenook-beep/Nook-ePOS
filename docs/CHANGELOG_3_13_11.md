# 3.13.11 — Browser Resume Recovery Fix

- Replaced interval-dependent wake tick with deterministic wake recovery.
- Debounced visibilitychange/pageshow/focus events.
- Added 12-second wake lifecycle watchdog.
- Removed duplicate immediate Kitchen refresh on visibility return.
- Preserved current Till DOM, basket, offline payments, adaptive Kitchen polling and durable queues.
- Backend compatibility remains 3.13.5; database remains 1.0.6.

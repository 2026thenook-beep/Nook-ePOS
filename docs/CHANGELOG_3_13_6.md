# The Nook ePOS 3.13.6 — Offline Payment Safety Fix

Built directly from 3.13.5.

- PAY no longer depends on live Apps Script connectivity.
- Before payment opens, the device verifies IndexedDB/local storage is writable.
- HTTP 404, timeout, offline and server-retry states keep PAY available when local storage is safe.
- Transactions remain local-first and continue synchronising automatically.
- Payment is blocked only when the basket is empty, payment is already active, the device has no configured server identity, or durable local storage cannot be verified.
- No 3.14.0 diagnostics or 3.14.1 request-lifecycle changes are included.

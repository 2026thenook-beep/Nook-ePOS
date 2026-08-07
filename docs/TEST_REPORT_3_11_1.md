# Test Report — 3.11.1

- 71/71 Node regression tests passed.
- JavaScript syntax checks passed for app.js, queue-manager.js and server-coordinator.js.
- All app server calls route through ServerCoordinator.request().
- Write, Kitchen, general-read and background lanes verified.
- Durable receipt-email outbox verified.
- Print Receipt conditional visibility verified.
- Frontend and Apps Script versions verified as 3.11.1.
- Rollback release: 3.11.0.

# The Nook ePOS 3.0.0 architecture

Version 3.0.0 is a consolidation release. It preserves the 2.1.0 user workflow while moving cross-screen behaviour into shared modules.

## Shared modules

- `core.js`: money, totals, cart lines, payment validation and ticket payloads.
- `models.js`: canonical database collections, data normalisation, ticket bundles and modifier quantity semantics.
- `presentation.js`: HTML escaping, sorting and the single modifier renderer used by Till and Kitchen.
- `operations.js`: serial operation queues and coordinated polling primitives.
- `foundation.js`: browser storage, API transport, UI overlays and release compatibility.
- `app.js`: screen orchestration and event handling only.

## Rules

1. Ticket, item and modifier calculations belong in `core.js`.
2. Collection defaults and record relationships belong in `models.js`.
3. Display wording and HTML fragments shared by screens belong in `presentation.js`.
4. Network transport belongs in `foundation.js`.
5. Polling and queued operations belong in `operations.js`.
6. New screens consume these modules rather than reimplementing their behaviour.

## Compatibility

- Application: 3.0.0
- Apps Script: 3.0.0
- Database schema: 1.0.6
- Behavioural compatibility: 2.1.0

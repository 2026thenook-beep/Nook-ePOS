# Patch Merge Due Diligence — 3.10.0

Reference: `NOOK-PATCH-MERGE-3.10.0-R01`

## Baseline

- Source and rollback reference: 3.9.11.
- Baseline suite before merge: 66/66 passing.
- No duplicate named function declarations were found within any individual JavaScript source file.

## Static review

Checked for:

- obsolete Till Cash/Card buttons and Mixed payment controls;
- duplicate named functions within source files;
- direct post-payment order-type modal invocation;
- repeated Kitchen polling declarations;
- frontend/backend/build version mismatch;
- duplicate asset script loading;
- blocking Kitchen operation dialogs;
- retained strict payment persistence and failed-save basket protection.

## Consolidation action

- Routed the post-payment order-type request through `scheduleOrderTypePrompt()`.
- Retained a single delegated click handler for payment, order type and modal actions.
- Retained one Kitchen age interval and the existing focused Kitchen polling manager.
- Updated the frontend, backend, manifest and cache-busting references to 3.10.0.
- Added 3.10.0 consolidation regression checks.

## Explicitly deferred

The universal loading/confirmation dialog and Deleted Items archive clearing controls are not included. They remain separate UI work so this foundation can be evaluated without introducing a new feature set.

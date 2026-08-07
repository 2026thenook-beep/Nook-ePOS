# The Nook ePOS 3.13.17 — Test Report

Reference: `NOOK-KDS-WAKE-3.13.17`

## Baseline
- Source: uploaded 3.13.16 `NOOK-REFINE-B-3.13.16` release package.
- Baseline release manifest verification: PASS.
- Baseline regression test files: 92/92 PASS before 3.13.17 changes.

## 3.13.17 validation
- Release/version manifest script: PASS.
- Combined Node regression runner: **106 tests passed, 0 failed**.
- JavaScript syntax check for application, tests and release scripts: PASS.
- Apps Script `Code.gs` JavaScript syntax check: PASS.
- Targeted Kitchen wake/background tests: PASS.
- Read-generation invalidation and cancellation test: PASS.
- Active write survives read invalidation test: PASS.
- Existing blank-screen/wake containment tests: PASS.
- Existing payment, refunds, local ticket, Menu Admin, Reports, Ticket History, Kitchen completion and persistence regression tests: PASS.

## Database continuity
The bundled database template remains version **1.0.6** and is byte-for-byte unchanged from 3.13.16.

SHA-256:
`7a11fe68eb7dc1f6b752a053bd78a6a403a2af277feb19c13a8475afd6e69dbe`

## Scope confirmation
3.13.17 changes browser/server-coordinator wake handling only, plus release version metadata. It does not add or alter database columns, payment workflow, ticket format, refund workflow, report calculations, menu configuration format, or Kitchen completion writes.

## Live-environment note
Automated tests validate the packaged code and simulated request lifecycle. A real iPad/Safari + deployed Google Apps Script sleep/wake cycle requires the release to be deployed in the live/test environment; no live deployment URL or device session was available inside the build environment.

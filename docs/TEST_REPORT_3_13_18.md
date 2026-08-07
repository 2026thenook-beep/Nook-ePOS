# The Nook ePOS 3.13.18 — Test Report

Reference: `NOOK-LOCAL-TICKET-KDS-STATUS-3.13.18`

## Baseline
- Source: validated 3.13.17 `NOOK-KDS-WAKE-3.13.17` release package.
- Changes were applied directly to that release tree.

## 3.13.18 validation
- Release/version manifest script: PASS.
- Combined Node regression runner: **112 tests passed, 0 failed**.
- Targeted persistent local-ticket removal checks: PASS.
- Local-only clear-all checks: PASS.
- Unsynchronised-ticket destructive-warning checks: PASS.
- Local-ticket sync generation/race protection checks: PASS.
- Queue-manager fallback persistence simulation: PASS.
- 48-hour confirmed-local-ticket retention regression: PASS.
- Kitchen unchanged-response fault-clear regression: PASS.
- Kitchen silent-success status repaint regression: PASS.
- Existing Kitchen sleep/wake and stale-read protection tests: PASS.
- Existing payment, refunds, Menu Admin, Reports, Ticket History, Kitchen completion and persistence regression tests: PASS.

## Database continuity
The bundled database template remains version **1.0.6** and is byte-for-byte unchanged from 3.13.17.

SHA-256:
`7a11fe68eb7dc1f6b752a053bd78a6a403a2af277feb19c13a8475afd6e69dbe`

## Scope confirmation
The local ticket clear/removal code uses browser storage only. It contains no call to `api(...)`, `commitTicket`, `deleteTicket` or `clearReports`. Live Google Sheets ticket history is not deleted by these actions.


## Apps Script compatibility
A line-by-line comparison confirmed that `google/Code.gs` in 3.13.16, 3.13.17 and 3.13.18 is functionally identical; only the reported version strings differ. This frontend therefore explicitly accepts backend versions **3.13.16, 3.13.17 and 3.13.18** with database **1.0.6**. No Apps Script redeployment is required when the currently deployed backend is already 3.13.16 or 3.13.17. A 3.13.15 backend is not included in this compatibility allowance because 3.13.16 contained genuine backend efficiency changes.

## Live-environment note
Automated tests validate the packaged code and local storage/request lifecycle. Physical iPad/Safari reload and sleep/wake behaviour should still be verified after deployment against the live/test Apps Script endpoint.

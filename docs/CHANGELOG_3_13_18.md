# The Nook ePOS 3.13.18 — NOOK-LOCAL-TICKET-KDS-STATUS

Maintenance release based directly on 3.13.17.

## Device Local Tickets
- Fixes **Remove from device** so a confirmed local ticket is removed from both IndexedDB ticket stores instead of only the localStorage mirror.
- Removed local tickets therefore no longer return after browser reload.
- Adds **Clear local tickets** to clear the local paid-ticket stores without deleting or clearing server-side ticket history.
- Adds an additional destructive confirmation whenever unsynchronised tickets are present.
- Keeps the receipt-email outbox separate from the local-ticket clear action.
- Adds local-ticket store generation protection so a pre-clear sync cycle cannot resurrect a cleared record.
- 48-hour automatic retention remains limited to server-confirmed local copies.

## Kitchen status bar
- A successful `unchanged` Kitchen snapshot now clears the stored `kitchen` sync fault.
- Successful silent Kitchen reads repaint the status bar, allowing a recovered error to visibly return to `System OK` when no other fault remains.
- Genuine remaining subsystem faults continue to block `System OK`.

## Compatibility
- Frontend: 3.13.18
- Backend: 3.13.18
- Database: 1.0.6
- Rollback: 3.13.17

No database schema change.

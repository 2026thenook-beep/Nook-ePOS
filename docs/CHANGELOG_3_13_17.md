# The Nook ePOS 3.13.17 — NOOK-KDS-WAKE

Tightly scoped Kitchen Display background/wake reliability refinement.

## Kitchen hidden/background behaviour
- Kitchen polling stops completely while `document.visibilityState === 'hidden'`; the former 15-second hidden Kitchen poll is removed.
- Moving to the background invalidates the application read generation and the server coordinator read generation.
- Active read requests are cancellation-signalled where supported; queued old-generation reads are rejected as stale. Writes are not paused or cancelled.

## Kitchen wake behaviour
- Stale pre-sleep Kitchen in-flight state is invalidated with a Kitchen poll epoch so an old request cannot block or later clear a new foreground request.
- Returning to the foreground while Kitchen is active schedules wake recovery immediately (0 ms) rather than waiting for the normal 750 ms wake delay.
- Kitchen performs its snapshot refresh before the generic connection check, so the live Kitchen queue is the first operational read on wake.
- Old-generation responses remain protected from updating the current screen.

## Compatibility
- Frontend: 3.13.17
- Backend: 3.13.17
- Database: 1.0.6
- Rollback: 3.13.16

No database schema change and no staff workflow change.

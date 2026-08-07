# 3.8.7 — Guarded Live Synchronisation Manager

- One manager now owns Kitchen, Till-live, menu-version and Ticket History background reads.
- Added a focused Till live snapshot for held orders and the next ticket number.
- Till polling never redraws the active sale, basket, prompt or payment screen.
- Kitchen polling remains focused and retains the last confirmed queue on failure.
- Menu synchronisation no longer performs a broad redraw of Kitchen and avoids interrupting active Till modals/payments.
- Live writes remain immediate and outside the background read manager.

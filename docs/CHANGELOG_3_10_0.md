# The Nook ePOS 3.10.0 — Consolidated Foundation

Reference: `NOOK-PATCH-MERGE-3.10.0-R01`

## Purpose

This release consolidates the verified 3.9.4–3.9.11 work into one authoritative frontend/backend release. It deliberately avoids new operational features.

## Consolidated authorities

- One PAY workflow: Cash or Card only.
- One cash tender controller: keypad, exact amount, £10–£50 shortcuts, Still to Pay, Exact Payment and Change.
- One card confirmation presentation with the primary CARD PAYMENT amount panel.
- One guarded Eat in/Takeaway scheduler for Till load, return-to-Till, first item and post-payment prompting.
- One verified Menu Admin configuration save path with database read-back.
- One resilient Kitchen completion/reopen path with non-blocking inline retry state.
- One fast operational bootstrap; reports, history and refunds remain on-demand.
- One release authority shared by frontend, backend, cache-busting assets and build manifest.

## Merge correction

The post-payment Eat in/Takeaway prompt no longer calls the modal directly. It now passes through the same guarded scheduler as every other automatic order-type request, preventing it from replacing another active dialog.

## Preserved rollback

Version 3.9.11 remains the frozen rollback release and was not modified.

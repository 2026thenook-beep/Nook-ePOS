# The Nook ePOS 3.8.6

## Refresh stability and cross-device synchronisation

- Full server refresh now preserves the currently displayed confirmed data while the request is in flight.
- Failed refreshes retain the last confirmed Till/Kitchen data instead of replacing it with empty arrays.
- Kitchen Refresh now uses the focused kitchen snapshot rather than the full bootstrap.
- Ticket History now polls its focused daily snapshot while open, allowing new tickets from other devices to appear automatically.
- Live payment, held-order and kitchen write paths remain immediate and separate from polling.

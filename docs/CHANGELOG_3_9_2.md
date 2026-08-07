# The Nook ePOS 3.9.3

## Device Local Mode and Local Ticket Continuity

- Verified 3.9.1 menu retries occurred only on the normal 60-second poll.
- Added guarded menu-read backoff: 5, 10, 20, 30, then 60 seconds.
- Offers Device Local Mode after four consecutive menu-sync failures or immediately when the browser reports internet loss.
- Local Mode is always user-controlled and does not activate silently.
- Stores a maximum of 20 unsynchronised paid tickets per device.
- Uses the existing ClientRequestID backend de-duplication when uploading, preventing duplicate sales after ambiguous network failures.
- Added Device Local Tickets tab with full order, prompt, add-on, note, payment and customer/table detail.
- Local tickets can be marked complete/reopened locally while waiting for server sync.
- Uploads pending tickets serially when server access returns.
- Existing safe-wake, last-known-good menu, non-destructive reads and render circuit-breaker protections remain active.

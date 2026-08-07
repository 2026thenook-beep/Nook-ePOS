# 3.13.15 — 48-Hour Local Ticket Retention

- Confirmed local ticket copies are retained for 48 hours from ticket creation, then automatically removed from the device.
- Synced records are pruned from both the daily ticket store and durable transaction store to prevent local storage growth.
- Unsynchronised, syncing or failed tickets are never deleted because of age.
- Cleanup runs at startup and after transaction synchronisation, so long-offline tickets remain protected until the server confirms them.
- Backend compatibility remains 3.13.5 and database version remains 1.0.6.

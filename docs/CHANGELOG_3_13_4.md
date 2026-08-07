# 3.13.4 — Daily Local Ticket Redundancy

- Retains readable local copies of paid tickets in a dedicated IndexedDB daily ticket store.
- Integrates local and server-confirmed tickets into Ticket History without duplicate rows.
- Keeps today and yesterday's confirmed local copies; unsynchronised tickets are retained regardless of age.
- Updates local ticket status when the server confirms the transaction.
- Allows local ticket viewing through the normal receipt layout.
- Adds a local ticket backup export from Ticket History.
- Preserves the transaction outbox, server coordinator, Kitchen revision polling and blank-screen protections.

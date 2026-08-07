# The Nook ePOS 3.13.5 — Device Maintenance and Connection Repair

- Replaces the ambiguous Clear Local Cache action with three separate maintenance workflows.
- Refresh Local Data clears only display/read caches and keeps server URL, daily local tickets, pending transactions, receipt outbox and device identity.
- Repair Connection stops polling, clears cached URL references, restores the last confirmed URL, validates versions, reloads operational data and resumes synchronisation without deleting operational records.
- Factory Reset Device uses two destructive confirmations and removes all local ePOS storage, IndexedDB queues, local tickets, device settings and applicable app caches.
- Existing safe-render, cached-Till, local-first payment and Kitchen protections remain unchanged.

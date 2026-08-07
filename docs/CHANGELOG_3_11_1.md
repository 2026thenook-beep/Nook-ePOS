# 3.11.1 — Server Request Coordinator

- Routes all server calls through priority lanes.
- Serialises writes per device and limits total concurrency.
- Keeps Kitchen reads independent and high priority.
- Deduplicates identical reads and retries transient server busy/lock/timeout failures with backoff and jitter.
- Adds a durable receipt-email outbox.
- Adds receipt settings; Print Receipt is only shown when enabled.

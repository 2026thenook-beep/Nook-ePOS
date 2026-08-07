# 3.9.6 — Resilient Kitchen Completion and Till Update

- Retains completed Kitchen state locally if a write temporarily fails.
- Automatically retries deferred Kitchen completion and reopen writes.
- Adds full-ticket Reopen ticket control.
- Clears Kitchen failure messages after a successful refresh.
- Adds a Force Till update banner when a menu update is pending.
- Preserves the current basket and blank-screen containment protections.

# 3.13.9 — Adaptive Sync and Quota Protection

- Adaptive Kitchen polling: 1.5s recent, 3s normal, 5s extended quiet, 15s hidden.
- One active polling job per type, with at most one coalesced follow-up.
- Immediate Kitchen consistency check after visibility resume/reconnection.
- Hidden/background load reduction.
- Expanded transient error retry handling for 408, 429, quota and rate-limit conditions.
- Per-action request-duration metrics.
- No Apps Script API or database schema change.

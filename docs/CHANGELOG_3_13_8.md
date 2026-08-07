# 3.13.8 — Sync Routing and 404 Recovery Stability

- Routes `kitchenSnapshot` through the dedicated Kitchen lane.
- Routes `tillLiveSnapshot` through a dedicated high-priority live lane.
- Correctly classifies `reportsSnapshot` and `menuSnapshot` as background reads.
- Repair Connection tests the current device URL before any saved fallback URL.
- Adds URL fingerprints and explicit HTTP 404 deployment-not-found messages.
- Preserves offline payment, local ticket redundancy, queueing and anti-blank-screen protections.
- Compatible backend: 3.13.5. Database: 1.0.6.

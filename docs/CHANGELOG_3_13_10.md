# 3.13.10 — Sync Maintenance Control

- Save & Test Script URL enters a temporary maintenance mode before checking a deployment.
- Ordinary Kitchen, Till, menu, report and diagnostic reads are cancelled or paused during the test.
- Essential server writes already in progress are given up to 15 seconds to finish before testing starts.
- The previous URL is restored on failure and synchronisation resumes safely.
- A manual Pause Background Sync / Resume Sync control is available in Settings.
- Manual pause keeps payments local-first, preserves queues, and automatically resumes after 30 minutes.
- Resume prioritises queued transaction and outbox processing, then runs Kitchen and Till consistency refreshes.
- Compatible backend remains 3.13.5 and database remains 1.0.6.

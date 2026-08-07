# The Nook ePOS 3.8.8 — Blank Screen and 404 Stability

- Background menu synchronisation never renders or clears Till/Menu Admin.
- Menu updates are validated and deferred until a safe screen transition.
- Kitchen snapshots must contain a valid queue; malformed responses retain existing tickets.
- Previously confirmed server data survives bootstrap/read failures.
- Read requests time out after 10 seconds; critical writes retain a 30-second timeout.
- Repeated HTTP 404 responses pause background polling for 30 seconds.
- Browser resume waits 1.5 seconds before restarting synchronisation.
- Menu polling reduced to 60 seconds.

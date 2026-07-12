# Version Match Check

The Settings/status area must show:
- Frontend: 1.0.10
- Backend: 1.0.10
- Database: 1.0.6

If Backend shows 1.0.9 or earlier, the Apps Script deployment URL still points to an older deployment. Create a new deployment version or edit the current deployment to use the latest code.

If Frontend shows 1.0.9 or earlier, the web host or browser is serving cached files. Upload the complete 1.0.10 frontend, including `index.html`, and hard-refresh the device.

The `?v=1.0.10` asset parameters in `index.html` ensure all JavaScript and CSS files are loaded from the same release.

# The Nook ePOS 2.0.3

## Engineering foundation release

This release preserves the approved 1.3.7 POS behaviour while improving maintainability.

- Added `js/foundation.js` for shared API transport, modal/busy UI and release compatibility helpers.
- Removed direct network transport implementation from `app.js`; calls now pass through one API client.
- Removed duplicated busy-overlay HTML from `app.js`; save/loading overlays now use one UI service.
- Added `build-info.json` as the release manifest.
- Added `scripts/verify-release.js` to verify frontend, backend, database and cache-busting versions before packaging.
- Retained the Google Sheets database schema at 1.0.6; no migration is required.
- Retained all user-facing workflows and features from 1.3.7.

# The Nook ePOS 2.1.0

- Consolidated accumulated 2.0.x changes into a clean maintenance release.
- Made `build-info.json` the release authority used by `scripts/sync-release.js`.
- Replaced separate browser frontend/backend declarations with one `appVersion`.
- Added component-level version diagnostics in Settings.
- Preserved database schema 1.0.6; no migration is required.

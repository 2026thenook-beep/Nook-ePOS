# The Nook ePOS Browser 1.1.5 — Consolidated Foundation

This is the consolidated baseline produced from Browser 1.0.11. Existing functions are retained, while superseded release-specific patch layers have been absorbed into the main code.

## Consolidation changes

- One frontend release manifest: `js/release.js`.
- UI version, frontend compatibility and asset cache identifiers are aligned to 1.1.5.
- One synchronisation coordinator now schedules both Kitchen and menu updates.
- Kitchen polling remains every 3 seconds while Kitchen is open.
- Shared menu changes remain checked every 5 seconds on connected devices.
- Old release-specific test notes and patch comments were removed.
- Report export, protected report clearing, ticket reset, prompt copying, responsive layouts and strict Google Sheets persistence remain included.

## Versions

- Frontend: 1.1.5
- Backend: 1.1.5
- Database: 1.0.6

## Deployment

Deploy `google/Code.gs` as a new Google Apps Script web-app version, then upload the complete frontend together. Do not mix files from older versions. Hard-refresh each device once after deployment.

## 1.1.5 report-clear security update

- Replaced the two report-clear passwords with one four-digit passcode: `2702`.
- Displays the hint `Wiesheu` in a POS-styled on-screen keypad.
- Uses masked entry, Clear, Delete, Cancel and final confirmation controls.
- The backend validates only the new `passcode` request field and trims whitespace.


## 1.1.5 changes
- Full-card selection for standard prompt choices.
- Separate menu and ticket scrolling on the Till screen.
- Server, table and customer fields stay visible above the scrolling ticket content.

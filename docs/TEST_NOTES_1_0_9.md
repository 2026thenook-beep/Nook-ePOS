# Test Notes — Browser 1.0.9

## Added features
- Responsive layouts for desktop, iPad/tablet, phone portrait and short landscape screens.
- Admin Item Configuration source dropdown grouped by menu category.
- Server-side copying of all prompts and options from one menu item to another.
- Existing target prompts remain in place; copied records receive new unique IDs.
- Copy operation runs under one Apps Script write lock.

## Automated checks passed
- JavaScript syntax: `js/app.js`, `js/core.js`, `google/Code.gs`.
- Core cart/payment calculations.
- Backend loyalty validation.
- Database repair static and mock tests.
- App UI static tests.
- Lock routing tests.
- Kitchen auto-refresh tests.
- Prompt-copy and responsive-layout tests.

## Deployment requirement
Replace the frontend files and redeploy the updated `google/Code.gs` as a new Apps Script web-app version. The database schema remains version 1.0.6 and no new spreadsheet columns are required.

# The Nook ePOS 3.13.19 — Single-Day Reports / Explicit Comparisons

Release reference: `NOOK-REPORT-DAY-COMPARISON-3.13.19`

## Reports date handling

- Reports now have one authoritative **Report date** selector instead of separate From and To selectors.
- Loading a report performs three separate exact one-day `reportsSnapshot` reads:
  1. the selected report date;
  2. the previous day;
  3. the same weekday seven days earlier.
- The old expanded multi-day comparison window has been removed.
- A new date selected while another report refresh is already running is retained as the pending/latest date and is loaded immediately after the older request finishes. The older response cannot replace the newly selected report.

## Comparison labelling

- Previous-day data is labelled **Comparison: Previous day**.
- Seven-day comparison data is labelled **Comparison: Same weekday last week**.
- The refresh control is labelled **Reload selected day + comparisons** so comparison reads are not confused with the selected report itself.
- If the selected day loads but one comparison request fails, the selected report remains usable and the unavailable comparison is identified rather than being presented as zero sales.

## Export

- The export control is labelled **Export selected day**.
- Export is enabled only after the currently selected report date has successfully loaded.
- The CSV contains the selected day only; comparison-day tickets/refunds/item lines are excluded.
- CSV filenames use `nook-report-YYYY-MM-DD.csv`.

## Deployment compatibility

This is a frontend-only release.

- Frontend: **3.13.19**
- Accepted Apps Script backend: **3.13.18, 3.13.17 or 3.13.16**
- Included `google/Code.gs`: **3.13.18**, unchanged from 3.13.18
- Database: **1.0.6**, unchanged

If the deployed Apps Script is already 3.13.16, 3.13.17 or 3.13.18, update the browser/frontend files only. No Apps Script redeployment is required.

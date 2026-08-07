# The Nook ePOS 3.13.19 — Single-Day Reports / Explicit Comparisons

Release reference: `NOOK-REPORT-DAY-COMPARISON-3.13.19`

- Frontend: **3.13.19**
- Compatible Apps Script backend: **3.13.18 / 3.13.17 / 3.13.16**
- Included Apps Script source: **3.13.18** (unchanged)
- Database: **1.0.6** (unchanged)
- Rollback frontend: **3.13.18**

## Deployment

This is deliberately a **frontend-only release**. If the live status already reports backend 3.13.16, 3.13.17 or 3.13.18 with database 1.0.6, replace/update the browser frontend files only. **Do not redeploy Google Apps Script for 3.13.19.**

If the live backend is still 3.13.15, first move the Apps Script backend to 3.13.16+ because 3.13.16 contained real backend changes.

## Reports workflow

The Reports screen now uses one **Report date**. When that date is loaded the frontend independently requests:

1. **Selected report date** — this is the report shown and the only date included in export.
2. **Comparison: Previous day** — comparison only.
3. **Comparison: Same weekday last week** — comparison only.

This removes the old behaviour where a one-day report could make one larger request spanning up to the comparison date.

The report refresh control says **Reload selected day + comparisons**. The export control says **Export selected day** and stays disabled until the selected date has successfully loaded.

If the user changes the date while an older Reports request is running, the newer date is kept as the pending request. The stale result is ignored and the newest selected date is loaded next instead of being discarded.

If a comparison request fails after the selected day has loaded, the selected-day report remains usable and the failed comparison is shown as unavailable.

## Export scope

The CSV is explicitly limited to the selected report date. It includes the selected day's summary, sales, refunds and item lines and is named:

`nook-report-YYYY-MM-DD.csv`

Comparison records are not exported.

## Previous 3.13.18 fixes retained

3.13.19 includes the 3.13.18 device-local ticket persistence/clear-all fixes and Kitchen status recovery fixes unchanged.

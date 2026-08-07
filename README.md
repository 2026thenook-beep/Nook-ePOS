# The Nook ePOS 3.13.20 — iPad Till Category Layout Reliability

Release reference: `NOOK-IPAD-CATEGORY-LAYOUT-3.13.20`

- Frontend: **3.13.20**
- Compatible Apps Script backend: **3.13.18 / 3.13.17 / 3.13.16**
- Included Apps Script source: **3.13.18** (unchanged)
- Database: **1.0.6** (unchanged)
- Rollback frontend: **3.13.19**

## Deployment

This is a **frontend-only release**. If the live status already reports backend 3.13.16, 3.13.17 or 3.13.18 with database 1.0.6, update the browser frontend files only. **Do not redeploy Google Apps Script for 3.13.20.**

If the live backend is still 3.13.15, first move the Apps Script backend to 3.13.16+ because 3.13.16 contained real backend changes.

## iPad Till category fix

Till categories are rendered inside layout-editor wrapper elements. On tablet/iPad widths the category bar becomes a single horizontally scrolling flex row. The wrapper could previously shrink even though the category button inside retained a minimum width, causing the button to overflow its wrapper and visually overlap the next category.

3.13.20 makes category wrappers non-shrinking flex items. Each category therefore owns its complete width and the strip scrolls horizontally when necessary. Long category names wrap inside a bounded button width instead of crossing into neighbouring buttons.

## Previous fixes retained

3.13.20 retains the 3.13.19 single-day Reports / explicit-comparison workflow, 3.13.18 device-local ticket persistence/clear-all changes, and the Kitchen status/wake reliability refinements.

# The Nook ePOS 3.13.19 — Test Report

Release reference: `NOOK-REPORT-DAY-COMPARISON-3.13.19`

## Result

**100 / 100 regression tests passed.**

Additional release checks also passed:

- `node --check` JavaScript syntax validation.
- Release/version manifest validation.
- Behavioural report-refresh test using mocked server responses.
- Report date-engine tests across normal and month-boundary dates.
- Frontend-only release synchronisation test.
- Apps Script SHA-256 immutability check against 3.13.18.
- Database 1.0.6 SHA-256 immutability check against 3.13.18.

## 3.13.19 report-specific coverage

The new regression coverage verifies that:

- Reports expose one `Report date` control rather than separate From/To controls.
- The selected date is requested as an exact one-day `reportsSnapshot` read.
- The previous day is requested separately as an exact one-day comparison read.
- The same weekday seven days earlier is requested separately as an exact one-day comparison read.
- The old expanded `fetchFrom` multi-day window is absent.
- A newly selected date is queued when a previous report request is still active.
- A stale response cannot overwrite the newly selected date.
- The queued latest date runs immediately after the older request finishes.
- Export is blocked until the selected date has successfully loaded.
- Export filters only the selected day even though comparison data is present in memory.
- Export filename is `nook-report-YYYY-MM-DD.csv`.
- Previous-day and same-weekday data are explicitly labelled as comparisons.
- A comparison failure does not make a successfully loaded selected-day report unusable.

## Backend/database immutability

`google/Code.gs` SHA-256:

`6895076f1cbac3dd4396c9c92c3ceb1c7739c63824982eafbf86a50d80bd8c17`

This is identical to the validated 3.13.18 backend source.

`database/Nook_ePOS_Database_Template_1_0_6.xlsx` SHA-256:

`7a11fe68eb7dc1f6b752a053bd78a6a403a2af277feb19c13a8475afd6e69dbe`

This is identical to the validated 3.13.18 database template.

## Deployment conclusion

3.13.19 is a frontend-only release. A live Apps Script backend already reporting 3.13.16, 3.13.17 or 3.13.18 on database 1.0.6 does not require redeployment.

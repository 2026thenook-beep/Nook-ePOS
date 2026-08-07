const fs = require('fs');
const assert = require('assert');
const app = fs.readFileSync('js/app.js', 'utf8');
const release = fs.readFileSync('js/release.js', 'utf8');
const backend = fs.readFileSync('google/Code.gs', 'utf8');
const build = JSON.parse(fs.readFileSync('build-info.json', 'utf8'));

assert.strictEqual(build.release, '3.13.19');
assert.strictEqual(build.frontendVersion, '3.13.19');
assert.strictEqual(build.backendVersion, '3.13.18');
assert(release.includes("appVersion: '3.13.19'"));
assert(release.includes("acceptedBackendVersions: Object.freeze(['3.13.18', '3.13.17', '3.13.16'])"));
assert(backend.includes("var NOOK_VERSION = '3.13.18';"), 'frontend-only release must not change Apps Script');

assert(app.includes('<span>Report date</span><input class="input" type="date" id="reportDate"'), 'single report-date selector missing');
assert(!app.includes('id="reportFrom"'), 'old From selector must be removed');
assert(!app.includes('id="reportTo"'), 'old To selector must be removed');
assert(app.includes('Reload selected day + comparisons'), 'refresh action must identify comparison loading');
assert(app.includes('Export selected day'), 'export action must identify selected-day scope');
assert(app.includes('Export contains the selected day only.'), 'export scope help text missing');
assert(app.includes("previousLabel: 'Comparison: Previous day'"), 'previous-day comparison label missing');
assert(app.includes("lastWeekLabel: 'Comparison: Same weekday last week'"), 'same-weekday comparison label missing');

assert(app.includes("api('reportsSnapshot', { fromDate: requestedDate, toDate: requestedDate })"), 'selected date must use exact one-day read');
assert(app.includes("api('reportsSnapshot', { fromDate: requestedPeriod.previousFrom, toDate: requestedPeriod.previousTo })"), 'previous day must use separate exact read');
assert(app.includes("api('reportsSnapshot', { fromDate: requestedPeriod.lastWeekFrom, toDate: requestedPeriod.lastWeekTo })"), 'last-week day must use separate exact read');
assert(!app.includes('requestedPeriod.fetchFrom'), 'old expanded comparison window must not remain');

assert(app.includes('entry.pendingDate = requestedDate'), 'latest selected date must be queued while a report refresh is in flight');
assert(app.includes("pendingDate && pendingDate !== requestedDate"), 'queued latest report date must be run after the old request finishes');
assert(app.includes('requestedDate !== state.reportFrom'), 'stale report results must be ignored after date changes');

assert(app.includes('state.reportLoadedDate !== selectedDate'), 'export must reject an unloaded selected date');
assert(app.includes("a.download='nook-report-'+selectedDate+'.csv'"), 'export filename must contain only the selected date');
assert(app.includes("var rows=[['REPORT DATE',selectedDate]"), 'export must identify selected report date');

console.log('3.13.19 single-day report/export regression checks passed');

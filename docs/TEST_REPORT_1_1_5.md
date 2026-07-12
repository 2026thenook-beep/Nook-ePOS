# Test Report — The Nook ePOS Browser 1.1.5

## Change verified

- The Till ticket panel no longer displays Server name, Table number, or Customer name for receipt text boxes.
- The existing payment confirmation modal still displays Customer name for receipt and Table number inputs.
- Transaction metadata fields and backend persistence remain available.

## Automated checks

- JavaScript syntax checks passed for app, core, configuration, release manifest and Apps Script backend.
- Core pricing tests passed.
- Payment and application static tests passed.
- Backend loyalty tests passed.
- Database repair tests passed.
- Lock routing tests passed.
- Kitchen automatic refresh and open-count tests passed.
- Reports, menu synchronisation and version checks passed.
- Responsive prompt-copy tests passed.
- Till prompt touch-target and independent scrolling tests passed.
- Dedicated Till-field removal regression test passed.

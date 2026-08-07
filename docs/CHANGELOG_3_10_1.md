# The Nook ePOS 3.11.0

Reference: `NOOK-PAYMENT-FIX-3.11.0-R01`

## Changes

- Restored the loyalty-stamp reminder directly inside the Cash payment keypad.
- Added a £5 quick cash-received button.
- Preserved the consolidated 3.10.0 architecture and all existing payment persistence safeguards.
- No Kitchen Display behaviour or blocking dialogs were changed.

## Compatibility

Deploy the included frontend and `google/Code.gs` together. Version 3.10.0 remains the rollback release.

# The Nook ePOS 3.4.1

## False unsaved-change fix

- Removed derived `CategoryName` from the item dirty-state snapshot; `CategoryID` is the authoritative editable relationship.
- Preserved existing prompt-option `Active` values when the option editor has no Active control.
- New options still default to active.
- Cleared legacy item, prompt and option dirty flags whenever a new authoritative item baseline is captured.
- Added regression coverage for switching between untouched items, including items with inactive options.

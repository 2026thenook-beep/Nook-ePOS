# The Nook ePOS 3.4.0

## Differential batched configuration save

- Keeps the reliable complete item-configuration payload from the browser.
- Reads MenuItems, Prompts and PromptOptions once each under the existing write lock.
- Compares current and requested data in memory.
- Skips sheet writes when a sheet has not changed.
- Uses one batched range write per changed sheet rather than row-by-row updates.
- Removes deleted prompts and options during the same authoritative save.
- Returns the saved item configuration directly without a full menu reload.

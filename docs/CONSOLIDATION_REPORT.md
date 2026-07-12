# Consolidation report — 1.1.5

## Preserved functions

- Till, prompts, prompt quantities and add-ons
- Cash/card payments and strict server persistence
- Held orders, reports, refunds and ticket history
- Kitchen automatic updates and completion status
- Responsive layouts
- Category-grouped prompt copying
- Date-range CSV report export
- Dual-password report clearing and ticket counter reset
- Cross-device menu synchronisation
- Version compatibility checks

## Structural improvements

1. Version duplication was reduced by introducing `js/release.js` as the frontend release manifest.
2. Separate Kitchen and menu timers were replaced with one coordinator.
3. Obsolete release-specific documentation and tests were removed.
4. Backup filenames now use the current configured release automatically.

No database schema migration is required.

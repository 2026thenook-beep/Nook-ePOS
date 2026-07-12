# Test report — The Nook ePOS Browser 1.1.4

## Result

All automated regression tests passed on 11 July 2026.

## Test coverage

- Application static structure
- Core pricing and cart calculations
- Backend loyalty logic
- Database repair and metadata migration
- Write-lock routing
- Kitchen automatic refresh
- Responsive layout and prompt copying
- Protected report clearing and ticket-number reset
- Date-range report export controls
- Cross-device menu synchronisation
- Consolidated release manifest and shared synchronisation coordinator

## Syntax validation

The following files passed Node.js syntax validation:

- `js/release.js`
- `js/config.js`
- `js/core.js`
- `js/seed-data.js`
- `js/app.js`

## Database

No schema migration is required. Database version remains 1.0.6.

## Report-clear keypad verification

- Single passcode contract verified: `2702`.
- Hint displayed: `Wiesheu`.
- POS keypad, masked four-digit display, clear/delete and confirmation flow verified statically.
- Ticket counter reset remains `0` after successful report deletion.

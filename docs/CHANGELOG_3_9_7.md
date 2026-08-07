# The Nook ePOS 3.9.7

## Responsive Till
- Compact layout for smaller tablets and low-height displays.
- Independently scrolling menu and basket regions.
- Horizontal category scrolling.
- Smaller adaptive menu tiles.
- Payment and order controls remain accessible.

## Collapsible navigation
- Navigation defaults to a single Menu button.
- Drawer closes after a tab is selected.
- Drawer automatically closes after 12 seconds.

## Status recovery
- Successful healthy synchronisation restores the global status bar to Ready / Read OK / Write OK.
- Active writes, offline mode and pending Kitchen changes are not incorrectly cleared.

## Prompt copy authority
- Fetches the latest source item configuration from Google Sheets before copying.
- Reads the target item configuration back after copying.
- Local Menu Admin state is replaced with the confirmed prompts and options.

## Verification
- 61 automated regression tests passed.
- JavaScript syntax and release manifest verified.

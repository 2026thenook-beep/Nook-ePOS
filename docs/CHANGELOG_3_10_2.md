# The Nook ePOS 3.11.0

## Responsive header
- Keeps the Menu control immediately to the right of The Nook branding.
- Scales the logo, version and Menu control smoothly with the viewport.
- Uses an icon-only 48 px Menu control on very narrow screens.
- Prevents the header from changing to a stacked logo/menu layout.

## Till basket scroll retention
- Preserves the exact basket scroll position during loyalty changes and other non-item Till refreshes.
- Retains the existing new-item feedback behaviour so a newly added or changed item is brought into view.
- New sale and cleared-basket states continue to start at the top naturally.

## Verification
- 68 Node regression tests passed.
- JavaScript syntax validation passed.
- Frontend/backend version alignment verified.

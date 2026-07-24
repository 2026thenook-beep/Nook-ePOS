# The Nook ePOS 3.3.0

## Unified item configuration save
- One sticky Save Configuration control covers the selected item, prompts and prompt options.
- Save remains disabled until the normalised working configuration differs from the authoritative snapshot.
- Reverting every edit disables Save Configuration again.
- Item, prompt and option edits are coordinated and reloaded from Google Sheets after save.
- Prompt and option reordering is staged until Save Configuration.

## Unsaved changes guard
- Changing item, Menu Admin subsection or main application tab now offers Save changes, Discard changes or Stay here.
- Browser close/refresh receives standard unsaved-work protection.
- Categories retain their independent guarded save workflow because they are shared by many items.

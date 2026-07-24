# The Nook ePOS 3.2.0

## Authoritative Menu Admin saves

- Added a shared `js/admin-save.js` service for item, category and prompt saves.
- Item, category and prompt save buttons now use the same queued/dirty/saving/saved pattern as prompt option saves.
- Unchanged records show a disabled saved state.
- Editing a field marks the relevant record as having unsaved changes.
- Repeated save taps are deduplicated while the first save is active.
- Successful Google Sheets saves are followed by an authoritative bootstrap reload.
- Unsaved prompt option edits are preserved while another admin record is reloaded.
- Failed saves remain visibly unsaved and are not falsely marked as persisted.

## Themed notifications

- Added themed success, information, warning and error toasts.
- Added a shared in-app confirmation dialog.
- Removed all native browser `confirm()` and `alert()` usage.
- Destructive confirmations now match the application theme and use touch-friendly controls.

## Compatibility

- Browser application: 3.2.0
- Apps Script backend: 3.2.0
- Database schema: 1.0.6
- Behavioural compatibility: 3.1.0

# The Nook ePOS 3.3.1

## Dirty-state correction
- Item configuration comparisons now use a canonical editable-field snapshot.
- Spreadsheet-only metadata and harmless object-shape differences no longer enable Save Configuration.
- Text, number, boolean and ordering values are normalised consistently.
- Returning fields to their saved values disables the save button again.

## Faster configuration saves
- Item, prompts and prompt options now use one `saveItemConfiguration` Apps Script request.
- The complete write executes under one write lock.
- The server returns the saved configuration directly.
- The frontend updates only the selected configuration and no longer performs a full bootstrap reload after saving.

# The Nook ePOS Browser 1.1.8

## Kitchen completion reliability

- Prevents kitchen polling from overwriting a ticket while its completion write is pending.
- Disables the ticket section controls while a completion/reopen request is being saved.
- Moves Food/Drinks status merging into the Apps Script write lock.
- Prevents two kitchen devices from overwriting each other's section completion state.
- Reloads the authoritative kitchen row after each confirmed update.
- Rolls back the optimistic display if Google Sheets rejects the write.

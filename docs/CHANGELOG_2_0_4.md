# The Nook ePOS 2.0.4

## Kitchen completion
- The COMPLETED stamp appears immediately when Complete both is tapped.
- When the last open section is completed, the stamp also appears immediately.
- The completed ticket then leaves the display once and is suppressed from stale polling results, preventing it from reappearing after the server response.
- Failed writes restore the ticket to its previous open state.

## Variable-quantity prompt options
- Removed the checkbox/radio control from options configured with Qty.
- Quantity 0 means not selected; + and - directly add or remove the option.
- Standard prompt options retain their normal checkbox or radio control.
- Quantity text is shown only for options configured to accept variable quantities.
- The rule is applied to the Till, held orders, receipt display, Kitchen Ticket Display and emailed receipts.

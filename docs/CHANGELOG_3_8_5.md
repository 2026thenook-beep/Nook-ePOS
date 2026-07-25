# 3.8.5 — Order state lifecycle

- Centralised new-order reset logic.
- Empty baskets no longer retain a stale Eat in/Takeaway selection after clearing, holding, paying, or removing the final item.
- A deliberate order-type selection made before the first item remains valid for that new order.
- First-item selection prompts whenever the basket is empty and no order type has been deliberately selected for the current new order.
- Held and recalled orders retain their saved order type.

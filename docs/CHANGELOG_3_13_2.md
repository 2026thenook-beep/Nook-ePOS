# 3.13.3 — Till Layout Save Compatibility Fix

- Retains the Till-based category and item layout editor introduced in 3.13.1.
- Removes the unsupported `saveTillLayoutArrangement` API dependency.
- Saves changed category positions through the existing `saveCategory` endpoint.
- Saves changed item positions and category assignments through the existing `saveItem` endpoint.
- Displays confirmed progress while each changed position is saved.
- Keeps edit mode open after a failed save and permits a safe retry.
- Requires no database schema change and remains compatible with the established 3.13.0 backend action set.

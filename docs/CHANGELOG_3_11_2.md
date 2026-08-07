# 3.11.2 — Kitchen Revision Polling and Protected Rendering

- Added revision-gated Kitchen snapshots: unchanged polls return metadata only.
- Added a forced full Kitchen consistency refresh every 60 seconds.
- Incremented KitchenRevision when tickets are created or Kitchen state changes.
- Retained the existing emergency shell, render recursion guard, render-loop circuit breaker, cached startup and safe wake path.
- Repurposed the former copy-script area as a disabled Secondary Service URL placeholder while preserving the confirmed primary URL controls.
- No second script writes to the spreadsheet in this release.

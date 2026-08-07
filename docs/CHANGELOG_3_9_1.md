# The Nook ePOS 3.9.1 — Safe Wake and Blank-Screen Containment

- Browser wake/pageshow events only tick guarded background reads after a 1.5-second delay.
- Wake handling cannot call bootstrap, full render, Till render, or Menu Admin render.
- Re-entry guard prevents duplicate wake handlers from creating concurrent resume cycles.
- Full render now has recursion containment: nested renders are coalesced into one deferred render.
- Renderer exceptions are caught and replaced with a visible Till recovery panel instead of an empty main area.
- Last-known-good confirmed menu data is restored during startup while the server reconnects.
- A static startup Till shell is present before JavaScript runs, preventing an initially empty application body.
- Cached startup mode blocks server-dependent writes until connection is confirmed.

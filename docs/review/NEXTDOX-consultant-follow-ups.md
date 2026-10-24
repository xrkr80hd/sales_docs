# Outstanding consultant work

- [ ] Universal popup containment: logins, newly opened pages, and confirmation windows must remain inside the Walker Browser workspace for every external tool. The current iframe implementation does not provide this. Do not mark complete or describe it as fixed without implementing an appropriate browser architecture and verifying real login and confirmation flows.

# Current local sidebar correction

- Removed the parent Setup accordion and cog icon.
- Consultant Set Up opens one full page; its close button returns to Sales Commander.
- Command Center Settings appears only beneath Command Center, not in Consultant Set Up or the parent sidebar group.

## Current verified loading work

- Saved links reuse a scoped browser snapshot and synchronize changes with the existing backend.
- Business cards reuse saved responses; analytics loads on demand; saved contact edits are no longer overwritten by setup defaults during reads.
- Messenger reuses recent conversations, consumes realtime message updates directly and uses REST polling only as a disconnected fallback. Optional browser history writes are deferred; the text cache has a 2 MB ceiling and never deletes server history.
- Customer Information keeps the same label, icon and dimensions, highlights when open and rotates a chevron.
- Stay signed in explicitly opts a device out of the eight-hour idle cutoff. Manual logout clears private cached data. Existing temporary customer-paperwork expiration remains intact.
- Sign-in panel dimensions are preserved through account verification.

## Popup containment status

The desktop companion is an unfinished, local prototype. Its native popup integration test crashes in this environment. It is not included in the web release, has no installer, and real provider sign-ins have not been verified. The web iframe still cannot guarantee popup containment. Do not report popup containment as fixed.

Sales Commander number edits are local; in-app link navigation offers Save & Exit, Discard & Exit or Stay Here. The browser controls refresh/close warnings and cannot guarantee delivery on process termination. No per-field save toasts remain.

Latest local validation: 101 Node tests; mobile/desktop cache, realtime delta, disconnected-fallback suppression while live, Sales Commander exit/save, accordion geometry, and sign-in geometry checks. These counts refer to this workspace's tests, not the separate handoff suite. No 300-user production load test has been performed.

## Added display requirement — pending reconciliation

- Fit the workspace clearly on a 13-inch laptop display. Audit real viewport dimensions rather than treating the physical screen diagonal as a CSS breakpoint. Reduce avoidable header, sidebar and content padding while preserving legibility and touch/focus targets. Evaluate a per-tool Walker Browser zoom control; cross-origin iframe content cannot be reflowed by NEXTDOX CSS. Do not add another banner or navigation layer. This item is recorded, not implemented in the current loading release.

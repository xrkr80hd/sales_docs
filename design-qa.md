# NXTDOCS interface and workflow verification

## Implemented
- Shared charcoal/red styling, Barlow typography, consistent panels, responsive navigation, the supplied Walker logo, and circular account photos across application and sign-in surfaces.
- Consultant Setup retains existing contact saving and document auto-fill. Profile upload uses the existing media-bucket convention. Consultant Card remains separate.
- Training opens the original Cheat Sheet. Consultant Links supports named HTTPS links, organization defaults, personal overrides, and an embedded portal with an external-tab fallback.
- Messenger integrates MIT-licensed Chatcn components with attribution. Registered messenger-enabled organization members remain visible offline and can receive direct messages. Existing message APIs remain in use.
- Master Admin has five role views and People & Organizations controls for creation, invitations, assignments, and permissions. Floor/district roles use server-managed auth metadata with compatible existing database roles.
- Managers publish monthly unit/gross objectives, consultant goals, sold counts, schedules, and weekly updates. Projections lock after manager confirmation; later manager changes require a reason.
- District Manager has unread Updates, mark-read controls, and arrival toasts. Projection changes, manager-reported sold-count changes, and weekly updates do not create Messenger messages.
- Boards persist in the protected Master Admin's existing user_settings JSON. Manager reassignment preserves boards and existing contacts. No schema migration or additional environment variable is required.

## Verification passed
- Production build and TypeScript; targeted lint has no errors. Vendored/original messenger code retains non-blocking warnings.
- Whitespace and scripts/verify-protected-paths.mjs: printed documents, document routes, parsing, deal APIs, and existing contact persistence are unchanged. Workflow-screen changes are limited to presentation classes and application logo references.
- scripts/verify-board-contracts.cjs exercises actual API handlers with in-memory SDK fixtures: authentication, organization filtering, gross privacy, approval/locking, blocked projection bypass, reason requirement, notification/read behavior, stale-write rejection, preserved contacts, safe links, invitation/access/bucket setup, and board survival after manager role changes.
- Isolated browser interactions: consultant setup save, named links, projection submission/confirmation/locking, manager revision with reason, district notification/read, and consultant pace/weekly update refresh.
- Isolated Messenger: team send/edit and direct message to an offline member.
- Browser: sign-in styling, loaded administration screen, independent read-only Office Display, mobile dashboard at 393 x 852 CSS pixels, mobile navigation, hidden-menu inert state, and Training navigation to the original Cheat Sheet.
- Existing New/Used form navigation and local resume were exercised in the preceding checkpoint; protected-path verification passes after this update.

## Visual assessment and limits
The supplied dashboard/manager/office images establish charcoal panels, red accents, large vehicle actions, left navigation, KPI tables, and circular profiles. Desktop uses two columns and mobile stacks panels; controls and branding remain readable at 393 pixels. The replacement logo renders cleanly on desktop, mobile, and sign-in.

This is a cohesive adaptation, not a pixel-identical copy. Reference sample people/numbers and vehicle hero photography are not shipped. A normalized 1672 x 941 implementation viewport was rendered, but the combined comparison page's reference image did not finish loading in this browser, so exact pixel fidelity is unverified.

## Live verification still required
Browser interaction fixtures run in a separate local checkout and are never published. No real sales, messages, invitations, accounts, or buckets were created during testing. Production authentication, profile upload, cross-account Supabase persistence, and realtime delivery have not been exercised with signed-in real accounts. Connected Supabase project tools deny access to the NXTDOCS project; application code uses its existing deployed Supabase connection. The build and isolated contract checks do not establish live end-to-end success.

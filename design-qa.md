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


## Organization and moderation follow-up (current main baseline 29eb3eda)
- Preserved the newer software/dealership logo sizing, account security controls, BDM access, staff/card separation, and monthly appointment goals.
- Added organization palettes and small badges to consultant headers, board rows, district cards, and selected district panels. Supplied transparent Honda/Toyota/Kia/CDJR/Mazda/BMW-Mercedes/GMC badges are used unchanged; individual BMW/Mercedes default marks come from official sources.
- Master Admin can choose a palette and upload/replace an organization icon at creation or under Organization branding. Assignment determines the consultant's badge. Storage preserves shared board/contact JSON and uses optimistic concurrency. No schema changes.
- Messenger keeps the same Walker dark/red palette regardless of organization. English/Spanish profanity and slurs are masked in the composer after word completion, on blur/send, in edits, API reads, storage writes, and push bodies. Case, accents, common leetspeak, separators, zero-width characters, and repeated letters are covered. Dictionary moderation cannot guarantee detection of every invented spelling or euphemism; its list is intentionally local and extensible.
- Consultant board order is Projected, Weekly Goal, Monday-Sunday, Monthly Objective, 90-Day Average, then existing sold/appointment/pace measures. Shared records are keyed by organization and reporting month; each row belongs to a consultant. Managers in the same organization read/write the same board, and master/district users can choose stores according to existing permissions.
- Contract checks cover two-manager sharing, isolation, icon-upload authorization/validation, preservation of board data through branding saves, and masked send/edit/push output. Existing account contracts and protected document checks pass against current main.
- Isolated browser checks show readable white Honda styling, preserved Walker/software hierarchy, the badge at desktop/mobile size, consultant column order on the Kia board, and masked English/Spanish composer/send text. No live messages or production uploads were performed. Live authenticated cross-account persistence remains unverified.
- Official-source research and asset provenance are recorded in public/branding/organizations/README.md. Honda's formal corporate palette is red, white, and gray; the uploaded custom Honda badge is blue and is preserved as supplied. CDJR retains the requested composite Walker palette.

- Organization CRUD follow-up: rename and logical deletion added. Deletion hides the organization, reassigns all members to the protected Walker Automotive fallback, and preserves boards/messages. This is intentionally not a cascading physical delete. Icon removal stores a hide flag; replacement restores visibility without changing its color scheme. Contract tests pass for authorization, fallback creation/protection, preserved roles/history, hidden deleted organizations, and rejected archived-board access.

- Temporary admin passwords now always require a password change; a caller cannot disable the requirement when creating/resetting an account. The existing server-wide password-change guard and user reset form are retained. No actual accounts or passwords were modified during verification.

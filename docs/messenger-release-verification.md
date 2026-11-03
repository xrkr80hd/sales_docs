# Messenger release verification — 2026-10-15

- Production build passed (Next.js 16.2.1), including TypeScript.
- Targeted ESLint passed for Messenger API/UI/moderation and updated workspace/stats components.
- 22 automated API and moderation tests passed. API tests use a scoped database mock and the actual moderation function; they are not authenticated browser end-to-end tests.
- Earlier transactional checks on the linked NEXTDOCS database passed organization channel separation, cross-organization denial, participant-only DMs (including administrators), participant injection/sender spoof denial, persisted history, disabled-member revocation, and anonymous RPC denial. Test changes rolled back.
- The subsequent live test rerun adding read-marker assertions was interrupted; its outcome is unconfirmed. Read-marker RPC existence was verified afterward.
- Two additive SQL migrations were applied transactionally to project ywtdskskkplpurniyyto. The migration API errored; separate migration-history registration was declined. Do not blindly reapply these files: reconcile the remote migration ledger with the already-applied schema first.
- Repository-wide lint reports existing errors/warnings outside the targeted changes; it is not a passing release check.
- Authenticated browser walkthrough, mobile keyboard testing, realtime delivery between two signed-in clients, and viewport screenshots remain unverified. Cloud browser has no authenticated application session and could not access the isolated local preview.
- Profanity uses deterministic humorous replacements; detected hateful slurs use stars. Word-list filtering cannot guarantee recognition of every possible evasion or contextual abuse. No AI moderator is installed.

The release also adds an Office Display exit link and replaces Sales Commander Stats' wide table/pop-out control with responsive consultant cards and explicit actual/planning-target labels.

## Loading and message presentation follow-up — 2026-10-16

- Removed the forced 650 ms splash delay and the full-screen splash artwork from session restoration/sign-in. Installable app icon and manifest remain unchanged.
- Startup `/api/me?access=1` validates the token and authoritative profile/membership, returns the password-change requirement and workspace identity, and does not request branding or profile-photo settings. The workspace consumes that verified identity immediately; appearance loads separately.
- Added bounded requests, actionable retry controls, JSON errors identifying temporary account-service failures, and sanitized server failure-stage logging. No passwords, tokens, emails, or messages are logged.
- Reused the current session token in Messenger, manager-board loading, Sale Commander, stats, shell notifications, and dashboard unread loading. Moved settings sync behind successful sign-in and bounded its fetch.
- Parallelized independent Messenger/profile queries. Reused shared organization settings only within each API request, with fresh deletion/branding data on the next request; no cross-request permission-data cache was added.
- Prevented overlapping board/stats/history polls from starving loading or allowing stale organization results to replace the current board. Message-history failures have their own retry state instead of being shown as an empty conversation.
- Sale Commander editing now remains disabled if saved activity cannot be loaded, protecting existing values from accidental replacement with defaults.
- Notification permission prompt dismisses before push registration, including denied/rejected/stalled registration. Printing no longer incorrectly claims to require notification permission.
- Message text fits a compact bubble; timestamps sit outside it. Own-message Edit/Delete actions are hidden until the message is tapped, with native button keyboard access. Sender headings remain on received messages.
- Word-replacement hashing is calculated once per message, with repeated match classification reused. Existing replacement outputs remain stable; hateful-language masking remains enabled. Stress case improved from approximately 3.6 s to 0.24 s in this environment.
- Final Next.js production build (including TypeScript) and targeted ESLint across changed application files passed.
- 42 automated regression/API/moderation tests passed, covering missing/invalid authentication, mandatory password changes, authoritative roles, stalled requests/body decoding, push-prompt dismissal, private-DM denial, scoped history/send/edit/delete, cache freshness, and message-action disclosure. Persistence tests use a database mock; they do not establish a live signed-in send/reload flow.
- Production API credential health checks against the existing NEXTDOCS Supabase project returned HTTP 200. The read-only database check found no waiting locks. No data migration or production database writes were performed for this follow-up.
- Browser inspection reached the production sign-in form. This browser has no signed-in NEXTDOCS session. Signed-in loading latency, mobile keyboard behavior, viewport screenshots, and two-client realtime delivery remain unverified. The local Chromium download failed, so no new browser viewport results are claimed.

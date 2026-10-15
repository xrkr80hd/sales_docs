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

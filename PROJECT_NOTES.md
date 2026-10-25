# Project notes

## TD / FIN — Test Dump protocol

- `TD` means **Test Dump**. Enter a collection-only state.
- While TD is active, silently inventory the user's checks, screenshots, reported problems, and requested changes. Do not reply to individual dump entries, research, implement, test, commit, push, or deploy.
- Pause any previously authorized implementation or push while collecting the dump. Preserve existing work and the collected inventory.
- `FIN` or `fin` explicitly ends TD. Uploads, elapsed time, or unrelated messages do not end it.
- After FIN, reconcile the entire inventory against current repository state, research the actual causes, implement the required fixes, run appropriate checks, then push the collected fixes as authorized by this workflow. Preserve authentication, permissions, organization isolation, and unrelated functionality.
- An explicit instruction to document or update this protocol during TD authorizes only that documentation change; it does not resume implementation or publishing.

Current status: TD ended with “rptpls and fin”; the user subsequently explicitly authorized implementation, tests, and push. See docs/review/NEXTDOX-test-dump-follow-up.md for reconciliation and verification.

## Consultant Today page (branch consultant-today-page)

`/dashboard` is now the consultant's Today page (`components/command-center/consultant-home.tsx`): pace vs. goal, today's counters (autosaved), today's routine with the current block highlighted, the Daily Planner disciplines checklist, to-dos for today and the next shift, and a Mon–Sat week summary. Sales Commander moved to `/sale-commander`. Targets come from `lib/sales-commander-model.ts`: the goal is split across walk-in ups, appointments and owners/repeat/referral, selling days come from the consultant's own routine schedule, and daily targets rise (capped at 2× plan) when behind. Manager stats use the same projection. Deal documents, print and the deal workflow were not touched. Latency findings and the staged backend plan: `docs/review/NEXTDOX-latency-and-backend-plan.md`.

## Consultant Quick Tour

An on-demand Quick Tour in the consultant sidebar highlights eight existing controls: Sales Commander, Consultant Set Up, Command Center, Start a Deal, Resume Deal, Customer Information, Consultant Tools, and Messenger. Next/Back, Skip, Done, and Escape are supported; reopening starts from the beginning. It does not navigate, submit forms, or write business data. Phone (390px) and laptop (1336px) browser fixtures verify all steps, visible highlights, viewport bounds, restart, and zero writes. TypeScript and targeted ESLint pass. TypeScript, targeted ESLint, and the production build passed. Trav explicitly authorized pushing this tour.

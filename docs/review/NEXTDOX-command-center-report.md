# NEXTDOX consultant navigation and Command Center review

Reviewed locally on 2026-10-24. No commit, push, deployment, migration, policy change, or production record modification was performed. This report supplements `NEXTDOX-startup-optimization-report.md`, which inventories the preceding local performance changes.

## Architecture and findings

NEXTDOX remains a dealership paperwork preparation application: unified entry feeds shared forms, preview and printing, followed by existing dealership procedures. This work adds no credit processing, lender transfer, payment processing, or third-party CRM integration.

The existing dashboard supplies Deal Commander. Existing `/consultant-links/[id]` supplies the embedded link view, now labeled Walker Browser. Existing `user_settings.dealer_info.consultantLinksByOrganization` already supports personal collections partitioned by organization. These were reused rather than creating a second dashboard, browser implementation, database table, or client-storage system.

Confirmed problems in the prior shortcuts design were shared administrator/default-link fallbacks, multiple frontend owners of the list, and no version check to prevent concurrent settings writes replacing each other. The previous Consultant Setup was a drawer rather than a dedicated page. The illustrated desktop collapse triangle was absent from source; it was added, preserving the existing mobile menu and close controls.

## Implemented behavior

- Consultant Setup is the FIRST sidebar item and opens a full page at `/consultant-setup`; it is no longer a settings drawer. Its existing profile/contact/dealer fields remain available. The profile-menu shortcut also opens this page.
- Deal Commander remains a standalone primary tab. Command Center follows it as a compact accordion, with Customer Information as a separate accordion beneath it.
- Consultant Setup links to a dedicated Command Center Settings page. Add/Edit uses a modal with Link Name above URL and Cancel/Save Link. Delete requires confirmation. Empty, busy, success and error states are present.
- Sidebar and settings use the same collection and row component. Drag handles support mouse and touch. Move Up/Down provide keyboard-accessible alternatives. Dropping writes once; failure restores the prior order. Buttons and link navigation do not start dragging.
- Required names/URLs, HTTP/HTTPS schemes, credential-free URLs, canonical duplicate URLs, unique IDs and the existing twenty-link limit are validated. No manufacturer links are automatically installed.
- Links are fetched only when needed, shared in memory within the authenticated account/organization scope, and updated after successful writes. No new polling, persistent browser link cache, heavy drag dependency or iframe preloading was added.
- Walker Browser mounts one selected iframe and retains an ordinary external-browser fallback. It cannot override another site's embedding or authentication restrictions.
- Customer Information shows only saved buyer contact fields and the existing co-buyer name, with individual intentional Copy actions. It does not invent co-buyer contacts or split names absent from the schema. No new customer persistence is introduced. Successful saves update the projection; failed saves do not. Selection changes, reset, session expiry and logout clear it, and stale asynchronous responses cannot replace the current deal's data.

## Authorization, persistence and concurrency

The API verifies the authenticated user, profile, current organization assignment and active organization on the server. Reads and writes target that user's settings row and the currently assigned organization's collection. Client-supplied user or organization overrides cannot select another consultant's collection. Other organization collections remain stored and become available again after an authorized assignment switch.

Link-set versions reject stale clients. A conditional `updated_at` write protects the whole settings row against concurrent updates; the ordinary Consultant Setup settings endpoint uses the same guard and preserves link collections. Failed conflicts are reported with an explicit reload/retry path. Existing user-settings RLS and administrative policies are unchanged; caller-only API behavior is not a promise against authorized database/system administration.

No database changes are needed. No migrations were executed. Existing browser workflow storage, temporary Supabase deals and the existing 24-hour paperwork lifecycle are retained. The new contact-copy projection is memory-only and does not extend retention.

## Files changed in this implementation

| Files | Purpose |
| --- | --- |
| `app/(app)/consultant-setup/page.tsx`; `app/(app)/consultant-links/settings/page.tsx` | Dedicated setup and shortcut-management routes. |
| `app/(app)/layout.tsx` | Shared Command Center provider; setup navigation replaces drawer mounting. |
| `components/command-center/workspace-shell.tsx`; `workspace.module.css` | Setup-first hierarchy, nested shortcuts, customer accordion, desktop collapse and mobile scrolling. |
| `components/workflow/settings-drawer.tsx`; `consultant-setup.module.css` | Reuse existing setup fields as a full page, with shortcut-settings navigation. Legacy source filename retained. |
| `components/consultant-links/command-center-context.tsx`; `link-data.ts` | One scoped collection, request coalescing, mutation feedback, versioned persistence and rollback. |
| `components/consultant-links/link-dialog.tsx`; `link-rows.tsx` | Accessible native modals and reusable compact draggable rows/actions. |
| `components/consultant-links/links-nav.tsx`; `links-editor.tsx`; `links-workspace.tsx`; `links.module.css` | Lazy accordion, full settings page, existing embedded browser and responsive styling. |
| `lib/consultant-links.ts`; `app/api/consultant-links/route.ts` | URL/list validation, owner/organization isolation, removal of default/shared fallbacks and concurrency checks. |
| `app/api/me/settings/route.ts` | Conditional updates prevent setup saves from overwriting simultaneous link changes. |
| `lib/customer-copy.ts`; `components/command-center/customer-copy-panel.tsx`; `customer-copy.module.css` | Allowlisted saved-contact projection and individual copy controls. |
| `lib/deals.ts`; `lib/supabase-browser.ts`; `components/auth/supabase-session-gate.tsx` | Publish only confirmed saved/authorized deal data; clear and invalidate private state across lifecycle changes. |
| `tests/command-center.cjs`; `tests/customer-copy.cjs` | Endpoint isolation/concurrency, URL validation, saved-only projection and stale-response tests. |
| `tests/auth-gate-recovery.cjs`; `tests/supabase-transport.cjs` | Update isolated module fixtures for session cleanup import. |
| `scripts/verify-command-center.cjs`; `scripts/verify-browser-smoke.cjs`; `scripts/verify-board-contracts.cjs` | Synthetic interaction checks and updated versioned link fixtures. |
| `docs/review/NEXTDOX-command-center-report.md`; `NEXTDOX-startup-optimization-report.md` | Current findings and corrections to earlier descriptions. |

Other uncommitted files belong to the preceding startup optimization and are inventoried in its report. They were preserved.

## Verification

- Node test suite: **89 passed, zero failed**. Includes owner-only deal reads, private shortcut collections, organization switching, stale-write rejection, rejected unsafe/duplicate URLs, ordering and saved-contact lifecycle guards.
- TypeScript check and optimized production build: passed.
- Account and board authorization contract scripts: passed against isolated fixtures.
- Targeted ESLint: no errors; two existing unread-provider hook warnings. The separate pre-existing `routine-planner.tsx` apostrophe lint issues remain outside this change.
- Desktop and mobile Command Center browser checks: passed. Covered full-page setup, accordion access, modal CRUD/cancel/validation, keyboard action controls, mouse and actual touch dragging in both lists, failed-order rollback, refresh persistence, organization switching, one embedded fixture frame, desktop collapse, saved contact copying, successful/failed save behavior and clearing on deal switch. No page exceptions or horizontal overflow were found.
- Startup regression: administrator and consultant each made five initial API requests. Fresh cached return navigation made zero board requests, appearance reload made zero appearance requests, and eight-hour inactivity expired authentication before protected requests. Explicit sign-in returned to Consultant View. Synthetic development timings are not production speed guarantees.
- Existing mobile smoke sweep at 390×844 passed Messenger send/unread, Sale Commander restore/schedule editing, Honda training readability, payoff account/per-diem population, individual print and Print All spies, plus 23 routes.
- **Desktop broad sweep failed its contrast assertion** at `/documents/buyers-guide/reverse`: the existing “Last 8” VIN toolbar label had contrast approximately 1.15 against its background. The run stopped there, so subsequent desktop routes in that run were not verified. The legally reviewed Buyers Guide and all document templates remain unchanged. This concern is reported for separately authorized review rather than silently changing protected paperwork.

All browser data, accounts, endpoints and embedded pages were synthetic fixtures. There were no real customer records, production authentication tests, third-party sign-ins, physical printer tests or 300-employee production capacity tests. Existing manifest support remains; actual Chrome installation was not tested and no offline authenticated cache was introduced.

## Remaining issues and review readiness

The implementation builds and is ready for local code review. Review the protected-page toolbar contrast separately before claiming that every page passes contrast checks. Real-device staging checks, employer authorization for broader use and third-party embedding compatibility remain necessary. Existing live policies and production capacity were not certified by these tests. No deployable infrastructure or database change is required for this feature.

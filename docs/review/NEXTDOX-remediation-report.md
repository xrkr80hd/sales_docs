# NEXTDOX remediation and performance report

Date: October 23, 2026. Source baseline: d6124c09e15cff907d07eec11cc926ea49476512 (xrkr80hd/sales_docs main). Local synthetic verification only. No production data was created, changed, deleted, or inspected. No database migration or infrastructure change was executed.

## Actual workflow

Unified Input Screen updates shared WorkflowData. Browser session storage supplies the document screens and previews; optional saved deals persist workflow JSON and signatures in Supabase for authorized retrieval. The document library exposes individual print routes and used/new Print All routes. Manager and F&I queues flag, claim, and review paperwork internally. This is enter-once form preparation and printing; no inspected route pulls credit, originates a loan, processes payments, or transfers credit applications to DriveCentric/RouteOne. Accounts, boards, performance tools, public consultant cards, links, and employee messaging have separate data paths.

## Loading and visibility findings

Confirmed in source: the original Messenger directory waited for a count request for every authorized conversation. The client refreshed the full directory every 15 seconds and on every visible message event, including when unrelated rooms changed. A successful send then waited for history, read marking, and the directory before clearing busy state. The dashboard also requested the full directory for its unread badge. Settings/branding/board readers requested large JSON objects containing unrelated content; two dashboard board components could request the same board simultaneously. The whole shell rerendered every second for its clock.

Changes: directory and counts are separate; only the selected room loads history and subscribes to message changes. A single shared unread provider supplies the profile-adjacent header badge, dashboard, and Messenger counts for every authorized role. RLS-filtered realtime events debounce a lightweight count refresh; fallback summaries run every 60 seconds; open-room history retains a 15-second visible fallback. Read markers are sent once per newly displayed latest message. Sending renders the server-confirmed message immediately and releases busy state without another directory request. Starting a DM opens its returned ID without waiting for directory reload. History and summary service reads are constrained to room IDs authorized first through caller-scoped RLS; message visibility rules and retention remain unchanged. Counts have concurrency bounded to four and never block the directory. Identical concurrent GETs coalesce per token and request options, and are forgotten on settlement. All mutations retain explicit requests without automatic retry.

The Honda screenshot corresponds to a separate, confirmed visibility defect: hard-coded white text on light organization panels. Organization-specific screen overrides are disabled in favor of one central Walker palette. Training accordion content uses semantic foreground/muted colors and native hidden state. Shared colors cover the Messenger too. Existing organizations, names, badges, saved theme preferences, and assignments are preserved for later individual theme work. Screen-only preview control colors do not alter printed paper. A pre-existing unscoped disabled-fieldset selector also failed the webpack CSS Modules compiler; it is now scoped to the settings drawer.

These source findings do not prove the root cause of the reported production case where no calls leave the browser. No live slowdown benchmark or infrastructure outage diagnosis is claimed. Supabase/Vercel health was not challenged or altered. Browser fixture tests verify that the changed client initiates its expected requests and renders their responses.

## Schedule and notification additions

Sale Commander now saves the default Mon/Wed-early or Tue/Thu-early pattern per account, with the reverse days late. The pattern is weekday-based rather than alternating unpredictably with calendar-week parity. Friday defaults to noon finish; alternating Saturday settings remain available. Each selected date can be saved as early, late, noon finish, or off, with editable activity times, for shift swaps. Saved date-specific custom routines remain intact unless the user explicitly generates the sample week. Sunday/holiday exclusions remain. Header unread counts link to Messenger, reset a successfully read room locally, and share one count provider rather than duplicating directory loading on every page.

A final build exposed an intermittent Google Fonts fetch failure. The existing Barlow and IBM Plex Mono families/weights are now self-hosted under public/fonts, with their licenses. No typography redesign or dependency change was made.

## SSN removal and legacy handling

Removed socialSecurityNumber from WorkflowData, defaults, normalization, and the printable payoff field. Unified Input had no matching SSN collection field in this baseline. Workflow normalization is an explicit allowlist. A recursive structural sanitizer removes SSN/social-security key aliases from nested legacy objects, section flags, saved signatures, and checklist-note persistence. Browser workflow loading rewrites obsolete properties without resetting its existing creation timestamp. Deal create/update APIs normalize untrusted workflow payloads; list, individual load, and manager/F&I queue responses sanitize historical workflow objects. The browser deal writer also normalizes before serialization. Sensitive rejected values are never logged by the new paths.

Names, contact details, vehicle/trade data, lienholders, account numbers, payoff amounts, per diem, verification fields, and deal numbers remain. Structural sanitization cannot identify an SSN intentionally typed into an unrelated free-text value; the disclosure prohibits doing so. Direct authenticated Supabase writes are a separate residual path because the existing database allows owner writes to JSON; no production constraint or trigger was installed. An authorized review of a database-level guard is recommended.

Historical cleanup may be necessary because old clients and stored rows could contain the former field; this is a potential exposure, not a claim that production SSNs exist. docs/review/legacy-ssn-cleanup.sql prepares an aggregate-only assessment and a commented targeted update. It was not executed. The draft defaults to rollback and warns that the updated_at trigger could interact with an externally configured retention job. Backups require separate handling.

## Data lifecycles and retention discrepancy

| Category | Source behavior / limits |
|---|---|
| Active saved deals | Supabase deals rows with status=open; manual owner deletion is available. No checked-in active-deal 24-hour server deletion predicate was found. |
| Finished deals | Finish endpoint sets status=finished and finished_at. Checked-in cleanup_expired_deals deletes these after eight hours, not 24. The cron.schedule example in migration 004 is commented out. F&I review completion only stamps fni_finished_at and does not itself set status=finished. |
| Browser paperwork session | sessionStorage workflow/signatures/notes and deal ID. A 24-hour created-at check clears these when relevant storage helpers are next accessed. Explicit new/finish cleanup also clears workflow session and broadcasts clearing to other open tabs. Closing a tab is not a server deletion operation. |
| Accounts and preferences | Supabase Auth, profiles, user_settings, organization memberships; browser login and some consultant preferences use localStorage. Separate from paperwork expiry. |
| Dashboards/performance | Sales Commander in consultant_info; shared manager boards in dealer_info; no automatic 24-hour deletion found. |
| Messenger | Server conversation/message/participant records. Own edit/soft-delete paths and permissions are separate; no 24-hour auto-expiry found or added. |
| Notifications | Routing rows reference deals with ON DELETE CASCADE. Existing rows can contain customer name/vehicle text; new messages now use minimal paperwork status and employee/deal context. Manager-board events are separate performance records. No universal 24-hour notification expiry. |
| Backups | Provider configuration and restore retention are not established in this repository. Live-row deletion does not establish backup deletion. |

Trav reports the deployed 24-hour server deletion is operational and verified. That operational statement and this repository differ. No deletion mechanism was changed. Before making a more specific server-retention promise, reconcile the deployed function definition and scheduler with source using authorized read-only evidence. Proposed correction: version the verified deployed policy in source after review; do not silently replace a working job with the eight-hour example or install a second cleanup job.

## Security verification and remaining risks

Confirmed source controls: deal list/save/load/delete APIs authenticate the bearer token and constrain ordinary consultant records by user_id. Queue APIs validate manager/F&I role and constrain owners through dealOwnerScope; district/admin exceptions are explicit. The latest checked-in deal/notification RLS migration scopes manager/F&I reads by organization. Messenger caller-scoped RLS checks access to a conversation before history or mutation; a role alone does not authorize arbitrary direct messages. Organization channels and Management Chat have separate permission predicates; administrator DM access is participant-based. No surveillance capability was added. The service key is read in a server-only module from SUPABASE_SERVICE_ROLE_KEY; no NEXT_PUBLIC service-role export was found in the inspected source. New logs contain no message or workflow values. Existing customer notification copies are minimized for future notifications without changing routing.

Limits: these are source and in-memory authorization checks, not production penetration tests. Current deployed policies, grants, scheduler, backups, compiled environment bundles, and database query plans were not inspected. RLS SQL tests were not run against production; their existing fixtures mutate account/organization rows even though they roll back, so they were deliberately not used on live data. Old direct-write policies do not enforce the new API JSON sanitizer. Some legacy API error responses return database error.message; reviewing those separately for production diagnostics minimization is recommended. Database/provider service operators remain a separate authorization boundary from in-app DM permissions.

## Legal scope and approvals

Louisiana R.S. 51:3073 defines the combinations covered as statutory personal information; names/contact information alone are not automatically every element of that definition. R.S. 51:3074 addresses reasonable security, disposal, and breach response when applicable. Removing SSN fields reduces unnecessary collection; it does not eliminate confidentiality obligations for remaining records. Official sources: https://www.legis.la.gov/Legis/Law.aspx?d=322029 and https://legis.la.gov/Legis/LawPrint.aspx?d=322030 .

The FTC's dealer-specific Privacy/Safeguards guidance distinguishes ordinary purchase/contact records from customer information obtained in arranging financing. NEXTDOX's form-preparation functionality alone is not evidence of loan origination. However, a covered dealership's obligations may still apply to customer information it handles through service providers or internal tools. Counsel/employer security leadership should determine the covered information and required organizational controls. Sources: https://www.ftc.gov/business-guidance/resources/automobile-dealers-ftcs-safeguards-rule-frequently-asked-questions and https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know .

No complete legal certification or formal company approval is claimed. Broader production authorization, branding permission, approved confidentiality/messaging policy, incident-response responsibility, and provider/backup retention remain employer/legal decisions. The acknowledgment is browser/version/time only; it is not evidence of an email-linked consent record or company authorization.

## Protected documents

All Buyers Guide source files, front/reverse wording, styles, fields, and print format are unchanged from the baseline. Only the payoff SSN field was removed, with its second-column space retained. No other printable document template was edited. The used Print All screen now disables its action while settings are preparing, instead of silently ignoring an early click; no form content or printed formatting changed. The central screen theme and print-preview toolbar scope are excluded from print styling; printed paper retains its own CSS.

## Files changed

| File | Reason |
|---|---|
| app/(app)/layout.tsx | Mount one shared unread-count provider for header, dashboard, and Messenger. |
| app/(print)/layout.tsx | Display-contents wrapper scopes screen preview toolbar colors; printed paper unchanged. |
| app/api/consultant-links/route.ts | Project only required JSON fields rather than unrelated profile, media, branding, or board content. |
| app/api/deals/[id]/route.ts | Sanitize workflow reads/writes and legacy SSN properties; preserve payoff, trade, and ownership checks. |
| app/api/deals/[id]/send-fni/route.ts | Stop copying customer names and vehicle descriptions into new routing notifications; preserve routing. |
| app/api/deals/[id]/send-sm/route.ts | Stop copying customer names and vehicle descriptions into new routing notifications; preserve routing. |
| app/api/deals/[id]/sm-finish/route.ts | Stop copying customer names and vehicle descriptions into new routing notifications; preserve routing. |
| app/api/deals/route.ts | Sanitize workflow reads/writes and legacy SSN properties; preserve payoff, trade, and ownership checks. |
| app/api/fni-queue/route.ts | Sanitize workflow reads/writes and legacy SSN properties; preserve payoff, trade, and ownership checks. |
| app/api/manager-board/route.ts | Project only required JSON fields rather than unrelated profile, media, branding, or board content. |
| app/api/manager/sale-commander/route.ts | Project only required JSON fields rather than unrelated profile, media, branding, or board content. |
| app/api/me/route.ts | Project only required JSON fields rather than unrelated profile, media, branding, or board content. |
| app/api/me/sale-commander/route.ts | Project only required JSON fields rather than unrelated profile, media, branding, or board content. |
| app/api/me/settings/route.ts | Project only required JSON fields rather than unrelated profile, media, branding, or board content. |
| app/api/messenger/route.ts | Directory no longer waits for unread counts; separate bounded summary; authorize room before indexed message read; return saved message. |
| app/api/sm-queue/route.ts | Sanitize workflow reads/writes and legacy SSN properties; preserve payoff, trade, and ownership checks. |
| app/globals.css | One shared Walker palette, accessible status/link/focus colors, and screen-only print-control contrast. |
| app/layout.tsx | Load the existing Barlow and IBM Plex Mono fonts locally; no external font build requests. |
| components/auth/disclosure-gate.tsx | Truthful versioned browser acknowledgment and complete revised disclosure. |
| components/auth/required-password-change.tsx | Visible-only 60-second account recheck; every server request still validates session/password requirement. |
| components/command-center/routine-planner.tsx | Switch weekly early/late pattern; save per-date early/late/noon/off overrides and editable activity times. |
| components/command-center/sale-commander.tsx | Technical audit and review evidence. |
| components/command-center/sales-commander-stats.tsx | 60-second safety polling with focus/event/realtime refresh retained. |
| components/command-center/use-shared-board.ts | 60-second safety polling with focus/event/realtime refresh retained. |
| components/command-center/workspace-context.tsx | All organization screens inherit central CSS; saved theme choices and icons preserved. |
| components/command-center/workspace-shell.tsx | Clock updates isolated from shell; slower visible-only district notification polling. |
| components/command-center/workspace.module.css | Technical audit and review evidence. |
| components/documents/all-print-screen.tsx | Show preparing state and disable Print All until settings resolve; printable forms unchanged. |
| components/documents/payoff-form-sheet.tsx | Remove only SSN label/input; preserve empty second column and all other form geometry. |
| components/messenger/organization-messenger.module.css | Open-room-only history/realtime; decoupled counts, immediate saved-send acknowledgment, unified shared palette. |
| components/messenger/organization-messenger.tsx | Open-room-only history/realtime; decoupled counts, immediate saved-send acknowledgment, unified shared palette. |
| components/messenger/unread-context.tsx | One authenticated, RLS-scoped count subscription/poll with role-independent header totals and read clearing. |
| components/workflow/cheat-sheet-screen.tsx | Readable text colors and native hidden accordion panels; removed opacity/max-height masking. |
| components/workflow/consultant-setup.module.css | Scope disabled-fieldset CSS to its drawer; fixes CSS Modules pure-selector error. |
| components/workflow/dashboard-screen.tsx | Lightweight Messenger summary every 60 seconds rather than full directory every 15 seconds. |
| docs/review/NEXTDOX-remediation-report.md | Technical audit and review evidence. |
| docs/review/legacy-ssn-cleanup.sql | Review-only historical cleanup proposal: counts only, update commented out, rollback default; not executed. |
| lib/deals.ts | Sanitize workflow reads/writes and legacy SSN properties; preserve payoff, trade, and ownership checks. |
| lib/disclosure.ts | Truthful versioned browser acknowledgment and complete revised disclosure. |
| lib/organization-branding.ts | Project only required JSON fields rather than unrelated profile, media, branding, or board content. |
| lib/organization-theme.ts | All organization screens inherit central CSS; saved theme choices and icons preserved. |
| lib/request-json.ts | Coalesce only simultaneous identical GETs, scoped by token/path/options; no completed-response cache or mutation retries. |
| lib/routine-schedule.ts | Normalize per-account early-day choice and map Mon–Thu explicitly, avoiding calendar parity drift. |
| lib/walker-workflow.ts | Remove SSN model/default/normalization; strip legacy alias keys and sanitize browser loads/saves without extending retention. |
| public/fonts/barlow-400.woff2 | Self-hosted original typeface weight or its distribution license; eliminates Google Fonts build dependency. |
| public/fonts/barlow-500.woff2 | Self-hosted original typeface weight or its distribution license; eliminates Google Fonts build dependency. |
| public/fonts/barlow-600.woff2 | Self-hosted original typeface weight or its distribution license; eliminates Google Fonts build dependency. |
| public/fonts/barlow-700.woff2 | Self-hosted original typeface weight or its distribution license; eliminates Google Fonts build dependency. |
| public/fonts/barlow-800.woff2 | Self-hosted original typeface weight or its distribution license; eliminates Google Fonts build dependency. |
| public/fonts/barlow-LICENSE.txt | Self-hosted original typeface weight or its distribution license; eliminates Google Fonts build dependency. |
| public/fonts/ibm-plex-mono-400.woff2 | Self-hosted original typeface weight or its distribution license; eliminates Google Fonts build dependency. |
| public/fonts/ibm-plex-mono-500.woff2 | Self-hosted original typeface weight or its distribution license; eliminates Google Fonts build dependency. |
| public/fonts/ibm-plex-mono-600.woff2 | Self-hosted original typeface weight or its distribution license; eliminates Google Fonts build dependency. |
| public/fonts/ibm-plex-mono-700.woff2 | Self-hosted original typeface weight or its distribution license; eliminates Google Fonts build dependency. |
| public/fonts/ibm-plex-mono-LICENSE.txt | Self-hosted original typeface weight or its distribution license; eliminates Google Fonts build dependency. |
| scripts/verify-account-contracts.cjs | Synthetic regression/browser coverage or projection-aware in-memory test adapters. |
| scripts/verify-board-contracts.cjs | Synthetic regression/browser coverage or projection-aware in-memory test adapters. |
| scripts/verify-browser-smoke.cjs | Synthetic regression/browser coverage or projection-aware in-memory test adapters. |
| tests/loading-regressions.cjs | Synthetic regression/browser coverage or projection-aware in-memory test adapters. |
| tests/messenger-api.cjs | Synthetic regression/browser coverage or projection-aware in-memory test adapters. |
| tests/privacy-remediation.cjs | Synthetic regression/browser coverage or projection-aware in-memory test adapters. |
| tests/routine-schedule.cjs | Synthetic regression/browser coverage or projection-aware in-memory test adapters. |
| tests/theme-contrast.cjs | Synthetic regression/browser coverage or projection-aware in-memory test adapters. |

## Complete revised agreement

Version: 2026-10-23.1. Title displayed: Terms of Use / Disclosure & Acknowledgment. Button: I Agree — Continue. Footer: By clicking “I Agree — Continue” you confirm that you have read, understood, and agree to the terms outlined above.

### Purpose and development

NEXTDOX is an internal dealership paperwork preparation, sales productivity, and employee communication application. It was independently developed to reduce repetitive data entry: enter information once, populate the required forms, preview, print, and process them through established dealership procedures. Its availability does not establish formal approval of the entire application by Walker Automotive leadership, IT, or legal counsel, or certification as a financial product.

### Customer information

The paperwork workflow temporarily processes customer names, contact information, mailing and physical addresses, vehicle information, trade-in details, lienholder and payoff information, trade-loan account numbers, and other information needed for the printable forms. Do not enter Social Security numbers, credit applications, account passwords, or unnecessary sensitive information, including in free-text fields or employee messages. NEXTDOX is not designed to collect Social Security numbers.

### Financial systems and signatures

NEXTDOX does not run credit applications, pull credit reports, perform credit inquiries, approve or deny financing, originate loans, process payments, or transmit credit applications to lenders. Internal manager and F&I routing supports paperwork review only. DriveCentric and RouteOne operate independently; NEXTDOX does not automatically transfer financial records to them. Documents are prepared for printing. Required physical signatures and established dealership F&I procedures still apply.

### Storage and access

Workflow information, document notes, and any saved signature information may be kept in browser session storage. Temporary saved deals are also stored on Supabase servers and can be retrieved through authorized access. Information does not remain exclusively on your device. Authentication sessions and some employee preferences use browser local storage; Supabase also stores employee accounts, settings, sales performance information, messages, and administrative records. Use only authorized accounts and devices.

### Temporary paperwork and deletion

NEXTDOX is a temporary paperwork workspace, not a permanent customer document archive. Browser workflow information expires after 24 hours when the workflow storage is next accessed and may be cleared through the application. Saved server deals have a separate cleanup process; finishing a deal marks it for cleanup rather than immediately deleting it. Authorized users can manually delete their own saved deals. Do not assume that closing a tab deletes the saved server copy. Employee accounts, preferences, Messenger messages, administrative settings, and performance history do not share the temporary paperwork lifecycle. Backup retention is managed separately by the hosting provider and system administrator; deletion of a live record does not establish immediate deletion from backups.

### Printed documents and accuracy

Review populated forms for accuracy and completeness before printing, signing, or submitting them. Printed documents and any downloaded or otherwise exported copies must be handled through established dealership procedures. Official recordkeeping and legally required retention take place outside NEXTDOX where applicable. NEXTDOX does not replace dealership signature requirements or official financial systems. These terms do not waive legal protections that cannot be waived or claim that Walker Automotive has waived responsibility.

### Employee Messenger

Organization Consultant Chat is available to users authorized for that organization and channel. Management Chat is restricted to authorized management roles and channel permissions. Direct messages are limited by the application to their authorized participants; a manager or administrator does not receive access to a direct message simply because of their role. Administrators manage Messenger permissions and may access organization channels under their authorized role. Messages are stored on the server. Do not treat employee messaging as absolutely private: authorized system operators may have infrastructure access for legitimate administration, security, or legal purposes. Keep customer paperwork and unnecessary sensitive information out of messages.

### User responsibilities

Use NEXTDOX only for authorized dealership work and access only information permitted by your role and organization. Protect passwords, do not share credentials, secure printed paperwork and exported copies, and sign out on shared devices. Do not disclose customer information to unauthorized people. Promptly report suspected unauthorized access, lost paperwork, or security incidents to dealership management or the designated system administrator. Follow applicable dealership confidentiality and data-handling procedures.

### Acknowledgment and branding

Selecting I Agree records this disclosure version and an acceptance timestamp in this browser's local storage for up to 72 hours. This is a browser acknowledgment, not a server-side record linked to your authenticated email or proof of employer authorization. A new version requires acknowledgment again. If browser storage is unavailable, acknowledgment lasts only for the current page session. Walker Automotive branding belongs to its respective owners; its display does not itself establish corporate approval of NEXTDOX.

## Validation

- `node --test tests/*.cjs`: 62 passed, zero failed. Covers auth/loading, Messenger permissions and count isolation, SSN removal and legacy browser/API sanitation, retention, disclosure version/TTL, concurrent GET isolation, theme contrast, and weekday schedule orientation.
- `node scripts/verify-account-contracts.cjs`: passed using in-memory accounts only.
- `node scripts/verify-board-contracts.cjs`: passed using in-memory organizations, boards, queues, and contacts only.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed with locally bundled fonts; an earlier run failed only while fetching Google Fonts, now removed as a build dependency.
- `git diff --check`: passed.
- Browser checks: mobile 390×844 and desktop 1440×1000 exercised chat opening/sending, header badge and read clearing, saved schedule pattern and date edits, Sale Commander restoration, disclosure, Honda training visibility, and payoff account/per-diem preservation with SSN absent. A 23-route sweep per viewport covers dashboard, deals, training, document library and document screens, used/new workflows, links, cards, collage, manager/office/statistics views, administration, district view, and used/new Print All. The contrast sweep detects near-background text; it is not a full accessibility certification. Final sweep passed on both viewports with zero page errors and no near-background text found in the tested visible content. The header width check, unread badge clearing, pattern reload, date-override save, individual print action, and both Print All actions also passed.
- Print Form and Print All use a synthetic window.print spy; no physical printer or OS print dialog was tested.
- No production sign-in, customer-data, database-RLS, cron, backup, load, or penetration test was performed. Existing SQL RLS fixtures were not executed on production.

## Release readiness

Code is ready for technical review when the recorded final build and checks pass. Live consultant service behavior and production latency cannot be certified from mocked tests. No migration, customer cleanup, or infrastructure change is part of this code release. Trav explicitly authorized pushing the fixes in the ongoing session; this report itself does not authorize database cleanup.

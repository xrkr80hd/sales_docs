# NEXTDOX consultant-first startup and browser caching

## Result and measurements

Explicit password sign-in opens `/dashboard` (Consultant View), including for administrators. Real administrative permissions remain available through Role Views and Administration. Direct authenticated document/role links remain supported.

A controlled local browser comparison with synthetic data captured 11 startup API requests before versus 5 after for administrators; consultants went from 10 to 5. This used the Next.js development server and 100ms synthetic API latency, including development effect replay. It measures request reduction, not production speed or capacity for 300 simultaneous employees. Full request traces are in `NEXTDOX-startup-metrics.json`.

The five current requests are account verification, consultant board, deal summaries, optional appearance (delayed), and unread counts (delayed). No district boards, administration, workspace directory/queues, Consultant Links, full settings, card editor, or Sale Commander API loads on the default dashboard. Return navigation reused the fresh in-memory board with zero board requests. Reload reused cached appearance with zero appearance requests while still verifying access on the server.

The source did not mount every role simultaneously. Confirmed waste was the shell's background district-board fetch, repeated board subscriptions/polls, eager link prefetch, global settings/link loading, broad board reads, and full deal workflows/signatures for a summary list.

## Data and loading changes

- `app/(app)/layout.tsx`: paperwork settings sync only mounts on document/deal-sheet routes; Consultant Setup now loads as its own `/consultant-setup` page when selected (see the subsequent Command Center report).
- `app/(app)/team-board/page.tsx`: one consultant board provider supplies both panels.
- `components/workflow/dashboard-screen.tsx`: consultant board provider shared by pace/team panels; disables eager navigation prefetch; reads deal summaries and fetches one complete deal only on Resume, preserving all form/signature fields.
- `components/command-center/consultant-board.tsx`: consultant-only bundle extracted from the manager editor; one request/poll/realtime owner supplies both panels.
- `components/command-center/team-board.tsx`: retains the manager editor outside the consultant bundle.
- `components/command-center/use-shared-board.ts`: short-lived, coalesced account/token/organization/role/view-scoped memory cache; mutation invalidation and forced refresh for writes/live events; visible-only polling with jitter. Cache values do not authorize server requests.
- `components/command-center/workspace-shell.tsx`: removes the full district-board poll from the global shell; district badge updates come from the opened district view. Consultant navigation is the default; manager navigation appears in its selected workspace. Navigation does not prefetch every linked view. The clock updates at minute boundaries rather than every second.
- `components/command-center/role-view.tsx`: dynamically imports dashboard/manager code; only selected role requests run; independent district reads run concurrently; no overlapping or hidden-tab polling.
- `components/command-center/workspace-context.tsx`: immediately uses freshly verified identity; optional appearance is delayed and cached separately from identity/permissions. Profile update events invalidate appearance.
- `components/consultant-links/link-data.ts`, `links-nav.tsx`: links load only when opened; a single account/organization-scoped provider supplies the current collection and successful mutations; no eager linked-page prefetch.
- `components/messenger/unread-context.tsx`: initial summary starts after the main dashboard has rendered; existing shared realtime unread behavior retained.
- `components/workflow/document-drawer.tsx`: document links load when selected rather than being prefetched by navigation.
- `lib/dealer-consultant.ts`: successful paperwork settings reads share a five-minute memory cache; successful saves invalidate it. No new customer-workflow cache is created.
- `lib/deals.ts`, `app/api/deals/route.ts`: summary mode selects only identifiers/timestamps plus customer display name, vehicle display fields and deal type; it excludes full workflows and signatures. Full authorized deal reads still supply Resume. Reads have request deadlines.
- `app/api/manager-board/route.ts`: consultant mode uses the account's assigned organization, one projected month of board JSON and its own proposal, even for administrators. It excludes manager event/gross/history responses. Existing manager/district endpoints and write permissions remain intact. Board/deal read work follows caller cancellation and an overall deadline.
- `lib/client-resource-cache.ts`: memory-only TTL cache, scoped keys, concurrent-read coalescing, bounded entries, explicit invalidation, and protection against late requests repopulating a cleared cache.
- `lib/workspace-appearance-cache.ts`: only profile/icon URLs and the icon visibility flag are allowed in the five-minute browser session appearance cache. It excludes role, identity authority, tokens, workflow, messages, and performance data. This is separate from customer paperwork storage and expiry.

Browser/Next.js asset caching remains in place. No service worker or offline authenticated application was introduced. Live boards, changed settings, permissions and unread messages must still refresh; they cannot safely be loaded once forever.

## Eight-hour inactivity

`lib/browser-activity.ts`, `lib/supabase-browser.ts`, and `components/auth/supabase-session-gate.tsx` enforce eight hours without activity in this browser. Reload does not bypass an expired timestamp. An expired stored login is removed before the Supabase client can restore it or send protected account requests. Live sessions are checked periodically and on return; typing, pointer/scroll interaction and visible focus record activity with throttled storage writes. Other active tabs share the browser activity timestamp. A browser that is suspended enforces expiry when it resumes.

Expiry clears the browser authentication token and private in-memory response cache, and stops automatic refresh. Fresh sign-in is required. Static assets and safe appearance caching remain available. This is browser-session enforcement, not a claim that all issued JWTs have been revoked server-side or that all devices have been signed out. The existing 24-hour customer paperwork lifecycle is unchanged.

`lib/disclosure.ts` updates the version and describes the browser cache and inactivity behavior accurately. Authentication is rechecked rather than granted through cached appearance metadata.

## Verification and scope

- 77 Node tests passed, including cache partitioning/expiry/invalidation, 300 simultaneous callers coalescing a single resource inside one client cache, actual SDK auth timeout/retry, login default routing, eight-hour timestamp rules, summary field minimization, and assigned-organization consultant response/privacy. This is not a 300-employee server load test.
- Account and board contract scripts passed with isolated fixtures.
- TypeScript and production build passed.
- Targeted ESLint: no errors, two existing unread-provider hook warnings. A broader component lint scan also found two existing unescaped-apostrophe errors in `routine-planner.tsx`; that file was not changed in this task.
- Synthetic browser tests passed for admin and consultant startup, fresh-cache return navigation, appearance reload, expired-login removal before protected requests, and explicit sign-in returning to Consultant View.
- Existing mobile 390x844 and desktop 1440x1000 browser sweeps passed: Messenger send/unread, Sale Commander restore/schedule edits, consultant/manager/admin/district pages, form population, payoff account/per-diem preservation, individual print and Print All via print spies. Those earlier sweeps included 23 additional routes. A later desktop rerun found a low-contrast VIN label in the protected Buyers Guide reverse-page toolbar; see the Command Center report. That later finding supersedes the earlier all-clear for text contrast. These were synthetic tests, not real customer/employee operations or physical-printer tests.
- Legally reviewed Buyers Guide and all document templates unchanged. No production database writes, policy changes, migrations, infrastructure changes, commits, pushes, or deployments performed for this task.

Production provider outages and database capacity cannot be fixed or certified by browser caching. A controlled staging capacity test and real-device timing remain necessary before claiming readiness for 300 simultaneous employees.

The subsequent Command Center work reuses the existing embedded-link page and moves Consultant Setup to the first sidebar item. See `NEXTDOX-command-center-report.md` for its changes and the latest regression findings.

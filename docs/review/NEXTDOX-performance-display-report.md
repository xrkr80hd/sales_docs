# NEXTDOX Manager Board consolidation

Date: October 24, 2026. Scope: the attached Manager Board specification and subsequent directions to show every consultant, compact objectives and totals at a glance, with a modest popout. Explicit authorization was given to push all completed changes, including the preceding local startup and Command Center work.

## Audit and architecture

Both `/manager-board` and `/office-display` previously rendered `ManagerBoard` in `team-board.tsx`. Its office flag removed editing but retained the oversized, sixteen-plus-column management table, annual cards, schedules and messages. It was not a separate data model. The manager and sidebar each offered an Office Display entry/popout link, duplicating navigation.

The authoritative store remains `user_settings.dealer_info.managerBoards[organizationId:YYYY-MM]` owned by the existing protected master account. Consultant proposals remain in their existing `consultant_info.monthlyProjections` records. Existing API authentication, assignment checks, district overrides, version checks, conditional writes, projection confirmation/locking, change reasons and district notifications are retained. No database schema, RLS policy, migration or production record was changed.

No separate JSON contract accompanied the text attachment. The explicit text specification and actual source fields were used. Daily production and appointments are manager-owned fields; they have no dependency on Deal Commander activities. They remain in Setup.

## Result

- Consultant Setup stays first in the sidebar. Authorized managers receive one expandable Manager Board group with Setup and Performance Display. The standalone Office Display navigation item is removed.
- `/manager-board` remains Setup. Its existing controls are organized into Monthly Objectives, Consultant Performance & Projections, Team Scheduling & Days Off, Yearly Performance, and Publishing & Communication accordions.
- `/manager-board/display` renders the shared read-only `PerformanceDisplay`. Its Pop Out Display action opens the same component at legacy `/office-display`, requesting a compact **1040×640** window. Legacy display URLs and organization parameters continue working. The selected reporting month is preserved in navigation, copied URLs, reads, saves and popout links.
- The standalone view excludes application navigation, global Messenger loading and notification prompting. It has no editor or mutation action. A normal Open in new tab link provides a popup-blocker fallback.
- New, Used and Combined groups show Goal/Sold, Gross goal/actual, and unit-objective attainment. A compact seven-column table shows every assigned consultant and a totals row. Column headings explicitly wrap. All consultants are rendered; no pagination hides records. More than eight rows can intentionally extend vertically rather than being clipped or silently dropped.
- The display never renders annual figures, schedules, days off, weekly messages, appointment editing, audit events or Deal Commander activities. These are not deleted from storage or authorized management views.

## Calculations and data integrity

Monthly unit and gross totals use the same assigned roster and saved `newSold`, `usedSold`, `newGrossActual` and `usedGrossActual` fields as Setup. Combined goals and actuals are sums. Combined attainment divides combined sold by combined goal, rather than averaging percentages. Zero/invalid denominators show N/A. Legacy monthly gross is used only as the existing fallback when a separate new gross goal is absent.

Saved MTD remains a separate manager metric; it is not silently rewritten to equal new+used sold. “On Pace” retains the existing saved MTD / consultant objective calculation. Projected shows confirmed projection first, then a proposal only where already permitted. Missing proposals display a dash. Totals sum the consultant columns, with aggregate MTD/objective attainment. No production is imported from Deal Commander or counted twice.

The display API uses a narrow selected-month JSON read rather than fetching every organization's board history. It returns only presentation fields, excluding schedules, annual values, appointment fields, messages, audit events and confirmation actor metadata. Ordinary consultants cannot request this manager display; assigned managers cannot override their organization; district/admin oversight and BDM read-only permissions remain intact. Display-mode POST requests are rejected. Underlying authorized manager mutation endpoints remain available only through their existing permissions.

The shared board hook partitions its short-lived in-memory cache by account, token, role, organization, view and month. Successful mutations invalidate related board views. Caller cancellation/deadlines remain. It retains existing broadcast updates and visible-only, jittered polling; adds online/visibility refresh and rejoin refresh; coalesces overlapping reads; and cleans up subscriptions/listeners on unmount. The initial realtime join does not create an extra startup read.

## Files changed for this phase

| File | Purpose |
| --- | --- |
| `app/(app)/manager-board/page.tsx` | Preserve reporting month and reset editor scope on route changes. |
| `app/(app)/manager-board/display/page.tsx` | Embedded presentation route using shared component. |
| `app/(app)/office-display/page.tsx` | Backward-compatible standalone presentation route. |
| `app/(app)/layout.tsx` | Standalone bypasses application shell, Messenger and notification prompt. |
| `components/command-center/team-board.tsx` | Group existing Setup controls, retain handlers, add month selection and display navigation. |
| `components/command-center/performance-display.tsx` | One compact presentation, totals and explicitly launched independent popout. |
| `components/command-center/performance-display.module.css` | Fluid, compact summary/table, wrapped headings and responsive spacing without zoom. |
| `components/command-center/workspace-shell.tsx`; `workspace.module.css` | Consolidated manager navigation and compact embedded-page padding. |
| `components/command-center/use-shared-board.ts` | Month/view partitioning, correct historical save query, reconnect/visibility refresh and mutation invalidation. |
| `lib/performance-display.ts` | Tested monthly display calculations and existing pace adapter. |
| `lib/client-resource-cache.ts` | Scoped board-family invalidation preserves unrelated/account cache. |
| `app/api/manager-board/route.ts` | Narrow read-only display projection and rejection of display-mode mutations. |
| `tests/performance-display.cjs`; `tests/performance-lifecycle.cjs` | Calculation, privacy, permissions, selected-month projection and cache invalidation checks. |
| `scripts/verify-performance-display.cjs` | Synthetic viewport, Setup, all-row, reconnection and independent-popout browser checks. |
| `docs/review/NEXTDOX-performance-display-report.md` | Findings and verified delivery scope. |

The preceding local changes are inventoried in `NEXTDOX-startup-optimization-report.md` and `NEXTDOX-command-center-report.md`. The incoming remote change to secret/generated-file ignore rules was fast-forwarded and preserved before release.

## Verification

- **94 Node tests passed**, zero failed. Includes calculation edge cases, narrow display projection, manager/consultant/BDM isolation, rejected display writes and cross-view cache invalidation.
- TypeScript and targeted ESLint passed without errors.
- Production build passed.
- Account and board authorization contract scripts passed using isolated in-memory fixtures. Existing projection confirmation, locking, reason-required changes, district notification/read behavior, stale-write protection and contact preservation passed.
- Synthetic Playwright display checks passed at **1040×640**, **1366×768**, **1440×900**, **1920×1080**, **3840×2160**, and **390×844**. Eight consultants, compact monthly summary and totals were present. No horizontal or vertical scrolling occurred in the standalone office-sized tests; mobile had no horizontal overflow. A long consultant name was included. Embedded display also fit at 1366×768 after removing oversized page padding.
- Twelve-consultant fixture rendered all twelve records without paging or clipping. For larger rosters, vertical scrolling remains intentional; no claim is made that unlimited rows fit a fixed screen.
- Browser Setup save succeeded and retained schedule, annual gross and appointment fields. Display rendering produced **zero writes**. The only write in the browser scenario was the explicit Setup save.
- Explicit Pop Out Display click opened a new top-level page with the correct organization/month and null opener. Closing the originating page left the popout open; it performed its own subsequent authorized fixture refresh. Online refresh, stale-data error feedback and retry recovery passed. No page exceptions remained.
- The prior protected Buyers Guide reverse-toolbar contrast finding remains reported in the Command Center report. No legally reviewed Buyers Guide or other document template was modified.

All browser accounts, board data and network responses were synthetic. Realtime server infrastructure, production database capacity, physical display hardware, real OS minimize/throttling behavior, browser shutdown and live production authentication were not certified. A popup's exact outer size and window/tab choice remain subject to browser policies. Its own authorization and the existing eight-hour inactivity rule still apply. Browser/OS shutdown closes the presentation.

## Delivery

Implementation and local verification are complete. No infrastructure or database migration is required. The release also includes the previously verified consultant-first startup, caching/inactivity and personal Command Center changes. The final pushed commit and any separately observed deployment status are reported in the conversation; pushing does not itself prove that production deployment has completed.

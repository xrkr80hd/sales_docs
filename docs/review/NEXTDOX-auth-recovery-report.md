# NEXTDOX authentication recovery — October 24, 2026

## Findings

The deployed sign-in message was a UI-only 15-second Promise deadline. It did not cancel the underlying Supabase HTTP operation. Session restoration similarly stopped displaying its spinner after 12 seconds while SDK refresh work could continue. Repeated session retries could queue behind that same work, and an old restoration result could overwrite a more recent authentication event. Rapid submissions were guarded only by React's next render.

Read-only project Auth logs contained 142 request_timeout/504 records in the inspected 24-hour window, as well as 500 refresh-token failures reporting that Auth could not connect to local Postgres and context cancellations. These are project-service failures, beyond the UI timeout. They do not establish a particular capacity or configuration cause.

Supabase's official status page also reports an ongoing Management API incident: https://status.supabase.com/. Management API degradation can explain the failed diagnostic SQL/advisor requests; those failed management requests alone do not prove that Postgres is unavailable to application traffic. It has not been established that this incident caused the project Auth failures.

No production database records, policies, infrastructure, or migrations were changed.

## Changes

- `lib/supabase-fetch.ts`: shared HTTP transport with an eight-second deadline and actual AbortController cancellation for interactive requests, including JSON response-body arrival. Combines caller, request, and deadline cancellation, without adding retries. Preserves a longer 60-second allowance for Storage media uploads. HEAD/no-content responses retain their original handling.
- `lib/supabase-browser.ts`: uses that transport and shares a pending session restoration instead of queueing additional SDK calls on Retry. SDK token storage, cross-tab locking, refresh and authentication validation remain enabled.
- `components/auth/supabase-session-gate.tsx`: guards submissions immediately with a ref; waits for the existing restoration before replacing its session; prevents late restoration results/errors from overriding a newer auth event; consumes the successful sign-in session explicitly and clears the password. Removes the UI-only password deadline because the transport now cancels the request itself.
- `lib/supabase-server.ts`: applies transport deadlines to service-client requests and accepts upstream cancellation. Password-change enforcement is retained.
- `app/api/me/route.ts`, `app/api/me/settings/route.ts`, `app/api/me/sale-commander/route.ts`: stop upstream work on caller cancellation or a ten-second overall request budget.
- `app/api/messenger/route.ts`: applies that budget to both service and caller-scoped clients; reports temporary Auth failure as 503 rather than claiming the session expired. Conversation and message permissions are unchanged.
- `tests/supabase-transport.cjs`: network/body stalls, cancellation, normal responses, actual installed SDK login recovery, and shared session-restoration coverage.
- `tests/auth-gate-recovery.cjs`: submission coalescing, retry, restoration/password serialization, and late restoration success/failure coverage.
- `tests/messenger-api.cjs`: adds the Auth-outage response case and supplies the new transport dependency in fixtures.
- `tests/loading-regressions.cjs`: supplies AbortSignal to the isolated route test environment.

The existing SDK can retry refresh failures within its own bounded refresh window. The transport bounds each HTTP attempt; a session restoration is not promised to finish in eight seconds. Failed writes are not retried by this code.

## Verification

- 71 Node regression tests passed, including an actual Supabase SDK password request that stalls, aborts, then succeeds on retry using synthetic responses.
- Account contract and board contract scripts passed with isolated in-memory fixtures.
- TypeScript passed.
- Production build passed.
- Targeted ESLint and git diff whitespace checks passed.
- Buyers Guide and database migrations unchanged.

The new Auth UI scenarios were exercised in isolated component tests, not an authenticated production browser. No real credentials/customer data were used and no real customer records were altered. The provider-side failure cannot be repaired by a frontend deployment. Production login success must be verified once the upstream Auth/data services respond reliably; this report does not certify that the provider incident is resolved.

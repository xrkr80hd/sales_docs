# NEXTDOX latency findings and staged backend plan

Status: staged, not started. Postgres (Supabase) stays the database. Deal documents and their print output are out of scope and must not change.

## Why the site feels slow (from the code, 2026-10-25)

1. **Serial client-side waterfall.** `app/(app)/layout.tsx` is a client component wrapped in `SupabaseSessionGate`. Nothing renders until the browser downloads the JS bundle, restores the Supabase session, and calls `/api/me?access=1`. Only then does the page mount and request its own data (for example `/api/me/sale-commander`). That is three or more round trips in a row before a consultant sees a number.
2. **Every API request verifies the token over the network.** 26 route files call `db.auth.getUser(token)`, which is a round trip to Supabase Auth on every request. Verifying the JWT locally (Supabase's JWT signing keys / `getClaims`) removes one round trip per request.
3. **`brandingOwner()` lists users on cold start.** `lib/organization-branding.ts` pages through `auth.admin.listUsers` (up to 50 × 200) to find the master admin by email. The result is cached per server instance, so every cold start pays for it. Sales Commander load and save both hit it via the manager-goal lookup. Fix: store the owner's user id in an environment variable or a one-row config table.
4. **Region match unverified.** Every query crosses the network between the Vercel functions and the Supabase project. If the function region and the database region differ, each query pays cross-country latency several times per request. Check the Vercel project's Function Region and the Supabase project region, and put them in the same place.
5. **Large JSON blobs.** Sales Commander stores everything (`days`, `schedule`, `wins`, now `log`) inside `user_settings.consultant_info`. Each save reads and rewrites the whole `consultant_info` object, and the manager stats endpoint reads every consultant's full Sales Commander blob. `days` and `schedule` are never pruned. The new `log` field keeps only ~62 days.
6. **Dev server in Docker.** `Dockerfile` and `compose.yaml` run `next dev`. Fine locally, but never serve real users from that image.

## Quick wins in the current stack (hours, not weeks)

- Owner id from env/config instead of `listUsers` (item 3).
- Local JWT verification in a shared `requireUser()` helper (item 2).
- Align function and database regions (item 4).
- Move Sales Commander day counts to a `sales_activity (user_id, day, calls, talks, appts, shows, ups, sold)` table with a unique key on `(user_id, day)`. Counter taps become a single-row upsert, and the manager stats endpoint sums rows instead of downloading blobs.
- Render the consultant shell on the server and stream data, so the layout paints before auth finishes on the client.

## PHP rebuild: what it would take

Changing the language does not by itself remove the round trips above. A PHP app hosted far from the database, or still calling Supabase Auth per request, will feel the same. What a PHP move would change:

- **Gains:** simple server-rendered pages, cheap always-on hosting with no cold starts, easy to hand off.
- **Costs:** about 94 client entry points to rebuild, Supabase auth/session handling to replace, realtime messenger and push notifications to reimplement, and the exact-print deal documents to re-verify pixel for pixel. The documents are the highest-risk part, and they cannot change.
- **Recommended order if/when you pull the trigger:** (1) quick wins above, measure; (2) move activity data to tables; (3) if still slow, stand up the PHP consultant pages (Today, Sales Commander) against the same Postgres tables first, behind a subdomain, leaving documents on the current app; (4) migrate the rest only once those are proven.

# Database and application security review

Reviewed 2026-10-18 UTC (October 17 in Louisiana).

## Scope and verified results

- Queried security advisors and PostgreSQL table, policy, function, view, grant, and storage metadata for all seven active connected Supabase projects: NEXTDOCS, Wild Rose, YourLocal, Renee, Fuchsia Lighthouse, Spurs, and Southern Iron.
- All inspected application tables have RLS enabled. No exposed public-schema views were present. Anonymous-role count queries returned no rows from the inspected private tables; intentionally published website/catalog/business-card data remains readable.
- Fuchsia Lighthouse's XSTUDIO/WAMarket buckets are private. Its server-only engine, token, integration, and record tables have no anonymous or authenticated table SELECT grants. XSTUDIO asset/owner reads are restricted to the matching owner.
- An unrelated authenticated identity was tested against NEXTDOCS: zero deals, notifications, or settings; organization access helper returned false.
- Scanned the available history of 13 accessible GitHub repositories for Supabase privileged JWTs/secret keys, provider token patterns, private keys, and database connection URLs. No matching credential exposure was found. This is a pattern scan, not a guarantee against every possible secret format or inaccessible/deleted history.
- Inspected environment-variable metadata for ten Vercel projects. No privileged secret names were configured with a browser-public prefix. Readable public key values checked did not contain a service-role key. One sensitive public publishable-key value could not be read back; its value remains unverified.
- NEXTDOCS has no privileged server module reachable from its 94 inspected client entrypoints. Added a `server-only` import fence to prevent future accidental browser imports.
- Live unsigned NEXTDOCS requests: protected data GET endpoints returned 401; admin workspace GET returned 405. Environment and Git configuration file probes returned 404. No secret markers were returned.
- Two inactive Supabase projects (Liberty and the old FinishMyLaunch project) were inventoried but their paused databases were not inspected.

## Changes applied live

1. NEXTDOCS: removed anonymous and ordinary-user execution of privileged deal cleanup, retained service-role execution, restricted trigger function grants, and pinned maintenance function search paths. Verified grants afterward. Cleanup was not executed.
2. NEXTDOCS: scoped manager/F&I deal and notification RLS to dealership membership, with administrative/district exceptions. Verified an unrelated authenticated identity cannot read private records.
3. YourLocal: corrected an always-true organization comparison in legacy conversation RLS and limited direct messages to their participants. Message reads inherit conversation access. Existing legacy message count was zero.
4. YourLocal: revoked draft-content column reads from anonymous and ordinary authenticated roles. Published columns remain readable under existing RLS; trusted server editors retain access. Direct browser code using `SELECT *` on this table must select published fields explicitly; client-side draft editors must use an authorized backend. End-to-end compatibility of that older site's card/editor was not verified.
5. Southern Iron: bound progress-photo consent checks to the actual photo client, rather than any consenting client. Verified the resulting policy expression.
6. Wild Rose: pinned three trigger function search paths. Follow-up security advisors no longer report mutable search paths.
7. Vercel/NEXTDOCS: enabled protection for deployment URLs except custom domains, disabled public source/directory listing, enabled protected source maps and fork protection. The returned configuration confirms deployment protection is enabled. The connector's compact response does not independently return every other updated flag.

No customer records, messages, accounts, photos, or storage objects were deleted.

## NEXTDOCS source changes prepared; not deployed

- Disabled the legacy email-only signup API, which auto-confirmed an invited address without verifying ownership of its invitation. Administrator-created accounts and emailed invitation links remain the supported entry points.
- Scoped original queue APIs and manager deal actions to dealership owner IDs; these service-role routes bypass RLS, so the source fix is necessary in addition to database policies.
- Disabled development authentication bypasses in production.
- Addressed recovered PR #9 findings: bounded email validation, explicit button behavior, native modal image preview, UUID attachment IDs, numeric parsing, removal of forced focus, and verification scripts without VM execution or a class `then` method.
- Updated stale verification fixtures for the current password policy, gross-goal model, request-scoped clients, and messenger contracts. Added checks for invalid/oversized emails, legacy signup rejection, direct queue isolation, and rejected cross-organization deal claims.

## Verification and remaining work

Account, board, and moderation contract scripts pass using isolated fixtures. TypeScript passes. Production build passes. Targeted lint has no errors; existing image/unused-code warnings remain. Original protected-path checks are intentionally no longer applicable to this security change because scoped deal APIs were changed. No document renderer, parser, or document-layout file was edited.

The existing SonarQube result on main is reliability E/security D. A fresh remote scan has not run for this local branch; do not describe it as a passed quality gate.

Source changes await the user's standing explicit push instruction. Until deployed, the legacy signup route and service-role queue/action gaps remain on the existing production app. Database RLS fixes do not constrain service-role API calls.

Leaked-password protection remains disabled in six active projects; the connected Supabase tools do not expose Auth configuration updates. Review it in each project's Auth settings: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . This setting alone is not evidence of a data leak. Deliberately authorized definer functions and deny-by-default tables still produce informational/advisory notices; their presence is not a blanket security pass or failure.

This review does not establish whether historical unauthorized access occurred. Network access restrictions, all secret rotations, inaccessible repositories/accounts, all older deployment bundles, and full end-to-end tests of every application remain outside the verified scope.

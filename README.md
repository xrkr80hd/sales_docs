## Walker Docs

Walker Docs is the Next.js migration target for the Walker dealership document workflow. It is being rebuilt as a tablet and phone-first internal app while preserving the local-first workflow and exact print behavior from the legacy static version.

This repo is the implementation source of truth for Walker Docs.

## Current Scope

- Shared deal intake at `/workflow`
- Document library at `/documents`
- First migrated document at `/documents/delivery-checklist`
- Dedicated exact-print surface at `/print/delivery-checklist`
- Shared browser-session workflow contract in `lib/walker-workflow.ts`
- Supabase email-link auth gate backed by browser-session auth storage

## Development

Run the app locally:

```bash
npm run dev
```

For the current local production-style preview, use:

```bash
npm run build
npm run start -- --hostname 0.0.0.0 --port 3001
```

Open [http://localhost:3001/workflow](http://localhost:3001/workflow) with your browser to see the current app shell.

Quality checks:

```bash
npm run lint
npm run build
```

Docker Compose files are included:

```bash
npm run docker:up
npm run docker:down
```

## Auth Setup

Create a local `.env.local` from `.env.example` with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Supabase auth in this app is intentionally session-only in the browser. It is used to gate access, but customer deal data still remains in browser session storage only and clears after the print dialog closes.

To finish email-link sign-in, add these redirect URLs in Supabase Auth:

- `http://localhost:3001/workflow`
- your deployed domain workflow route, for example `https://nextdocs.xrkr80hd.studio/workflow`

The sign-in request uses `shouldCreateUser: false`, so only approved existing users can enter.

## Project Notes

- The legacy static Walker Docs app remains the reference baseline.
- Print parity is the critical constraint. Screen layout work must not corrupt letter-size output.
- Customer/co-customer support is in progress and should replace single-name assumptions as forms are ported.
- Auth sessions are separate from customer-data storage. Deal data is still not persisted to a backend.

## Next Steps

- Port the next workflow-critical forms behind the same shared data contract
- Finish customer/co-customer corrections
- Lock down printer validation before PWA/offline work
- Add the approved Supabase users and redirect URLs in the dashboard

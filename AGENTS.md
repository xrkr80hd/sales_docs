# Project agent instructions

## TD / FIN — Test Dump protocol

- `TD` means **Test Dump**. Enter a collection-only state.
- While TD is active, silently inventory the user's checks, screenshots, reported problems, and requested changes. Do not reply to individual dump entries, research, implement, test, commit, push, or deploy.
- Pause any previously authorized implementation or push while collecting the dump. Preserve existing work and the collected inventory.
- `FIN` or `fin` explicitly ends TD. Uploads, elapsed time, or unrelated messages do not end it.
- After FIN, reconcile the entire inventory against current repository state, research the actual causes, implement the required fixes, run appropriate checks, then push the collected fixes as authorized by this workflow. Preserve authentication, permissions, organization isolation, and unrelated functionality.
- An explicit instruction to document or update this protocol during TD authorizes only that documentation change; it does not resume implementation or publishing.

See [PROJECT_NOTES.md](PROJECT_NOTES.md) for project workflow notes.

# Test dump reconciliation — October 24, 2026

Trav ended collection with FIN and explicitly authorized implementation, testing, and push. Existing local work was compared against remote main `f16fd1f5ebc876c6dbc18c20ca5ee8578903857f`; the earlier work has been preserved.

| Request | Evidence and implementation | Verification / limit |
| --- | --- | --- |
| Slow/unconfirmed Sales Commander save | The client retained the render's token and reloaded state after token refresh. Save now obtains the SDK's current session before issuing one mutation. The API distinguishes transient Auth errors (503) from invalid sessions (401), and no longer reads unused dealer JSON when saving. | Synthetic browser rotates the token with unsaved edits, injects a failed save, then explicitly retries. No automatic mutation retry or false success. Live Supabase gateway latency is not claimed resolved. |
| Save dialog closes and concise acknowledgment | Require a returned commander object before acknowledging; close the native dialog immediately, resolve navigation, and show a compact Saved toast. | Browser checks closed dialog, destination reached, compact toast, and preserved values. |
| Mobile action buttons | Full-width vertical stack at widths up to 680px. | Geometry assertions for all three buttons in the existing persistence browser suite. |
| Signed-in session / Remember me | Visible Remember me checkbox retains the existing SDK session. Local editing and route navigation reuse session state; token refresh does not overwrite the working Sales Commander draft. | Browser verifies a second page restores the session without another credentials submission. Server API authorization remains enforced. |
| Plain-language copy | Card activity replaces Private analytics; remove Only visible after login, Consultant backend, migration instructions from the admin empty state, and the duplicate invitation commentary after account creation. | Source audit and UI checks. Meaningful legal/storage disclosures and useful export dimensions remain. |
| Consistent containers | Remove brown draft state and large pill status styling; compact business-card actions and collage panels with the app's dark colors and modest corners. | Synthetic visual captures; public card appearance remains independently styled. |
| Initially closed accordions | Native page accordions start closed and remember expansion in account-scoped session memory. Deal accordions have matching memory state. New deal/new collage clears expansion. Collage working fields/photos are kept in scoped memory while navigating, without an extra disk copy. | Browser checks initially closed, return restoration, retained collage fields, and reset on New collage. Logout clears the common resource and accordion caches. |
| Command Center icon | Replace Folder with Radar from the existing icon set. | No new image assets or dependency. |
| Website address entry | Accept www.walker.com or walker.com and normalize to HTTPS. Explicit HTTP/HTTPS remains supported; unsafe schemes, embedded credentials, and control characters remain rejected. | Client dialog and shared server validator; Node security cases and browser save. |
| Customer Information | Match adjacent navigation font sizes at each breakpoint, remove right padding, preserve selected color and chevron. | Existing persistence browser check preserves title and geometry on expansion. |
| Trade-in nesting | Trade-In Information is a nested expandable section, with its own completion action, under Vehicle Trade-In. | Browser enters trade fields and checks persisted completion. |
| Compact vehicle fields | Two equal-width short-field columns, full-width VIN, bounded stock input/suffix. Add a separately persisted vehicleTrim field and include it in the vehicle description helper. | Mobile/laptop geometry, no page overflow, and normalization tests. |
| New/Used transfer | Selector in the compact deal header preserves current workflow, signatures, completion, and deal identity. Cancel the old debounce and wait for an existing write before transferring. One route handoff prevents reloading an older server record over the transferred values. Document drawer follows the current New/Used route. | Browser switches both directions and checks purchase/trade fields and signatures. Existing print routes retain their established document sets; Used includes the existing warranty/buyer's-guide pages. |
| Oversized sign-out-only profile dropdown | Remove the account dropdown when there is no workspace picker. Sign Out remains in the sidebar. Keep the compact selector for roles that need it. | Floor Manager/consultant browser assertions; admin workspace switching preserved. |
| Manager categories from earlier batch | Dedicated setup and schedule pages; assignment determines ordinary manager's organization; no setup form in queue/display; BDM read-only; FM View alongside consultant tools. | Navigation and manager-display fixtures, board/account contract checks. |
| TD/FIN protocol | Written to AGENTS.md and PROJECT_NOTES.md. | Applies to this repository. No claim that every ChatGPT conversation's global settings were changed. |

## Unresolved: universal third-party popup containment in mobile Chrome

The supplied screenshots show the regular NextDocs website in a mobile browser, not an installed native browser shell. A cross-origin iframe cannot take over another site's window.open, target=_blank, authentication cookies, or native confirmation dialogs. Blocking popups with sandbox flags would break the login rather than contain it. The implementation therefore does not mislabel such a block as a fix or silently rewrite users' saved URLs.

A complete universal solution requires an installed mobile browser/WebView wrapper with native window handling, or cooperation from each third-party provider. DriveCentric and Rapid Recon real account logins were not performed; their mobile authentication behavior remains unverified. The existing experimental desktop companion is preserved and remains explicitly unverified in its README. No mobile installer was built in this batch.

Primary references consulted:
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe
- https://developer.android.com/reference/android/webkit/WebChromeClient
- https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/how-does-on-create-window-work.md

## Validation scope

Synthetic browser fixtures replace network services; no production business records are written. Node tests and authorization fixtures cover unchanged security contracts plus URL normalization, activity-save acknowledgment, transient-auth classification, and trim preservation. These checks do not constitute production load testing, legal compliance certification, or proof that all provider login flows work.

The acknowledgment remains truthful: NextDocs prepares documents but also stores temporary saved deals and other account/application data. It does not claim that no information is stored or that the entire application is legally certified.

## Final verification — 2026-10-24

- 105 Node fixture tests passed; TypeScript and the final production build passed. Targeted ESLint and git diff --check passed.
- Consultant navigation checked at 390, 1024, 1336, and 1440 pixels; embedded panes fill the available workspace after accordion state support.
- Sign-in bounds remain stable at phone and desktop sizes. Cache/session checks cover link return, chat send/return/realtime, activity save, and stable customer labels.
- Used print bundle renders seven physical PDF pages; New renders five, with VIN preserved and no trailing blank page. Screen-only spacers are now hidden for printing.
- Phone header hides the desktop identity text alongside the avatar so logos, Messenger, and navigation do not overlap.

Testing uses synthetic consultant accounts and intercepted services. The future company president’s intended test role is consultant; no extra management permissions were added for that test.

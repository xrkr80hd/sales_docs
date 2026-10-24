# Navigation and category audit — October 24, 2026

Scope: repository route inventory, shared navigation, page composition, and the controls used by consultants, floor managers, sales managers, district managers, BDM, finance, and administrators. Public card, authentication, and print routes were inventoried as separate surfaces. This is a repository navigation audit with synthetic browser verification of the changed flows; it is not a live end-to-end audit of every production feature.

| Area | Finding | Final placement / action |
| --- | --- | --- |
| Manager Board Setup | The root board URL was ambiguous; the sales manager view also embedded the setup component. | One explicit `/manager-board/setup` destination. The old root redirects there with organization/month preserved. Removed the embedded setup from the role overview. |
| Organization assignment | Setup contained a store picker and fetched the directory. | Removed the picker and directory request. Ordinary managers use their assigned organization; existing server authorization continues to enforce it. Master Admin / district selected-store links remain supported. |
| Team Schedule | Sidebar shortcut opened the full setup form at an accordion. | Dedicated `/manager-board/schedule` page shows only the reporting month, schedule, and save action. Setup no longer repeats the schedule editor. It saves through the existing version-protected board writer. |
| Performance Display | Setup action was mixed into the read-only view. Navigation could restart the app; popup repeated account startup. | Display contains read-only performance and display-window actions. Internal navigation uses Next Link. Popup receives a 15-second, account-matched UI handoff, then refreshes independently. Server checks still protect API reads/writes. |
| BDM | BDM overview rendered the setup component, and sidebar exposed setup/schedule links. | Read-only Performance Display; hide setup/schedule navigation in BDM view. Direct setup/schedule render refuses non-managing accounts. |
| Floor Manager | Selling tools and manager queue required an awkward view separation. | Full Consultant Set Up, Sales Commander, deal tools, and FM View together in the sidebar. No Floor Manager workspace dropdown. Queue contains no setup form. |
| Command Center Settings | Breadcrumb and return action classified it as Consultant Setup. | Command Center breadcrumb and Close settings return to Command Center. Shortcut management remains in Command Center. |
| Consultant Setup | Links to Business Card and Team Management also invoked close-to-dashboard navigation. | Remove the competing click handler; each link now has exactly one destination. Internal and public profiles stay separate. |
| Consultant Tools | Fun Facts route could inherit a manager navigation state. | Nested Sales Commander resource routes, Team Board, and deal-entry routes retain consultant navigation. Legacy Sales Commander route remains a redirect. |
| Business Card | A failed saved-card read exposed another credentials form inside the authenticated workspace. | Show the read error and Retry saved card; login remains owned by the app session gate. Remove redundant Dashboard link from the normal editor header. Keep permission-recovery navigation. |
| Deal documents | Documents and Deal Documents were shown together during deal entry. | One contextual Deal Documents control during deal entry. Documents library remains available elsewhere. |
| Manager queue | Shared large table styling let long fields dominate the page. | Compact queue-only styling with fixed columns and wrapping. Does not change finance queue sizing. |
| Mobile exit dialog | Save/Discard/Stay actions wrapped into uneven rows. | Stack all three buttons vertically at full dialog content width on mobile; retain desktop layout. |
| Sign-in | Return visits should reuse the saved session. | Visible Remember me checkbox keeps the existing session persisted on this device; passwords are not duplicated into application storage. |
| Shared navigation | Dead display header duplicated the standalone display's own controls; an unused settings callback remained. | Remove unreachable header and unused prop. Keep the actual settings event used by the document drawer. |

## Deliberately preserved

- Consultant Setup owns internal staff/contact defaults and assigned dealership hydration. Business Card owns public presentation and publishing. Organization administration owns assignment, addresses, roles, and permissions.
- Sales Commander owns a consultant's local planning/activity workflow. Sales Commander Stats owns management coaching. Performance Display owns the read-only sales board. These are different tasks, not redundant screens.
- Training can link to the existing Cheat Sheet document; the shared document is not copied into a second implementation.
- Document Library and print routes remain separate: editable forms and print output have different behavior.
- Finance queue, direct messages, organization messaging, and admin messaging permissions remain separate. No permission expansion, production SQL, or schema changes were needed.
- Existing new/used Start a Deal choices, Resume Deal, Command Center shortcuts, stable customer accordion, session preferences, and caches are preserved.

## Browser evidence and validation

1. Manager setup: synthetic browser capture, dedicated route and no organization picker. Goal save preserves schedule and yearly gross.
2. Team schedule: separate synthetic browser capture, no goal input controls. Saving schedule preserves existing goal and yearly gross.
3. Performance display: synthetic captures at 390, 1040, 1366, 1440, 1920, and 3840 pixels; no setup link, no horizontal page overflow. Popup makes no additional initial account check or board fetch, survives closing its parent, and independently refreshes.
4. Consultant / Floor Manager navigation: checks at 390, 1024, 1336, and 1440 pixels, including FM View, full consultant navigation, no Floor Manager dropdown, and long queue fields contained within the page.
5. Authorization and board contract fixtures: organization isolation, BDM read-only access, projection locks, compare-and-set board updates, and account controls.

No production business records were modified for validation. Synthetic browser checks do not establish capacity for 300 users or prove third-party login/popup containment. The installed native browser companion remains experimental as documented in `desktop/README.md`.

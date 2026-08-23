# NFC Profile — Numbered Wiring Map

This document is the implementation contract for the public profile at `/card/trav`.

## Rules

- Use real functional code and real data only.
- Never seed or display fabricated people, vehicles, reviews, leads, posts, metrics, or contact details.
- Until a feature is connected, show its numbered empty state or keep it hidden.
- Current application roles are exactly `admin` and `user`.
- This product remains separate from Walker NextDocs roles and workflow.

## Public page wiring

| No. | Public section | Backend source | Required implementation | Current state |
|---|---|---|---|---|
| 01 | Profile identity and photo | `profiles` + Supabase Storage | Public name, title, employer, location, 1:1 crop settings, alt text | Confirmed identity; supplied photo being added |
| 02 | Call and text | `profile_contacts` | Validated phone number, public visibility, `tel:` and `sms:` actions | Not connected |
| 03 | Email | `profile_contacts` | Public email and `mailto:` action | Connected to `trav@xrkr80hd.studio` |
| 04 | Save contact | Generated vCard route | Generate `.vcf` from the active public contact record | Not connected |
| 05 | About | `profile_content` | English and Spanish bio fields with publish confirmation | Not added |
| 06 | Inventory | `profile_links` | Walker inventory URL, label, active state, click tracking | Not connected |
| 07 | Featured vehicle | `vehicle_posts` + Storage | Deal of the Week/Fresh Trade, source mode, vehicle fields, 3:2 or 16:9 media, start/end time, sold state, share metadata | No active post |
| 08 | Walk-around video | `vehicle_media` + Storage | Uploaded video or validated external URL, poster image, vehicle association, publish window | No active video |
| 09 | Five-star reviews | `review_media` + Storage | 5–10 real review screenshots, crop data, order, active state, accessible captions | No uploads |
| 10 | Social links | `social_links` | Platform, verified URL, label, order, active state | Not connected |
| 11 | Contact request | `leads` + protected server action | Name, reply method, consent, spam protection, delivery to `trav@xrkr80hd.studio`, status audit | Not wired |
| 12 | Personal-site footer | `profile_links` | Optional secondary XRKR80HD destination; never the Walker page's primary action | Not connected |
| 13 | Language | Translation records | English/Spanish content selection with English fallback; do not fabricate translations | UI indicator only |
| 14 | Share preview | Page metadata | Record-specific title, description and real primary image for Facebook/text sharing | Not wired |
| 15 | Visitor analytics | Privacy-aware events | Page views, CTA clicks and campaign source; no promise to identify anonymous visitors | Not wired |

## Minimum database sequence

1. Extend the public profile data model without changing the two-role authorization rule.
2. Add authenticated owner/admin editing policies and public read policies for published records only.
3. Create private upload workflows and public delivery rules for approved media.
4. Connect each numbered section one at a time.
5. Remove an empty-state label only after its database, security policy, validation, and visible action have been verified.

## Publication rule

Every create, edit, delete, publish, unpublish, and scheduling action uses an explicit confirmation button. Do not use checkboxes as action confirmations.

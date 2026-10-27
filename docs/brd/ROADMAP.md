# BRD implementation roadmap

Source: frontend handbook at `C:\Users\kamal\Desktop\Work\Service provider\frontend\`
(204 controller endpoints: ~102 member, ~102 admin). Implement each guide with
[IMPLEMENTATION_TEMPLATE.md](IMPLEMENTATION_TEMPLATE.md). Update the **Status**
column when a guide lands on `main`.

Status: ✅ done · 🔜 next · ⬜ not started · ⏸ blocked on a decision

## Order and dependencies

| Phase | Guide | Status | Depends on | Member / admin endpoints | Permissions |
|---|---|---|---|---|---|
| 0 Foundation | 00 Integration basics | ✅ | — | — | — |
| 0 Foundation | 01 Account access | ✅ | 00 | 9 / 0 | — |
| 0 Foundation | UI design system | ✅ | — | — | — |
| 1 Onboarding | 02 Password recovery | ✅ | 01 | 3 / 0 | — |
| 1 Onboarding | 06 Reference choices | 🔜 | 01 | 4 / 5 | `reference.view` (setup ok), `reference.manage/.delete`, `reference-admin.view` |
| 1 Onboarding | 03 Member types and roles | ⬜ | 01 | 4 / 12 | `profiles.view/.manage` (setup ok); admin: `users.*`, `roles.*` |
| 1 Onboarding | 04 Profiles | ⬜ | 03, 06 | 3 / 4 | `profiles.view/.manage` (setup ok) |
| 2 Provider setup | 05 Business details | ⬜ | 04 | 5 / 7 | `businesses.view/.manage/.delete` |
| 2 Provider setup | 07 Services (own listings) | ⬜ | 05, 06 | 7 / 5 (shared with discovery) | `services.view/.manage/.delete` |
| 2 Provider setup | 10 Employees | ⬜ | 05, 06 | 5 / 5 | `employees.view/.manage/.delete` |
| 3 Customer work | 07 Discovery (nearby search, provider detail) | ⬜ | 04 | (above) | `services.view` |
| 3 Customer work | 08 Inspections | ⬜ | 07 | 11 / 6 | `inspections.view/.manage/.delete` |
| 3 Customer work | 09 Quotes | ⬜ | 08 | 8 / 6 | `quotes.view/.manage/.delete` |
| 4 Cards | 11 Card requests | ⬜ | 04, 10 | 6 / 6 | `card-requests.*`, `employees.manage` |
| 4 Cards | 11-b Card issuance | ⬜ | 11 | 5 / 6 | `cards.view/.manage`, `card-requests.manage`, `employees.manage` |
| 5 Relationships and pricing | 12 Client relationships | ⬜ | 08 | 3 / 2 | `clients.view/.manage/.delete` |
| 5 Relationships and pricing | 13 Price catalogue | ⬜ | 06 | 2 / 7 | `price-catalogue.view`; admin: `price-catalogue-admin.view`, `.manage/.delete` |
| 5 Relationships and pricing | 14 Provider prices | ⬜ | 13, 07 | 12 / 13 | `prices.view/.manage/.delete` |
| 6 Communication | 17 Push installations and issue reports | ⬜ | 01 | 4 / 4 | `notifications.view/.manage/.delete` (setup ok) |
| 6 Communication | 18 Live notifications (SignalR) | ⬜ | 17, features it refreshes | — | — |
| 6 Communication | 15 Support | ⬜ | 01 | 8 / 8 | `support.view/.manage/.delete` (setup ok) |
| 6 Communication | 16 Announcements | ⬜ | 03 | 2 / 7 | `announcements.view`; admin SuperAdmin-only |
| 7 Administration | 19 Admin screens (admin routes of 03–17) | ⏸ | everything above | ~102 admin | SuperAdmin / delegated roles |

Phase 1 order: **02 → 06 → 03 → 04**. Guide 04's form needs region/occupation
choices (06) and the member type (03). Guide 04 replaces the `(setup)` placeholder
and ends with a session refresh to obtain full access.

## Per-guide scope notes

| Guide | Main member screens | Watch out for |
|---|---|---|
| 02 | Request code → enter code → new password | Neutral "if this account can receive email…" message. Reset sends **email + code + `newPassword` + `confirmNewPassword`**; there is no reset token. Replace the legacy `/Auth/*Forgot*` flow and `forgotPasswordToken` param. Optional `check-password-recovery-code` before the password form. |
| 06 | Region / occupation / position / licence-type pickers (feed `SelectInput`) | Submit stable `code`, show `displayName`. Never hard-code lists. Regions are public; others need `reference.view` (setup exception). Migrates the legacy lookup/location hooks off `BaseResponse`. |
| 03 | Choose first member type; show membership ID | `GET /api/members/me` can be `data: null`. First-type selection is not "change type". Fetch types; never derive labels from roles. Self-deactivation needs confirmation + full sign-out cleanup. |
| 04 | One profile form for onboarding and editing; picture upload | Conditional sections by **user type**. Postal-same flag sent explicitly. Tradeperson occupations + licence text; government sector name. Refresh session after the onboarding save and confirm `profileCompletionRequired` is false. **No change-login-email endpoint exists**, so contact email ≠ sign-in email. |
| 05 | "My business" empty state, create/edit, picture, archive | Eligible types only (Tradeperson/Builder/Developer) + permission. POST only when none exists; PUT edits. ABN/ACN, Australian address, **explicit latitude/longitude** (needs a location input). |
| 07 | My services list/detail/create/edit/archive; nearby search; provider detail | Listing has its **own** coordinates. Discovery needs the searcher's location with permission and an address fallback; Australia only. |
| 08 | Requester/provider tabs, detail + timeline, schedule, worker, completion code, rating, hide/restore | Large state/action matrix: drive buttons from state flags but expect server rechecks. Appointment instants need explicit offset. |
| 09 | Quote lists (both sides), detail/history, issue form, accept/reject/withdraw, PDF upload/download | Only for `completed`/`rated` inspections. Future expiry with offset. AUD ≤ 2 decimals. Private PDF via authorized download (`downloadPrivatePdf`). |
| 10 | Employee roster, create/edit/archive, assignment | Employees are records, **not accounts**. Unique email across active employees. |
| 11 / 11-b | Personal + employee card requests, address editor, cancel; card view, receipt confirmation, replacement | Accepting a request ≠ issuing a card. Data-rendered card (no image/QR from the API). |
| 12 | My clients (provider) / My providers (customer) | Keyed by business ID + client account ID. No manual create/delete. |
| 13 | Price guidance browse/search/filter | Guide price ≠ provider average ≠ quote. No tax labelling. |
| 14 | Item selection, yearly submissions, history, new-item requests | Needs an active matching service listing. Withdrawal uses `.delete`. |
| 15 | Conversations list, new conversation, paged thread, close/reopen | Plain-text, immutable messages; title ≤ 200, message ≤ 5000. Works during profile setup. |
| 16 | Announcement list + detail | No read/unread tracking. Plain text only. |
| 17 | (no screens) installation registration lifecycle; optional "report a problem" | Reuse the stable installation UUID (`utility/installationId.ts`). Register after sign-in with a real Expo token. Replaces legacy `/PushNotification/*` (`hooks/useNotification.ts`). |
| 18 | (no screens) live connection, notice toasts, cache refetch | Refetch the affected `…Keys` queries; ignore unknown event types; reconnect/resume refetch. |

## New packages that guides will need (each needs your approval)

| Guide | Package | Why |
|---|---|---|
| 05, 07 | `expo-location` (+ optionally `react-native-maps`) | Business/listing coordinates and nearby search. |
| 09 | `expo-document-picker`, `expo-sharing` | Pick a PDF to upload; open/share a downloaded quote PDF. |
| 18 | `@microsoft/signalr` | Live notification hub connection. |

## Open decisions

1. **Admin screens (guide 19):** do the ~102 `/api/admin/...` endpoints belong in
   this mobile app, or in a separate web console? The plan defaults to **member
   features first**. Admin is phase 7 and needs a scope decision before it starts.
2. **Menu → Email & password:** the backend has no change-email or change-password
   endpoint (guide 04 confirms there is no change-login-email). Remove the screen,
   or keep it hidden until the backend adds endpoints?
3. **App icon and splash:** still the placeholder grid; replace with the AUETE
   bolt mark (needs a native rebuild).

## Legacy code still to retire

| Legacy | Replaced by |
|---|---|
| `/Auth/Credentials/*` (change email/password) | Decision 2 |
| `BaseResponse<T>`, `useLookup`, `useGetLocations`, `lookupService`, `locationService` | Guide 06 |
| `/PushNotification/Register`, `/PushNotification/Send` (`useNotification`) | Guide 17 |

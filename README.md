# Service Provider

An Android/iOS React Native / Expo application shell. Product features and onboarding will be implemented after the Service Provider BRDs and API contracts are approved.

## Local development

Use the existing lockfile; do not upgrade Expo or package versions as part of setup.

```sh
npm ci
npm run config:check
npm start
```

Other commands:

```sh
npm run android
npm run ios
npm run lint
npx tsc --noEmit
```

Native builds require the appropriate Android/iOS toolchain. iOS builds require macOS or EAS.

`app.json` restricts supported platforms to Android and iOS. Shared Expo Router components and native external-link handling remain available. `expo-web-browser` provides the native in-app browser; `react-dom` remains pinned to React's version because Expo Router's Radix/vaul dependencies require its peer. Neither package enables an application Web target.

## Environment and build configuration

Copy `.env.example` to an ignored local `.env` or `.env.local`. `APP_VARIANT` is independent of `NODE_ENV`; do not use `NODE_ENV` to choose an application environment. An unset local variant defaults to `dev`. Only `dev`, `preview`, and `production` are accepted; empty, misspelled, or other values fail with an explicit configuration error.

| EAS build profile | APP_VARIANT | EAS environment | Native identifier suffix | Display name |
| --- | --- | --- | --- | --- |
| development | dev | development | .dev | Service Provider - Dev |
| dev (standalone internal build) | dev | development | .dev | Service Provider - Dev |
| preview | preview | preview | base IDs | Service Provider |
| production | production | production | base IDs | Service Provider |

Preview and production share the approved base Android package and iOS bundle identifier, `com.kimzaster.serviceprovider`, and cannot be installed side by side. Development uses `com.kimzaster.serviceprovider.dev` on both platforms. Every variant uses the `service-provider` URL scheme. `app.json` owns the base identities/assets and app version `1.0.1`; `app.config.js` applies the approved variant rules. The local npm package version `1.0.0` is separate from the native app version. EAS retains its remote build-number/version-code source and production auto-increment policy.

| Input | Owner and location | Requirement |
| --- | --- | --- |
| APP_VARIANT | Repository: eas.json for EAS; developer: local environment | Do not redefine the EAS value remotely; it must match the chosen build profile. |
| EXPO_PUBLIC_BASE_URL | Backend owner supplies an approved host; developer sets it locally, EAS project owner sets it in the selected environment | Required for EAS preview/production builds; optional for local checks/exports and development builds. |
| GOOGLE_SERVICES_JSON | Firebase/EAS owner: optional path locally or file-type EAS environment variable | Native Android builds require a readable JSON file containing the current variant's Android package. |
| Native IDs and scheme | Application owner approved Service Provider values in app.json | Development keeps the .dev native suffix and display-name suffix. |
| EAS project ID and Firebase ownership | Existing project owners | Preserved; cloud configuration and signing require owner follow-up. |

`EXPO_PUBLIC_BASE_URL` must be an absolute HTTPS origin without an API path, credentials, query parameters, fragments, or surrounding whitespace. Runtime transport removes the trailing slash; feature paths already include `/api`. Origins are supplied through local/EAS environments. EAS profiles do not override them with blank strings. Plain-text/sensitive visibility is appropriate for bundled public values; secret visibility does not make a client-side value secret. Do not place passwords, tokens, service-account keys, or other credentials in `EXPO_PUBLIC_*`, app config `extra`, or source code. See [Expo environment variables](https://docs.expo.dev/guides/environment-variables/) and [EAS environment selection](https://docs.expo.dev/eas/environment-variables/usage/).

The installed Expo tooling loads local dotenv files without overriding existing process variables. `config:check` uses that same loader. The EAS pre-install check uses only the worker's supplied environment, with no local dotenv loading or installed dependencies required. Remote EAS variables, credentials, file contents, and project ownership have not been inspected or changed. Any previously configured custom `dev` EAS environment must be reconciled by the project owner with the approved `development` mapping before building.

Android Firebase selection keeps the existing references: an explicit `GOOGLE_SERVICES_JSON` path wins; otherwise `dev` uses `./google-services.dev.json` when present, then falls back to `./google-services.json`; preview/production keep `./google-services.json`. A nonexistent override path is an error for native Android checks, with no silent fallback. The chosen file must include `com.kimzaster.serviceprovider.dev` for dev or `com.kimzaster.serviceprovider` for preview/production. Files are read only for validation, never printed or embedded in `extra`. Existing Firebase references are not credentials supplied by this task. No iOS Firebase plist is configured; these checks do not introduce one.

Local dotenv files and both Firebase filename patterns are excluded from Git and EAS archives; `.env.example` is retained. Supply Firebase to cloud builds through the `GOOGLE_SERVICES_JSON` EAS file variable. Do not assume a local, ignored Firebase file will be uploaded. See [EAS file variables](https://docs.expo.dev/eas/environment-variables/) and [archive exclusion rules](https://docs.expo.dev/build-reference/easignore/).

Validation commands:

```sh
npm run config:check
npm run config:check -- --platform android
npm run config:check -- --platform ios
npm run test:config
npx expo config --type public
npx expo export --platform android --platform ios
```

The first command permits missing API/Firebase inputs and explains which capabilities are unavailable. Native Android validation requires matching Firebase input. `npm run android`/`ios` run their platform checks before invoking Expo; direct Android prebuild also registers a native-only validation mod. EAS's [pre-install lifecycle hook](https://docs.expo.dev/build-reference/npm-hooks/) checks the explicit profile/variant, required API URL, Android Firebase input, and the existing development-client prerequisite before native work. Custom EAS workflows must invoke this check explicitly if they bypass standard lifecycle hooks. Config inspection, TypeScript/lint, and JavaScript-only exports do not require native Firebase files or a backend. Expo may additionally warn about the retained missing `android.googleServicesFile`; it remains intentionally configured for future native builds.

The `development` profile still requests a custom development client, but `expo-dev-client` is absent from the existing dependencies. Its native preflight reports this requirement. Installing it needs separate approval; no dependencies were added or upgraded. The `dev` profile remains an internal standalone build, not a custom development client. JavaScript exports do not validate signing, Firebase project/credentials, push delivery, device network/TLS configuration, or native binaries. Cloud builds/submission also remain pending EAS slug/ownership reconciliation.

## Backend configuration

With the API host unset, the sign-in screen launches but backend-dependent actions are disabled. Startup skips session restoration and push requests; persisted refresh credentials are preserved. No demonstration credentials, fake sessions, or replacement backend paths are provided.

The DEV API origin is `https://dev-api-sp.auete.store`. The frontend handbook's `zourwa.com` hosts are incorrect; use the `auete.store` domain for API and SignalR hosts.

Account access follows guide 01 (`/api/auth/register`, `/verify-email`, `/resend-verification`, `/mobile/sign-in`, `/mobile/refresh`, `/mobile/sign-out`). Password recovery follows guide 02 (see below). The Menu's change-email and change-password actions call legacy `/Auth/Credentials/*` paths that the Service Provider backend does not document. Push registration uses `/api/notifications/installations` (guide 17). The legacy app-version check and forced-update screen were removed; the Service Provider backend has no version-policy endpoint.

## Account access (guide 01)

- Registration sends `email`, `password` and `confirmPassword`, then opens email verification for that email. It does not sign in. A 503 `EMAIL_DELIVERY_FAILED` also opens verification so the member can resend instead of registering again.
- Verification sends the original email and a six-digit **string** code (leading zeroes preserved). It issues no tokens: success returns to Sign In with the email prefilled.
- Verification resend shows the same message whether or not the account exists. The resend countdown matches the backend's one-minute cooldown.
- Sign-in requires only a nonblank password. A 403 at sign-in means a valid but unverified account: the app explains this and opens verification for that email.
- Mobile sign-in and refresh return tokens only, with no user object. `utility/accessToken.ts` derives the signed-in user from the access-token claims: `sub` (account ID, kept as a string), `access_level`, `role`, `permission`, and an email claim when present (otherwise the sign-in email). Claims are read for UI decisions only; signatures are not verified on the device. A token without a subject or access level is rejected as an invalid session.
- `profileCompletionRequired: true` opens the `(setup)` placeholder; normal screens stay unavailable until a refreshed full session. Guides 03 and 04 replace the placeholder with type selection and profile completion.
- Sign-out sends the refresh token and the installation ID (`utility/installationId.ts`): one stable UUID per installation, kept in SecureStore and retained across sign-outs.
## Password recovery (guide 02)

- Forgot password calls `/api/auth/request-password-recovery` and always shows the neutral "If this account can receive recovery email, a code has been sent." Unknown, deactivated and undeliverable accounts look identical.
- The code screen prechecks the six-digit string code with `/api/auth/check-password-recovery-code`. The precheck neither consumes the code nor returns a token. Resend uses the same request endpoint with the one-minute countdown; nothing resends automatically.
- The password screen calls `/api/auth/reset-password` with `email`, `code`, `newPassword` and `confirmNewPassword` (same policy as registration). A password-policy rejection is shown on the field and the same code can be retried. A rejected code (invalid, expired and exhausted share one error) clears it and returns to code entry.
- The email and code live only in `stores/passwordRecoveryStore.ts` (memory), never in route params, storage or logs. After an app restart the member requests a new code.
- Success clears the recovery state and private query caches, then returns to Sign In. Reset never signs in or verifies an unverified email. The server revokes refresh sessions and push installations, so other devices must sign in again.

## Password policy

- New passwords (registration, reset, change) require 8+ characters with an uppercase letter, a lowercase letter, a number and a symbol (`utility/passwordPolicy.ts`).

## Member types and membership (guide 03)

- Setup reads `GET /api/members/me` (`data: null` before the first selection). Step 1 opens **Choose your member type**, which lists `GET /api/members/user-types` (public, never derived from roles) and saves the one-time choice with `PUT /api/members/me/user-type`. The returned membership ID and type then show on the setup overview. If the response says no profile is required, the session refreshes to pick up full access. Otherwise guide 04's profile step follows.
- A type, once chosen, can't be changed by the member; the screen says so and only an administrator can change it.
- The Account tab shows the member type and membership ID, and offers **Deactivate account** behind an explicit confirmation. `POST /api/members/me/deactivate` revokes every session server-side; the app then signs out locally and clears caches. Business history is kept; only an administrator can reactivate.
- Admin users, roles and permissions (all users, exact-email lookup, deactivate/reactivate, SuperAdmin-only type change, role create/edit/delete, permission catalogue, user role replacement) have services and hooks in `services/memberService.ts` / `hooks/useMembership.ts`, gated in `utility/access.ts`. Role replacement sends the complete set and refuses SuperAdmin's role ID. No admin screens yet.

## Profiles (guide 04)

- One form (`components/profile/ProfileForm.tsx`) serves onboarding (setup step 2, **Complete your profile**) and later edits (Account → **Profile**). It loads `GET /api/members/me/profile` (`data: null` means a first profile) and saves the complete record with `PUT /api/members/me/profile`.
- Sections follow the member's **current user type**: a Tradeperson picks one or more distinct occupations with licence text for each; Public & Government Sector needs a sector name. Other types send no occupations and no sector name, so the server removes details that no longer apply. Rules live in `utility/profileForm.ts` (yup schema + request mapping).
- `isPostalSameAsAddress` is always sent; when it is off, the four postal fields are required. Blank optional fields are sent as null. The contact email is business contact information and never changes the sign-in email.
- Region and occupation selections use reference codes. A saved choice that has since been retired stays visible (marked retired) while unchanged but can't be picked again.
- After the onboarding save the session is refreshed; once the new token has `profileCompletionRequired: false` the app opens the member screens. If it doesn't clear, the screen says so and offers **Check again**.
- The picture (`PUT /api/members/me/profile/picture`, field `picture`) needs a saved profile; the app checks JPEG/PNG, 5 MB and 16 million pixels before uploading. The Account card shows the name and picture.
- SuperAdmin target-user profile read/save/history/picture routes have services and hooks (`services/profileService.ts`, `hooks/useProfile.ts`). No admin screens yet.

## Business details (guide 05)

- Account → **My business** (`app/(dashboard)/(menu)/business.tsx`) shows an empty state, the active business (`GET /api/businesses/me`, `data: null` when none), its picture, and **Archive business** behind a confirmation that lists the effects. **Business details** (`business-edit.tsx`) creates with POST only when none is active, otherwise edits with PUT; it never creates implicitly.
- Eligibility: Tradeperson, Builder or Developer **and** the operation's own permission (`businesses.view/.manage/.delete`), full access only. A type alone, or a permission alone, is not access. Read-only members see details without edit actions.
- ABN (11 digits, checksum) is required and ACN (9 digits, checksum) is optional; spaces are removed before sending, and the screen notes that a checksum doesn't prove registration. Rules live in `utility/businessForm.ts`.
- The location is set with a map pin (`components/form/LocationPicker.tsx`): tap or drag the pin, or tap **Use my current location** (`expo-location`, asked only on tap). Coordinates are never typed; they are range-checked again in the service, and 0 is valid.
- Archive refetches every query, since listings, roster and card requests change server-side. The picture upload shares `components/ui/PicturePicker.tsx` with the profile picture.
- SuperAdmin list/detail/create-for-user/update/archive/history/picture routes have services and hooks (`services/businessService.ts`, `hooks/useBusiness.ts`). No admin screens yet.

## Services and discovery (guide 07)

- **Find** tab (`app/(dashboard)/(find)`): searches from the phone's current location when the member allows it (the first fix searches straight away); otherwise they place the pin on the map or use their business location, radius 1–500 km (default 50), optional occupation and membership ID. Empty filters are omitted; results are paged with **Show more** and ordered by estimated straight-line distance. Results refresh when returning to the tab.
- Provider detail shows business and profile pictures, membership ID, rating (a null average shows "No ratings yet"), service and business locations, and inspection availability (`canRequestInspection` plus `inspections.manage`). A listing that stops being discoverable shows "no longer available". No email or phone is exposed.
- Account → **My services**: active and archived listings, detail, create/edit and archive. Publishing needs an eligible type, `services.manage` and an active business; a Tradeperson may list only occupations on their profile. A new listing starts at the business location but keeps its own coordinates. Archived listings are read-only.
- Rules live in `utility/serviceForm.ts` and `utility/coordinates.ts` (shared with the business form); search parameters are built and checked by `searchParams` in `services/serviceListingService.ts`. SuperAdmin listing routes have services and hooks (`hooks/useServices.ts`). No admin screens yet.

## Employees (guide 10)

- Account → **Employees**: the business roster (paged, **Show more**), with an **Include archived** view for history. Employees are records, not sign-in accounts. Detail shows work and contact details; **Edit details** is a full replacement form and **Archive employee** warns that accepted inspection assignments may be cleared and card requests/cards cancelled.
- Name, phone and occupation are required; email, position and licence are optional on both add and edit (cleared fields are sent as null). Email uniqueness across active employees is checked by the server and shown on the field. Retired saved occupations/positions stay visible while unchanged.
- Eligible type plus `employees.view/.manage/.delete`; adding needs an active business. Archival refetches every query. Rules live in `utility/employeeForm.ts`; service and hooks in `services/employeeService.ts` / `hooks/useEmployees.ts`, including SuperAdmin routes (no admin screens yet). Worker assignment arrives with inspections (guide 08).

## Inspections (guide 08)

- **Inspections** tab (`app/(dashboard)/(inspections)`): requests the member made and requests for their business (All / I requested / For my business), a status filter, **Show hidden**, and **Show more** paging. Lists refresh when returning to the tab.
- **Request inspection** on a found service opens a form prefilled with the profile address (the discovery location is not the visit address) plus an optional note. One open request per service is enforced by the server.
- Detail shows the appointment, worker (name, occupation, position only; the provider when none is assigned), visit address, the other party, rating, timeline and worker history. Actions follow the guide's matrix by participant (account IDs), state and permission (`utility/inspectionRules.ts`): accept with a future date/time and optional matching worker, reject/cancel with an optional reason, assign/replace/clear the worker, show the completion code (requester) with a 10-minute countdown, enter the code (provider), rate once 1–5, and hide/restore this member's copy.
- The completion code lives only in screen state: never cached, stored, logged or put in a URL. Every action refetches the inspection and lists, including after conflicts. Appointments are sent in UTC with seconds (`toUtcTimestamp`).
- SuperAdmin list/detail/create-for-requester/decision/worker/rating routes have services and hooks (`services/inspectionService.ts`, `hooks/useInspections.ts`). No admin screens yet.

## Quotes (guide 09)

- **Quotes** tab (`app/(dashboard)/(quotes)`): quotes received and sent, with a status filter and paging. **Send a quote** appears on a completed or rated inspection for its provider (amount in AUD with at most 2 decimals, a future "valid until" date/time, optional note). The server issues the quote number; there is no payment step.
- Detail shows the amount, number, expiry countdown, both parties, note, PDF and history. The customer can accept (final, not a payment) or reject; the provider can withdraw and attach/replace a PDF while the quote is pending. Before any decision the app refetches the quote and acts only if it is still open; status and expiry always come from the server.
- PDFs: picked with `expo-document-picker` (PDF, 10 MB, field `document`), downloaded with Bearer authorization from the quote's own root-relative link (never a public URL), opened through the share sheet (`expo-sharing`) from a temporary file that is deleted afterwards (`services/devicePdf.ts`).
- Rules live in `utility/quoteRules.ts`; service and hooks in `services/quoteService.ts` / `hooks/useQuotes.ts`, including SuperAdmin routes (no admin screens yet).

## Membership card requests (guide 11)

- Account → **Membership cards**: card requests for the member and their employees (filter All / Mine / Employees, paging). **Request my card** (no body; needs `card-requests.manage`) and **Request for an employee** (pick an active employee; needs a provider type, an active business, `employees.manage` and `card-requests.manage`). The buttons hide when a request for that subject is already open; the server still decides.
- Detail shows the subject snapshot, delivery address, decision and audit history. While **Pending review** the owner can change the delivery address (all four fields) or cancel. **Approved** (API `accepted`) locks the address and doesn't mean a card was made or sent; issuance is guide 11-b.
- Rules live in `utility/cardRequestRules.ts`; service and hooks in `services/cardRequestService.ts` / `hooks/useCardRequests.ts`, including the SuperAdmin review queue, decisions (rejection needs a reason), audited cancel and on-behalf requests (no admin screens yet).

## Issued cards (guide 11-b)

- Account → **My cards**: cards issued to the member and their employees, each drawn from data (`components/card/CardFace.tsx`: number, name, membership/business, issue and expiry dates, validity). There is no card image, PDF or public QR link. Lists and detail refresh on return because validity is time-based.
- A card shows **Valid** only when it has been received, is flagged valid, isn't invalidated and hasn't expired (`isCardUsable` in `utility/cardRules.ts`); delivery status is shown separately.
- **I've received this card** appears only after dispatch, with a confirmation; receipt is never recorded automatically. **Request a replacement** appears for previously received cards: expired (from 30 days before expiry), damaged (while valid) or lost (cancels the old card immediately), each explained before confirming. It creates a new card request for approval.
- An issued card request links to its card. Service and hooks (`services/cardService.ts`, `hooks/useCards.ts`) include SuperAdmin issue, list, dispatch/delivery-failed/resend/reissue/receive/void (audit reasons) and validity settings (1–20 years). No admin screens yet.

## Client relationships (guide 12)

- Account → **My clients** (providers) and **My providers** (customers), both needing `clients.view`. Rows come from accepted inspections and are keyed by business + client, so the same customer under two businesses stays separate. There is no manual create or delete.
- Client rows show name, current membership ID (and the original one when a type change replaced it), a tap-to-call mobile (still shown for deactivated accounts), inspection counts and first/last dates. No email, profile or visit address.
- Providers can **Hide from my list** (`clients.delete`) and restore (`clients.manage`) with **Show hidden**; hiding changes only their list. Former providers with an ineligible type keep read-only history. **Include archived businesses** shows history from earlier businesses.
- Lists refresh on return and after inspection actions (acceptance creates or updates a relationship). Rules live in `utility/clientRules.ts`; service and hooks in `services/clientService.ts` / `hooks/useClients.ts`, including SuperAdmin routes (no admin screens yet).

## Price guide (guide 13)

- Find → **Price guide** (`price-catalogue.view`): published items with search, occupation filter and paging; an empty guide is a normal state. Each item shows its guide price, the range providers can submit within, and the provider average with its count ("No provider prices yet" when there is none, never $0). No tax label; it's guidance, not a quote. Refreshes on return.
- Management (create/edit/publish/retire/history) is delegated by permission (`price-catalogue-admin.view`, `.manage`, `.delete`; SuperAdmin bypasses), with services, hooks and rules ready (`services/priceCatalogueService.ts`, `hooks/usePriceCatalogue.ts`, `utility/priceCatalogueRules.ts`: code pattern, min ≤ guide ≤ max in cents, state table). Management screens wait for the admin-screens decision.

## Provider prices (guide 14)

- Account → Pricing → **My prices** (`prices.view`; kept outside Business so former providers can read their history): yearly prices with year, withdrawn and archived-business filters. **Add a price** lists the items this business can price (matching active listing) and submits the current UTC year's price within the item's range; the server picks the year.
- Price detail: **Change price** (current year), **Withdraw** (current year, or the latest older year; it stops counting and older years don't count instead), **Restore with a new price** (current-year withdrawn). Retired items allow withdrawal only; archived businesses and ineligible types are read-only. History is paged.
- **Item suggestions**: propose a missing item for an occupation you have an active listing in (name, optional description and suggested price), with status, decision reason and history. Approval creates a pending catalogue item; publishing and your price are separate steps.
- Writes refetch prices and the shared price guide (averages change). Rules live in `utility/providerPriceRules.ts`; service and hooks in `services/providerPriceService.ts` / `hooks/useProviderPrices.ts`, including SuperAdmin routes (no admin screens yet).

## Support (guide 15)

- Account → Help → **Support**, and **Need help?** on the setup screen (`support.view`; profile-setup sessions are supported, so the screens are mounted in both stacks via `components/support/supportRoutes.ts`).
- Conversation list with status filters (open, reply needed, closed), **New conversation** (title ≤ 200, message ≤ 5000, plain text), and a chat thread. Messages arrive newest first; pages are merged and deduplicated by ID in an inverted list, so **Show older messages** keeps the scroll position. A sent reply refetches the newest messages instead of being appended locally.
- **Close conversation** needs `support.delete`; a closed conversation shows **Reopen conversation** instead of the composer (reopening needs `support.manage`). The ticket and messages refetch on focus and after every action, including failures.
- Rules live in `utility/supportRules.ts`; service and hooks in `services/supportService.ts` / `hooks/useSupport.ts`. The thread screen takes an explicit `mode` (`member` / `admin`); the SuperAdmin inbox and admin routes have services and hooks only (no admin screens yet).

## Announcements (guide 16)

- Home shows the latest three announcements; Account → Help → **Announcements** has the full paged list and each announcement's plain-text body (rendered as text, never HTML). Needs full access and `announcements.view`; not available during profile setup.
- There's no unread tracking, scheduling or expiry. Lists and details refetch on focus, so retired items and audience changes (the member's current type) drop out; a detail that's no longer available says so.
- Service and hooks in `services/announcementService.ts` / `hooks/useAnnouncements.ts`, including SuperAdmin authoring (save is separate from publish; `all` sends no member types, selected types need at least one; retired is final). Lifecycle rules live in `utility/announcementRules.ts`; no admin screens yet.

## Issue reports (guide 17)

- Account → Help → **Report a problem**: what you were doing, what went wrong, an optional error reference (trace ID) and optional details. Platform, app version and device model are added automatically. Passwords, tokens, push tokens, emails and six-digit codes are redacted before sending, and the whole report is fitted to 8192 bytes (`utility/issueReport.ts`). The confirmation shows the report number; there is no report history for members, and reports are kept 90 days.
- SuperAdmin investigation routes (list, detail, history, status) are in `services/notificationService.ts` (no admin screens yet).

## Live updates (guide 18)

- `@microsoft/signalr` connects to the notification hub at `EXPO_PUBLIC_SIGNALR_URL` (full HTTPS hub URL, configured separately from the API origin; unset turns live updates off). Local dev uses `https://dev-signalr.auete.store/hubs/notifications` in `.env.local`; set the same variable in each EAS environment. The handbook's zourwa host is wrong.
- The connection runs while signed in, profile setup included (support notices), using the current access token (refreshed through the auth service near expiry). Delivery is targeted server-side; no user ID is sent. Sign-out or an account switch stops it and clears seen events. Failed starts and final closes retry with backoff (2 s → 60 s); returning to the app reconnects at once.
- Each `notificationReceived` notice is validated, deduplicated by `eventId` (bounded, across SignalR and foreground pushes), shown as an info toast, and refetches the affected screens' queries (debounced). Unknown types are ignored. Connect, reconnect and resume refetch every live-updated feature, because missed events aren't replayed. Mapping and deep links live in `utility/liveEvents.ts`; the lifecycle in `services/liveNotifications.ts`.
- Tapping a push opens its record once the session is restored (`hooks/useNotificationTaps.ts`): inspection, quote, card request, card, support conversation, item suggestion or announcement. The screen then loads it under the current permissions. Setup sessions only open support; SuperAdmin-only records (issue reports) and unknown types just open the app.
- The hub is first reached with a direct WebSocket (no negotiate step), because a negotiated connection ID fails when the hub runs on several instances without sticky sessions ("The connection could not be found on the server"). A failed start switches to the standard negotiated handshake for the next attempt, and back. SignalR logs go to `console.warn` in development only.
- Push data is read from `content.data`, JSON-string payloads, or the Android FCM trigger (app killed). Pushes without an ID open that feature's list.
- Connection state is kept in `notificationStore.live` (`off`, `connecting`, `live`, `reconnecting`, `retrying`); no indicator is shown yet.

## Location and maps

- `expo-location` gives the device position (`services/deviceLocation.ts`, foreground permission only; denial falls back to the map pin). `react-native-maps` shows the pin. Both work in Expo Go.
- The permission text is set by the `expo-location` plugin in `app.json`. A release Android build that shows the map needs a Google Maps API key (`android.config.googleMaps.apiKey`) before publishing.

## Reference choices (guide 06)

- `useReferenceChoices(catalogue)` loads the active choices for `regions` (public), `occupations`, `employee-positions` and `licence-types` (`reference.view`, allowed during profile setup) from `/api/members/{catalogue}`. Lists are never hard-coded.
- Choices are cached for the session (account-keyed, cleared at session boundaries) and refetched after management changes. Forms call `useInvalidateReferenceChoices()` after a validation error, because a choice can be retired while the form is open.
- `referenceOptions(choices, savedCode)` turns choices into `SelectInput`/`SelectMultiInput` options: submit `code`, show `displayName`. A saved code that is no longer active stays on the record, labelled "(retired)", and can't be picked as a new selection. In multi-select it can be removed but not added.
- Management (`/api/admin/reference-choices/{catalogue}`: list incl. inactive, create, edit label/order, retire, reactivate) has a service and hooks with independent `reference-admin.view` / `reference.manage` / `reference.delete` gates in `utility/access.ts`. Non-region codes must match `^[a-z][a-z0-9_]{1,79}$`. No management screen yet; that waits on the admin-screens decision.
- The legacy lookup/location hooks and services (caller-supplied endpoints, `BaseResponse` envelope) were removed.

## Application shell

- Sign in, register, email OTP, forgot-password OTP, and password reset.
- Registration opens email verification; verification returns to Sign In. Unverified sign-in (HTTP 403) opens verification.
- A full session opens Home. A session with `profileCompletionRequired` opens the account-setup placeholder.
- Home and Menu are minimal placeholders. Menu retains email/password settings and logout.
- Axios helpers/interceptors, refresh-token coordination, SecureStore, session restoration, the root QueryClient, Zustand stores, React Hook Form, Yup, theme components, toasts, loaders, and notification mechanisms are retained.
- Camera/photo selection and generic form controls remain reusable primitives. They do not submit profile data or implement verification requirements.

## Route protection

The installed Expo Router `6.0.24` / Expo SDK `54.0.35` supports [`Stack.Protected`](https://docs.expo.dev/router/advanced/protected/). The root stack declares authentication guards using the supported `guard` API and its default fallback. Disallowed groups are excluded from the navigator, and their entries are removed from history when access changes. No dependency upgrade or newer `redirectTo` API is used.

The shared Zustand selector `selectIsAuthenticated` requires both an in-memory access token and a known user. Stored refresh credentials or an unresolved user grant no dashboard access. `selectNeedsProfileSetup` additionally sends an authenticated session with `profileCompletionRequired` to `(setup)` instead of the dashboard. The existing session service remains responsible for establishing and persisting credentials. The root still renders no navigator until bootstrap settles and fonts load or fail. During cold restoration, an old in-memory token cannot bypass that startup gate.

| State after startup readiness | Available routes |
| --- | --- |
| Signed out | Sign in, registration, email OTP, password recovery/reset, and not-found |
| Authenticated, profile completion required | Account setup placeholder and not-found |
| Authenticated, full session | Home/Menu and credential settings, and not-found |

Signed-out protected deep links fall back to Sign In. After explicit login, Home opens without resuming the denied link. Signed-in navigation to ordinary auth routes falls back to Home. The dashboard also returns no descendants when authentication is absent, covering removal of an existing native route after logout or access loss. Clearing authentication still uses the existing generation, cache-cancellation, persistence, and refresh-recovery mechanisms.

Expo Router sitemap generation is disabled for this native app, and the root does not declare a generated `_sitemap` screen.

The unused `useProtectedRoute` hook and the fully replaced `useUserStateRedirect` hook have been removed. Navigation protection tests are included in `node tests/startup.test.cjs`. They execute the real application layouts, installed Expo guard-filtering code, React Navigation's stack state engine, and a request-capable React Query probe with mocked native/UI boundaries. Android/iOS deep-link delivery, native mounting/unmounting, and back gestures still need device verification. Client route guards do not replace backend authorization.

## API errors and notifications

`services/apiError.ts` produces a display-only `AppError`: a failure kind (`network`, `timeout`, `http`, `cancelled`, or `unknown`), message, and optional HTTP status, application code, trace ID, validation messages, and Retry-After seconds. Original request errors still propagate; never log their Axios configuration or private payloads. Only HTTP 400 `VALIDATION_FAILED` bodies with `application/problem+json` expose their approved detail/field messages. They are plain text and must not be logged. Other failures use controlled messages; HTTP 500 never exposes server detail/stack traces. `getTraceId` prefers `X-Trace-Id`, then body `traceId`.

Bare 400/401 failures use action-specific or generic feedback. HTTP 403 reports permission denial; 404 treats missing/inaccessible records identically; 413 reports an oversized file; 429 asks the user to wait (Retry-After is optional). HTTP 503 `EMAIL_DELIVERY_FAILED` explains that account creation may already have succeeded and suggests verification resend/recovery retry. `mapApiValidation(error, fields, aliases)` matches known controls case-insensitively, accepts explicit model-path aliases, and returns unmapped Identity/model messages as a summary. Feature forms bind the returned fields to React Hook Form without resetting drafts. Existing Yup validation remains active.

The endpoint policy table excludes both current Service Provider public/mobile auth paths and retained legacy public auth paths from automatic refresh/replay. An authenticated API request can share one coordinated refresh and replay once. Failed refresh or a replayed 401 clears the session and requires explicit sign-in. Anonymous requests never initiate refresh; account credentials are not forwarded to another origin. Authenticated requests send `Cache-Control: no-store`. Session-generation checks remain in dispatch, refresh completion, and error presentation.

Interactive failures show one error toast per error object, even when both the interceptor and hook/catch receive it. Cancellation and stale-session failures remain silent, including when a failed refresh retires its originating generation. Background push registration, refresh, and best-effort server logout also remain silent. Push registration stays protected despite its notification policy. Weak references track handled errors without retaining their payloads. Local authentication persistence failures also get one controlled error message; their presentation is bound to the generation that attempted persistence.

HTTP helpers remain generic, default to `unknown`, and return the complete response body. Service Provider callers explicitly pass `ApiResponse<Payload>`, for example `getData<ApiResponse<Payload>>(url)` or `postData<Request, ApiResponse<Payload>>(url, body)`. This retains typed data, `traceId`, and `code` without coupling the helpers to an envelope. Null/omitted data is preserved. Legacy, health, text, and binary responses keep their own types. The success interceptor preserves the full Axios response, including headers and status.

No runtime envelope validation or HTTP 2xx business-code rejection is applied. JSON transport rejects unsafe numeric integers rather than silently rounding int64 IDs. IDs larger than `Number.MAX_SAFE_INTEGER` remain unsupported until a lossless serialization contract is agreed with the backend; JWT `sub` stays a string. Raw text/PDF responses are not parsed as envelopes.
Shared integration helpers from guide 00:

- `utility/apiTransport.ts`: HTTPS origin normalization, URLSearchParams serialization (omits null/undefined, retains false/zero, repeats array keys), safe JSON numbers, and page/pageSize bounds. `hasMore` controls loading the next page; feature screens reset page to 1 when filters change and never fetch all pages automatically.
- `utility/permissions.ts`: normalize scalar/array role and permission claims; require every cumulative permission independently; full `SuperAdmin` bypass; explicit per-endpoint setup exceptions. Business types grant no permissions. These UI helpers do not verify JWT signatures or replace backend authorization. The signed-in user carries these normalized grants (see Account access); each feature supplies its access policy.
- `utility/apiValues.ts`: safe positive database IDs, named latitude/longitude bounds, offset-bearing timestamps with seconds, local-time formatting, and positive AUD amounts with at most two decimal places. Calculate money in integer cents and convert to dollar numbers only at the API boundary. Feature scheduling must resolve the selected timezone before serialization; location choices remain Australia-only.
- `services/apiFiles.ts`: native `picture`/`document` FormData, JPEG/PNG size/pixel checks, PDF size checks, multipart headers with platform-generated boundaries, and authorized PDF bytes with the safe filename `quote.pdf`. Feature services supply documented paths/methods and response types. Native save/view/share UI follows its feature guide. Root-relative public picture URLs resolve against the API origin in `ImageComponent`.

Queries and mutations default to no automatic retries. After a timed-out write, feature screens must refetch current state before allowing a repeat. PUT forms submit the complete required mutable record. Notifications trigger refetches rather than optimistic lifecycle assumptions. User content renders through React Native text primitives; preserve drafts on failure and never log credentials, codes, or private documents.

Envelope regressions are included in `tests/authSession.test.cjs`; `tests/apiResponse.typecheck.ts` checks default, typed, nullable, legacy, and raw-response signatures during `tsc --noEmit` without running requests.

Run API/auth/session regressions with `node tests/authSession.test.cjs`. These include actual Axios/helper behavior, React Query mutation callbacks, retained OTP resend handlers, and the existing form schemas/resolvers with mocked UI primitives. Live backend messages, status semantics, native transport failures, and device toast rendering still require backend/device verification.

## Startup and splash screen

The root shares one bootstrap promise per JavaScript runtime, including effect replay and root remounts. Later explicit session-restore/request triggers still work independently. Startup waits for session restoration to settle and for fonts to either load or fail. A rejected restoration releases the startup gate; the session service retains its existing recovery and persistent logout policies. An unexpected rejection settles only an unresolved authentication state still owned by the original generation, without touching persisted credentials or a newer session.

Font-loading failure renders the existing application shell using system fonts (the retained SpaceMono asset is not required by current screens). The root navigator mounts only after both startup gates settle. The splash is dismissed from the rendered root view's native layout callback, rather than immediately after scheduling a React state update. Rerenders/layout events share a pending dismissal, and unmounted effects cannot update startup state or initiate a fallback hide.

Splash prevention/dismissal rejections produce static diagnostics without raw errors. Failed asynchronous dismissal makes one synchronous Expo hide attempt while mounted; if both fail, a later layout may retry. There is no polling or retry loop. Native splash presentation, actual font rendering, and process restart behavior still require Android/iOS device verification. JavaScript cannot force an unresponsive native splash module to hide or settle a native storage call that never completes; pending restoration is not assigned an artificial timeout.

Run startup regressions with `node tests/startup.test.cjs` and session/cache/persistence regressions with `node tests/authSession.test.cjs`. Startup tests execute the real root/session modules with a deterministic hook runner and mocked native boundaries; they do not replace native rendering checks.

## Session cache isolation

The provider and session lifecycle use one shared QueryClient from `services/queryClient.ts`. Logout and invalid-session cleanup synchronously clear its query and mutation caches. Changes to the authenticated account ID or the presence of an access token also clear them. Normal token refresh for the same account preserves cached data.

All queries, including public/shared data, are cleared at these boundaries. No endpoint currently has an approved public-cache exemption; lookup/location endpoints may depend on the authorization header. Their query keys include the account ID, and their query functions pass React Query's cancellation signal to Axios. Public data is fetched again when an enabled query mounts or refetches.

QueryClient clearing cancels active queries and prevents their late results from repopulating the cache, including requests that ignore abort signals. Cleanup occurs synchronously inside the existing session-generation guards, so delayed cleanup from an older session cannot clear a newer account's cache. Clearing mutation records does not cancel or undo a server mutation already in progress; the retained mutation callbacks do not write query-cache data.

Run the session and cache regression checks with `node tests/authSession.test.cjs`.

## Authentication operation ordering

Every `useAuth` authentication/credential mutation captures a unique operation ID and its session generation synchronously at `mutate`/`mutateAsync` invocation. New authentication operations supersede earlier ones across hook instances, including requests queued or paused by React Query. Request bodies and callback payloads retain their existing shapes; operation metadata is local Axios configuration. Direct auth service calls also acquire an identity when no captured operation is supplied. Logout/session-generation changes invalidate operations from the previous generation. Starting a request alone does not clear a confirmed session or rotate its generation; the newest attempt wins even if it fails.

Axios checks the operation before dispatch and before returning a successful auth response. Superseded successes reject as cancellation; stale errors remain silent and cannot initiate refresh. Mutation callbacks check again after HTTP completion, including consumer callbacks and delayed password-reset navigation. Only a current token-bearing response may claim a new session generation. That winning operation then owns the generation throughout serialized persistence and callback completion. Normal same-account refresh remains coordinated by the existing session service and does not create a new authentication operation.

Credential/policy persistence checks both identities before each native step and before publishing authentication. A superseded commit cannot initiate its remaining writes or publish a user. An already dispatched native call cannot be cancelled: if no newer session has taken ownership, the old commit serializes a `blocked` restore policy after its in-flight write. If a newer session owns the generation, its persistence sequence runs last and old cleanup cannot modify it. Tokens retained by a superseded native write do not authorize restoration under a confirmed blocked policy. Existing limitations still apply when native storage never settles, durable blocking fails, or the process exits before a durable block is written. Server-side effects of requests already dispatched cannot be undone by these client guards.

Run `node --test tests/*.test.cjs` for regressions covering late login/registration/OTP responses, queued mutations, concurrent attempts with reused inputs, delayed callbacks, every persistence boundary, consumer callbacks, logout/account switching, and the existing refresh/cache/startup protections. Native boundaries and backend responses are controlled test substitutes; real-device/backend validation remains separate.

## Refresh failure policy

Guide 00 requires a new sign-in after a refresh request fails, including offline/timeout failures, HTTP errors, invalid success payloads, or inability to persist rotated credentials. The client does not infer revocation from human-readable text. A replayed request that returns another 401 also clears the session; it cannot start a second refresh.

A failed refresh advances the session generation, clears authentication/caches immediately, persists a blocked restore policy and attempts verified credential deletion using the existing serialized logout machinery. Existing route guards return the user to sign-in. Automatic restoration remains blocked until a successful explicit login, even across restart or an unconfirmed token deletion. Startup never falls back to a previous access token.

All callers sharing a failed refresh become stale together. Late 401s cannot refresh/replay under a newer session, and stale failures cannot clear a newer account. Shared finalizers only release their own operation. Successful same-account refresh preserves the generation and cache.

If local policy/token reads fail before a network refresh is attempted, the client denies access and clears memory/caches without deleting credentials. A later explicit restore may retry the local read. Missing/blocked policies or missing tokens never grant access or initiate a network refresh. This is distinct from a failed refresh request, which requires a new sign-in.

## Session persistence failures

The non-secret restore policy lives in `session-restore-policy.json` under Expo FileSystem's app documents directory, separately from SecureStore. The only valid records are `{ "version": 1, "state": "allowed" }` and `{ "version": 1, "state": "blocked" }`. Policy writes are read back before being treated as confirmed. The SDK's already locked `expo-file-system` version `19.0.23` is declared directly; no package versions were upgraded. Tokens are never written to the policy file.

Every automatic refresh/restore checks policy before reading a refresh token. A blocked, missing, malformed, unsupported, or unreadable policy denies restoration. Existing installations without a valid policy must log in explicitly; old saved tokens are never automatically approved. A transient policy-read error can be retried through an explicit restore, but never falls back to token-only authentication.

Login and token-bearing OTP verification start a new generation, immediately clear the previous in-memory account/caches, and block refresh/restore. One serialized operation writes and verifies `blocked`, writes new credentials to SecureStore, then writes and verifies `allowed`. Authentication is published only after all steps succeed for the current generation. Failures reject the setter and authentication mutation, skip push registration and existing success callbacks/toasts, and leave the app signed out. If the allowed-policy step fails, a guarded attempt re-establishes `blocked` before reporting failure. A superseded login returns `null` without modifying the newer session. Only a successful new explicit login re-enables restoration after logout; successful credential cleanup alone does not reset a blocked policy.

Refresh and restoration wait for persistence before publishing returned credentials or replaying protected requests. Failure to confirm a rotated-token write clears and blocks the session, including a native write that took effect but rejected. Pre-network local read failures remain retryable through an explicit restore. Successful same-account refresh does not advance the generation or clear caches.

Logout immediately advances the generation, blocks refresh, and clears authentication/caches. It writes and verifies `blocked` before reading the saved token or attempting deletion. A failed policy write does not prevent safe credential deletion. A failed token read also reaches local cleanup. Deletion is followed by a SecureStore read-back: promise resolution alone does not prove absence (including on the installed iOS SecureStore implementation). The block remains persisted even when deletion succeeds. With a confirmed block, retained tokens are ignored across restarts and repeated deletion failures.

`clearSession()` and `logoutAndGoToLogin()` return `true` only when local durable protection was confirmed by a blocked policy OR verified token absence. They return `false` for an incomplete or superseded logout; neither result claims backend revocation. If both local protections remain unconfirmed, a static diagnostic explicitly reports incomplete durable logout. Access stays cleared, and existing navigation still completes. A best-effort server logout runs after local cleanup using credentials captured for that logout only. Axios preserves the captured authorization header only for `/api/auth/mobile/sign-out` while refresh is blocked, with existing generation checks. Other endpoints cannot use that exception. A final generation-guarded cache clear removes the logout mutation and queries created during the network wait.

A later explicit logout/clear, session restore, or direct refresh call can retry unconfirmed deletion in the same runtime. Concurrent cleanup callers share one attempt and remain signed out, even after successful cleanup. Such cleanup reads SecureStore only to verify removal, never to refresh authentication. Protected Axios requests reject while refresh is blocked; they do not themselves retry deletion. There is no polling, foreground retry, or retry loop. Policy and credential operations use the same serialized queue, with generation checks between native steps. Stale queued work is skipped; older completions, policy rollback, and finalizers cannot clear or block a newer session. A new explicit login can supersede old cleanup and must complete its own persistence sequence.

Guarantee boundary: a crash before any durable blocking record or verified token removal cannot preserve an unwritten logout intention. If both fail, the old policy/token may remain usable after restart; the operation reports incomplete protection rather than success. File read-back verifies the current stored value, not hardware flush, backup rollback, or power-loss durability. Native calls cannot be cancelled, and one that never settles can hold up the queue. Device process-kill/relaunch and native persistence behavior require Android/iOS verification. Backend revocation, refresh-token-family rotation races, and access-token invalidation/expiry remain unconfirmed and are required to make retained/copied credentials unusable outside this local restore gate. No new backend contract is assumed.

## Approved application identity and external setup

The display name is **Service Provider** (**Service Provider - Dev** for development). The local package name, Expo slug, and URL scheme are `service-provider`. The neutral icon has an editable SVG source alongside its PNG export. Android and iOS use the approved identifiers listed above. The active checkout folder must be renamed manually to `service-provider`: stop Expo/Metro, close the IDE/workspace, rename the folder from its parent directory, then reopen the renamed checkout. The running Codex workspace cannot safely rename its own root.

EAS project `02557e69-e417-490c-81ea-6d46a925c66a`, its ownership, and Firebase ownership are retained. No cloud projects, app registrations, credentials, or remote variables were changed. Before cloud builds/submission, the existing owners must reconcile the `service-provider` slug with that EAS project, register/configure the approved native identifiers and signing/store records, and supply Android Firebase clients/files for both packages within the existing Firebase project. Do not reassign cloud ownership as part of this naming change.

The native identifiers create separate applications with their own installation storage; existing sessions, theme preferences, and push tokens are not migrated from an older installation. Rebuild/install the native apps and update external deep links/callback allowlists to `service-provider://` where applicable; no old-scheme alias or new routes are introduced. After renaming, restart Metro with `npm start -- --clear` and use `expo export --clear` for fresh exports so cached Expo constants do not retain the previous scheme. The EAS profile/variant matrix and validation policy remain unchanged. Neither `google-services.json` nor `google-services.dev.json` is supplied. Native Android builds reject missing/mismatched Firebase input; local configuration and JavaScript checks remain usable. Signing, native builds, installed-app deep links, and push delivery require owner/device verification.

## Deferred decisions

The BRDs must define provider profiles, roles/permissions, onboarding, approval states, support/content pages, media uploads, locations/lookups, and any other product functionality. Authentication compatibility, API hosts, native/cloud ownership, Firebase files, store links, and push routing also remain pending.

Further infrastructure/security enhancements remain separate tasks. Password rules and theme persistence remain unchanged.

See [the cleanup report](docs/cleanup-report.md) for the file inventory and validation results.

## Push notification lifecycle

The root layout owns notification listeners and starts permission/token acquisition before sign-in. Push setup never gates fonts, theme hydration, session restoration, splash dismissal, or protected routes. An unset `EXPO_PUBLIC_BASE_URL` does not start this lifecycle. Token acquisition additionally requires a physical native device, a configured EAS project, and a native build rather than Expo Go. It uses the retained EAS project and the approved Service Provider native identities; build-variant validation remains unchanged. `expo-notifications` is included in the config-plugin list for native notification configuration.

The Expo token belongs to the installation. It remains in the existing auth store's `pushNotificationToken` field for logout compatibility, independently of account authentication, and is reacquired in a fresh process. The old SecureStore `push_token` entry is no longer read or written. Concurrent acquisition attempts share one operation, root remounts do not repeat permission prompts, and native token changes resolve the latest Expo token before publishing it. Foregrounding checks for permission changes and can retry a failed acquisition without prompting again or fetching another Expo token when the current one is still usable. Authentication becoming available can also retry a missing token. Denial and native/Expo errors leave authentication untouched and produce no alerts or token/payload logs.

Guide 17 registration (`services/pushRegistration.ts`, started by the root hook): once a session (full or profile setup, with `notifications.manage`) and a real Expo token exist, the app registers `installationId` + `platform` + token with `POST /api/notifications/installations`, once per account/installation/token, and again after token rotation or a new sign-in. A refused token (for example owned by another account) is not retried, and the refusal shows in Account, not as a toast (the route is silent in `services/api.ts`). Account → **Notifications** turns this device on or off: off calls `DELETE /api/notifications/installations/{installationId}` and is remembered on the device until turned back on. The best-effort `/api/auth/mobile/sign-out` request sends the refresh token and the stable installation ID; the backend removes that one destination. The legacy `/PushNotification/*` hook was removed.

Foreground presentation retains sound, badge, banner, and list handling. Foreground notifications and raw tap responses are available in `notificationStore`. The live response listener and startup's last-response read deduplicate taps across root remounts. `takeNotificationResponse(ready)` provides a single-consumption handoff only when the caller reports root readiness and a confirmed session exists. Responses are bound to the current session generation and known account; logout/account changes clear queued data, including changes while the root was unmounted. A cold-start tap can wait for restoration in the same generation, but is discarded across an explicit-login generation. The handoff does not inspect payload fields, open URLs, or navigate. Service Provider payload validation, recipient identity, and destinations require an approved backend/routing contract.

Run `node --test tests/*.test.cjs` for native-boundary, root/session, configuration, and theme regressions. Actual FCM/APNs credentials, native builds, device delivery, permission settings, and process-kill/tap behavior still require Android/iOS verification with the approved EAS/Firebase setup. No cloud credentials are provisioned by this task.

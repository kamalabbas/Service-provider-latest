# Service Provider

A reusable React Native / Expo application shell. Product features and onboarding will be implemented after the Service Provider BRDs and API contracts are approved.

## Local development

Use the existing lockfile; do not upgrade Expo or package versions as part of setup.

```sh
npm ci
npm start
```

Other commands:

```sh
npm run android
npm run ios
npm run web
npm run lint
npx tsc --noEmit
```

Native builds require the appropriate Android/iOS toolchain. iOS builds require macOS or EAS.

## Backend configuration

Copy `.env.example` to a local `.env` and supply an approved `EXPO_PUBLIC_BASE_URL`. EAS profiles contain an explicitly blank value; replace it only with an approved backend URL when enabling a build environment. Remote EAS variables have not been inspected. Never put secrets in `EXPO_PUBLIC_*` values.

With the API host unset, the sign-in screen launches but backend-dependent actions are disabled. Startup skips session restoration and push/version requests; persisted refresh credentials are preserved. No demonstration credentials, fake sessions, or replacement backend paths are provided.

The existing authentication, session, notification, and version-check implementations remain connected to their generic `/Auth/*` and `/PushNotification/*` paths. Compatibility with the new backend is unverified. Confirm response envelopes, user IDs, email verification status, tokens, refresh rotation, logout, and version policy before configuring a host.

Lookup/location serialization and query hooks remain reusable. Their endpoints must be passed explicitly from an approved API contract. Without endpoints, the hooks are disabled and the services reject manual calls. No lookup domains or product-specific profile rules have been invented.

## Application shell

- Sign in, register, email OTP, forgot-password OTP, and password reset.
- Registration opens email verification. A login response without tokens opens OTP only when it explicitly reports `PENDING_VERIFICATION`; other tokenless responses stay signed out.
- A token-bearing session opens Home. There are no profile-completion or approval gates.
- Home and Menu are minimal placeholders. Menu retains email/password settings and logout.
- Axios helpers/interceptors, refresh-token coordination, SecureStore, session restoration, the root QueryClient, Zustand stores, React Hook Form, Yup, theme components, toasts, loaders, and notification mechanisms are retained.
- Camera/photo selection and generic form controls remain reusable primitives. They do not submit profile data or implement verification requirements.

## Route protection

The installed Expo Router `6.0.24` / Expo SDK `54.0.35` supports [`Stack.Protected`](https://docs.expo.dev/router/advanced/protected/). The root stack declares authentication guards using the supported `guard` API and its default fallback. Disallowed groups are excluded from the navigator, and their entries are removed from history when access changes. No dependency upgrade or newer `redirectTo` API is used.

The shared Zustand selector `selectIsAuthenticated` requires both an in-memory access token and a known user. Stored refresh credentials, an unresolved user, or a tokenless pending-verification user grant no dashboard access. The existing session service remains responsible for establishing and persisting credentials. The root still renders no navigator until bootstrap settles and fonts load or fail. During cold restoration, an old in-memory token cannot bypass that startup gate.

| State after startup readiness | Available routes |
| --- | --- |
| Signed out, no force policy | Sign in, registration, email OTP, password recovery/reset, not-found, and generated sitemap |
| Authenticated, no force policy | Home/Menu and credential settings, not-found, and generated sitemap |
| Confirmed force policy, either session state | Only `/(auth)/forced-update` |

Signed-out protected deep links fall back to Sign In. After explicit login, Home opens without resuming the denied link. Signed-in navigation to ordinary auth routes falls back to Home. The dashboard also returns no descendants when authentication is absent or a force policy is active, covering removal of an existing native route after logout or access loss. Clearing authentication still uses the existing generation, cache-cancellation, persistence, and refresh-recovery mechanisms.

The root's existing version check is shared through `AppUpdatePolicyContext`. Nested layouts and the update screen consume that value without starting another check. Version loading/failure remains nonblocking; normal routes are available until a force policy is known. Once known, guards exclude normal routes, not-found, and Expo's generated sitemap. The existing update screen reads policy content directly, so no imperative redirect or URL-parameter handoff is required. Clearing the force policy restores normal route availability. Soft-update feedback still appears once after startup readiness.

The unused `useProtectedRoute` hook and the fully replaced `useUserStateRedirect` hook have been removed. Navigation protection tests are included in `node tests/startup.test.cjs`. They execute the real application layouts, installed Expo guard-filtering code, React Navigation's stack state engine, and a request-capable React Query probe with mocked native/UI boundaries. Android/iOS deep-link delivery, native mounting/unmounting, back gestures, and web navigation still need device/browser verification. Client route guards do not replace backend authorization.

## API errors and notifications

`services/apiError.ts` produces a small display-only `AppError`: a failure kind (`network`, `timeout`, `http`, `cancelled`, or `unknown`), controlled message, and optional HTTP status. The shared presenter in `services/api.ts` uses it for interceptor, authentication-mutation, and OTP-resend failures. Original errors still propagate unchanged; they can contain private Axios configuration and must never be logged or displayed directly. The projection never includes request bodies, headers, raw error messages, or backend `detail`, `title`, `message`, or validation payloads. No backend error text has an approved safe-display contract yet.

HTTP 400/401 feedback uses the known action (sign-in, registration, code verification/request, password reset, or credential changes). Other configured requests get generic validation/authorization feedback. HTTP 403 reports permission denial, 429 requests waiting before another attempt, and 5xx reports temporary service unavailability. Offline/network failures and timeouts have separate connection/retry messages. No status is interpreted as a particular field error or confirmed refresh-token revocation. Existing Yup/inline form validation is unchanged.

The endpoint policy table in `services/api.ts` excludes sign-in, sign-up, email OTP verification/resend, password recovery/reset, version checks, refresh, and logout from automatic 401 refresh/replay. Credential settings, push calls, and configured lookup/location calls keep protected-request behavior, including recovery with retained credentials after a transient refresh failure. Other configured endpoints default to protected behavior; review the table when introducing new endpoints. A protected request still uses the existing shared refresh operation and can replay at most once. Session-generation checks remain in dispatch, refresh completion, and error presentation.

Interactive failures show one error toast per error object, even when both the interceptor and hook/catch receive it. Cancellation and stale-session failures remain silent, including when a failed refresh retires its originating generation. Version checks, background push registration, refresh, and best-effort server logout also remain silent. Push registration stays protected despite its notification policy. Weak references track handled errors without retaining their payloads. Local authentication persistence failures also get one controlled error message; their presentation is bound to the generation that attempted persistence.

Non-refresh HTTP 2xx behavior is unchanged, including bodies containing `success: false`; the helpers return those bodies and existing success callbacks still run. This can only be refined after the backend response contract is confirmed. OTP resend retains its existing resolved-response/message-presence behavior but displays controlled success text instead of backend free text. The refresh service's existing response validation remains unchanged.

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

## Refresh failure policy

Invalid/revoked refresh-token detection is pending backend contract confirmation. All refresh errors are treated as recoverable for now, including offline/timeout failures, HTTP 400/401/403/429/500/503 responses, and malformed success payloads. HTTP status alone and unverified error-code/message strings do not establish a terminal failure. A response explicitly reporting `success: false` is also a failed refresh, even if it contains token fields.

A failed refresh returns no access token, clears in-memory authentication and query/mutation caches, and preserves the refresh token in SecureStore. With a valid `allowed` restore policy, a later protected request or explicit session restore may try again using one shared refresh operation. There are no automatic retries within that failed request, foreground retries, polling, new UI, or routing changes. Startup uses the same failure handling and never authenticates using the previous access token as a fallback. If no refresh token is stored, the app stays signed out and no network refresh is attempted.

Before clearing state or caches, a current refresh failure (including a missing saved token or a SecureStore read/write failure) advances the session generation once. All callers sharing that refresh become stale together; delayed 401s from that generation cannot start another refresh or replay under a recovered session. They reject with their original request error without producing stale session toasts. A stale failure from before logout or a newer login does not advance the generation or run cleanup. Recovery reads the retained token under the new generation. Successful refresh and recovery do not advance it again. Shared refresh/restore finalizers only release their own operation, so an older completion cannot detach recovery started during cleanup.

Only explicit session clearing/logout deletes persisted refresh credentials. A successful refresh still replaces them with the returned token. Native storage writes remain serialized and session-generation guarded. If the backend rotates a token but its response is lost, the retained token may no longer be usable; recovery and terminal classification for that case remain dependent on the unconfirmed backend contract.

## Session persistence failures

The non-secret restore policy lives in `session-restore-policy.json` under Expo FileSystem's app documents directory, separately from SecureStore. The only valid records are `{ "version": 1, "state": "allowed" }` and `{ "version": 1, "state": "blocked" }`. Policy writes are read back before being treated as confirmed. The SDK's already locked `expo-file-system` version `19.0.23` is declared directly; no package versions were upgraded. Tokens are never written to the policy file.

Every automatic refresh/restore checks policy before reading a refresh token. A blocked, missing, malformed, unsupported, or unreadable policy denies restoration. Existing installations without a valid policy must log in explicitly; old saved tokens are never automatically approved. A transient policy-read error can be retried through existing restore/request triggers, but never falls back to token-only authentication.

Login and token-bearing OTP verification start a new generation, immediately clear the previous in-memory account/caches, and block refresh/restore. One serialized operation writes and verifies `blocked`, writes new credentials to SecureStore, then writes and verifies `allowed`. Authentication is published only after all steps succeed for the current generation. Failures reject the setter and authentication mutation, skip push registration and existing success callbacks/toasts, and leave the app signed out. If the allowed-policy step fails, a guarded attempt re-establishes `blocked` before reporting failure. A superseded login returns `null` without modifying the newer session. Only a successful new explicit login re-enables restoration after logout; successful credential cleanup alone does not reset a blocked policy.

Refresh and restoration also wait for persistence before publishing returned credentials or replaying protected requests. Read/write failures keep Task 5's recoverable policy: return no new access, advance the generation once, clear authentication/caches, preserve whatever credentials remain saved, and allow a later existing request/restore trigger to try again. Successful same-account refresh does not advance the generation or clear caches.

Logout immediately advances the generation, blocks refresh, and clears authentication/caches. It writes and verifies `blocked` before reading the saved token or attempting deletion. A failed policy write does not prevent safe credential deletion. A failed token read also reaches local cleanup. Deletion is followed by a SecureStore read-back: promise resolution alone does not prove absence (including on the installed iOS SecureStore implementation). The block remains persisted even when deletion succeeds. With a confirmed block, retained tokens are ignored across restarts and repeated deletion failures.

`clearSession()` and `logoutAndGoToLogin()` return `true` only when local durable protection was confirmed by a blocked policy OR verified token absence. They return `false` for an incomplete or superseded logout; neither result claims backend revocation. If both local protections remain unconfirmed, a static diagnostic explicitly reports incomplete durable logout. Access stays cleared, and existing navigation still completes. A best-effort server logout runs after local cleanup using credentials captured for that logout only. Axios preserves the captured authorization header only for `/Auth/Logout` while refresh is blocked, with existing generation checks. Other endpoints cannot use that exception. A final generation-guarded cache clear removes the logout mutation and queries created during the network wait.

A later explicit logout/clear, session restore, or direct refresh call can retry unconfirmed deletion in the same runtime. Concurrent cleanup callers share one attempt and remain signed out, even after successful cleanup. Such cleanup reads SecureStore only to verify removal, never to refresh authentication. Protected Axios requests reject while refresh is blocked; they do not themselves retry deletion. There is no polling, foreground retry, or retry loop. Policy and credential operations use the same serialized queue, with generation checks between native steps. Stale queued work is skipped; older completions, policy rollback, and finalizers cannot clear or block a newer session. A new explicit login can supersede old cleanup and must complete its own persistence sequence.

Guarantee boundary: a crash before any durable blocking record or verified token removal cannot preserve an unwritten logout intention. If both fail, the old policy/token may remain usable after restart; the operation reports incomplete protection rather than success. File read-back verifies the current stored value, not hardware flush, backup rollback, or power-loss durability. Native calls cannot be cancelled, and one that never settles can hold up the queue. Device process-kill/relaunch and native persistence behavior require Android/iOS verification. Backend revocation, refresh-token-family rotation races, and access-token invalidation/expiry remain unconfirmed and are required to make retained/copied credentials unusable outside this local restore gate. No new backend contract is assumed.

## Temporary native and cloud identity

The display name is **Service Provider**, and the local package name and Expo slug are `service-provider`. The neutral icon has an editable SVG source alongside its PNG export.

Do not publish, submit, or reassign cloud ownership until these identity decisions are resolved. The renamed slug must be reconciled with the existing EAS project by its owner before cloud builds/submission.

EAS build profiles and the `APP_VARIANT` mechanism remain. The dev variant appends `.dev` to native identifiers. The existing Firebase file references remain unresolved: neither `google-services.json` nor `google-services.dev.json` is supplied. Development configuration deliberately continues to reject missing/mismatched Firebase input; native builds and push delivery are not verified.

## Deferred decisions

The BRDs must define provider profiles, roles/permissions, onboarding, approval states, support/content pages, media uploads, locations/lookups, and any other product functionality. Authentication compatibility, API hosts, native/cloud ownership, Firebase files, store links, and push routing also remain pending.

Further infrastructure/security enhancements remain separate tasks. Password rules, theme persistence, and numeric version encoding remain unchanged.

See [the cleanup report](docs/cleanup-report.md) for the file inventory and validation results.

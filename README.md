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

## Temporary native and cloud identity

The following values are intentionally preserved by owner approval. They are unresolved migration configuration, not final Service Provider production identifiers:

| Setting | Temporarily retained value |
| --- | --- |
| Android package | `com.kimzaster.familytree` |
| iOS bundle identifier | `com.kimzaster.familytree` |
| URL scheme | `familytree` |
| EAS project ID | `02557e69-e417-490c-81ea-6d46a925c66a` |

The display name is **Service Provider**, and the local package name and Expo slug are `service-provider`. The neutral icon has an editable SVG source alongside its PNG export.

Do not publish, submit, or reassign cloud ownership until these identity decisions are resolved. The renamed slug must be reconciled with the existing EAS project by its owner before cloud builds/submission.

EAS build profiles and the `APP_VARIANT` mechanism remain. The dev variant appends `.dev` to native identifiers. The existing Firebase file references remain unresolved: neither `google-services.json` nor `google-services.dev.json` is supplied. Development configuration deliberately continues to reject missing/mismatched Firebase input; native builds and push delivery are not verified.

## Deferred decisions

The BRDs must define provider profiles, roles/permissions, onboarding, approval states, support/content pages, media uploads, locations/lookups, and any other product functionality. Authentication compatibility, API hosts, native/cloud ownership, Firebase files, store links, and push routing also remain pending.

Infrastructure/security enhancements are a later task. Existing token-refresh policy, logging, cache/session behavior, password rules, theme persistence, and numeric version encoding have not been redesigned.

See [the cleanup report](docs/cleanup-report.md) for the file inventory and validation results.

# Service Provider app

React Native / Expo (SDK 54, Expo Router 6) Android + iOS app for the Service
Provider backend. Branding follows the AUETE logo (green `#1A543C`).

## Implementing BRDs

The "BRDs" are the frontend handbook guides in
`C:\Users\kamal\Desktop\Work\Service provider\frontend\NN-*.md`.

- Follow [docs/brd/IMPLEMENTATION_TEMPLATE.md](docs/brd/IMPLEMENTATION_TEMPLATE.md) for every guide.
- Pick the next guide and check dependencies in [docs/brd/ROADMAP.md](docs/brd/ROADMAP.md); update its Status when a guide lands.
- The API host is `https://dev-api-sp.auete.store` and the SignalR hub is `https://dev-signalr.auete.store/hubs/notifications` (`EXPO_PUBLIC_SIGNALR_URL`). The handbook's `zourwa.com` hosts are wrong.

## Rules

- **Never launch, drive, reload or screenshot the emulator / Expo Go unless the user asks.**
- Never add or upgrade npm packages without the user's approval (use the existing lockfile).
- Keep existing code patterns. Use the design system (`@/constants/Theme`, `useThemeColor`, `components/ui/*`); never hard-code colors, spacing or font sizes in screens.
- Commit/push only when asked. Commit subjects describe what changed (guide number only as a suffix, e.g. "Add profile setup form (guide 04)"), with a body listing the changes. Flow: branch `guide-NN-<slug>` (or a descriptive name) → commit → fast-forward `main` → push both. The GitHub CLI is not installed, so there are no PRs.
- The backend is unreachable from this machine (a network firewall intercepts `auete.store` TLS). Don't bypass certificate checks; report "not verified against the live API".

## Commands

```bash
npx tsc --noEmit
npm run lint
node --test tests/*.test.cjs
npx expo export --platform android --output-dir <scratch dir>
```

## Code map

| Area | Location |
|---|---|
| HTTP client, interceptors, error toasts | `services/api.ts`, `services/apiError.ts` |
| Session (refresh, restore, logout) | `services/authSession.ts`, `hooks/useAuth.ts` |
| Push and live updates (SignalR), event → query refetch, push-tap links | `services/pushNotifications.ts`, `services/liveNotifications.ts`, `utility/liveEvents.ts` |
| Signed-in identity from JWT claims | `utility/accessToken.ts`, `interfaces/user.interface.ts` |
| Permissions | `utility/permissions.ts`; per-guide gates in `utility/access.ts` |
| Reference choices (regions, occupations, positions, licence types) | `hooks/useReferenceChoices.ts` + `utility/referenceOptions.ts` → `SelectInput` / `SelectMultiInput` |
| Transport/value helpers (paging, money, dates, IDs, files) | `utility/apiTransport.ts`, `utility/apiValues.ts`, `services/apiFiles.ts` |
| Design tokens and colors | `constants/Theme.ts`, `constants/Colors.ts` |
| Route groups | `app/(auth)`, `app/(setup)` (profile completion), `app/(dashboard)` (full session) |

## Test harness constraints

Tests run modules in a `vm` sandbox. Auth screens are rendered by calling them
directly, with `@/components/*` mocked, so screens must keep stateful UI, icons
and animations inside components. `app/**/_layout.tsx` files are mounted by
`tests/startup.test.cjs`; don't import new external modules there.

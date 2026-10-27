# BRD guide implementation template

Follow this for every frontend handbook guide (the "BRDs") in
`C:\Users\kamal\Desktop\Work\Service provider\frontend\NN-*.md`. Guides 00 and
01 are done; [ROADMAP.md](ROADMAP.md) gives the order, dependencies and status.

The handbook describes the backend contract. This repository decides how the
contract appears in the app. When the two disagree, the handbook wins on wire
format and rules, and this template wins on code structure. **One exception:
the API host is `https://dev-api-sp.auete.store`; the handbook's `zourwa.com`
hosts are wrong.**

---

## 1. Workflow per guide

### Step 0: Prepare
- [ ] Read the whole guide, both the hand-written part (screens, rules, acceptance
      checks) and the generated reference (endpoints, models, field rules).
- [ ] Re-read the parts of `00-integration-basics.md` that the guide relies on
      (paging, money, dates, files, permissions).
- [ ] Check [ROADMAP.md](ROADMAP.md): its dependencies are done, and note any
      packages it needs. **Never add or upgrade a package without the user's approval.**
- [ ] Decide member scope and admin scope (see the roadmap's open decision on admin screens).

### Step 1: Gap analysis
Build a table and show it in the final report:

| Guide requirement | Current code | Action |
|---|---|---|
| e.g. `GET /api/members/me/profile` returns `data: null` before first save | not implemented | add `getMyProfile`, treat null as "first profile" |

Include legacy code the guide replaces (old `/Auth/*`, `/PushNotification/*`,
`BaseResponse<T>` users). Remove or migrate it in the same guide when it is
clearly superseded; otherwise list it as a follow-up.

### Step 2: Contracts → `interfaces/<feature>.interface.ts`
### Step 3: Service → `services/<feature>Service.ts`
### Step 4: Access policy → `utility/access.ts`
### Step 5: Hooks → `hooks/use<Feature>.ts`
### Step 6: Screens → `app/(dashboard)/<feature>/…` (or `(setup)` for onboarding)
### Step 7: Tests → `tests/<feature>.test.cjs`
### Step 8: Docs → README section + ROADMAP status
### Step 9: Verify (below)
### Step 10: Report (below), then commit only when the user asks

Sections 2–5 give the rules and skeletons for steps 2–7.

---

## 2. Contract rules (apply in every interface file)

| Topic | Rule |
|---|---|
| Envelope | Every JSON controller returns `ApiResponse<T>` (`traceId`, `code`, `data?: T \| null`). Type helpers as `getData<ApiResponse<Payload>>(…)`. Never use the legacy `BaseResponse<T>` for new code. |
| Lists | Paged lists return `ApiResponse<ApiPage<T>>` (`items`, `page`, `pageSize`, `hasMore`); some admin lists are plain arrays, so check each model. No `totalCount`. |
| `data: null` | A valid success (no profile yet, action with no payload). Never treat it as an error. |
| Field names | camelCase, exactly as in the guide's model tables. |
| Required vs nullable | `Required: no` → optional (`?`). `Nullable: yes` → `\| null`. Both can apply. |
| IDs | Database IDs are `number` (int64, checked safe by transport). Membership IDs, card numbers, quote numbers, installation UUIDs and JWT `sub` are `string`. Never derive one from another. |
| Dates | Received as UTC ISO strings (`string`). Send with explicit offset and seconds via `toUtcTimestamp`. Display with `formatLocalTimestamp`. |
| Money | AUD dollars as `number` on the wire; calculate in cents (`audToCents`/`centsToAud`), display with `formatAud`. |
| Enums | String unions of the documented codes (e.g. `"tradeperson" \| "builder" \| …`). Ignore unknown future values safely. |
| Comments | One-line doc comment only where the rule is not obvious from the type (e.g. "send explicitly; defaults false"). |

## 3. Code skeletons

Match the surrounding code: double quotes in `app/`, `hooks/`, `services/`;
short purpose comments; no over-abstraction.

### 3.1 Interface
```ts
// interfaces/profile.interface.ts
import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/** GET /api/members/me/profile — data is null before the first save. */
export interface MemberProfile {
  id: number;
  firstName: string;
  lastName: string;
  mobilePhone: string;
  website?: string | null;
  /** Send explicitly; the server defaults it to false when omitted. */
  isPostalSameAsAddress: boolean;
  updatedAtUtc: string;
}

/** PUT replaces the record: submit every mutable field. */
export type SaveMemberProfileRequest = Omit<MemberProfile, "id" | "updatedAtUtc">;

export type MemberProfileResponse = ApiResponse<MemberProfile>;
export type MemberProfilePage = ApiResponse<ApiPage<MemberProfile>>;
```

### 3.2 Service
```ts
// services/profileService.ts
import { MemberProfileResponse, SaveMemberProfileRequest } from "@/interfaces/profile.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireDatabaseId } from "@/utility/apiValues";
import { getData, putData } from "./api";

// Guide 04: profiles. One function per endpoint; paths exactly as documented.
export const getMyProfile = (signal?: AbortSignal) =>
  getData<MemberProfileResponse>("/api/members/me/profile", { signal });

export const saveMyProfile = (body: SaveMemberProfileRequest) =>
  putData<SaveMemberProfileRequest, MemberProfileResponse>("/api/members/me/profile", body);

// Paged lists: validated page/pageSize, absent filters omitted by the serializer.
export const listThings = (filters: { search?: string }, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<ThingPage>("/api/things", { params: { ...filters, ...pageParams(page, pageSize) }, signal });

// Path IDs are validated before use.
export const getThing = (id: number, signal?: AbortSignal) =>
  getData<ThingResponse>(`/api/things/${requireDatabaseId(id)}`, { signal });
```
Rules:
- Errors: the Axios interceptor already shows one toast per failure. Services never catch to toast.
- Files: use `pictureForm`/`documentForm` + `uploadApiFile`, and `downloadPrivatePdf` for private PDFs (`services/apiFiles.ts`).
- Public pictures: resolve root-relative URLs with `resolvePublicMediaUrl`.
- Admin routes go in the same service file under a `// Admin (guide 19)` heading, named `admin…`.

### 3.3 Access policy
```ts
// utility/access.ts: one file for every gate, grouped under a "Guide NN" comment.
// (The test harness resolves "@/x" to "x.ts" only, so don't use folder index files.)

// Guide 04: profiles. Copy each endpoint's Access row; suffixes are independent.
export const canViewOwnProfile = (user?: User | null) => can(user, ["profiles.view"], true);
export const canEditOwnProfile = (user?: User | null) => can(user, ["profiles.manage"], true);
```
`can(user, permissions, allowDuringSetup)` and `grantsOf(user)` already exist in
`utility/access.ts` (guide 06 added the first gates).
- `allowDuringSetup = true` only where the guide says "profile-setup access supported".
- Hide entry points the user can't use; still handle 403 when the server disagrees.
- Business user type never grants permissions.

### 3.4 Hooks
```ts
// hooks/useProfile.ts
import { getMyProfile, saveMyProfile } from "@/services/profileService";
import { useAuthStore } from "@/stores/authStore";
import { canViewOwnProfile } from "@/utility/access";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Keys always include the account ID so a different account never reads this cache.
export const profileKeys = {
  all: (accountId: string | null) => ["profile", accountId] as const,
  me: (accountId: string | null) => [...profileKeys.all(accountId), "me"] as const,
};

export function useMyProfile() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: profileKeys.me(user?.id ?? null),
    queryFn: ({ signal }) => getMyProfile(signal),
    enabled: canViewOwnProfile(user),
    select: (response) => response.data ?? null,
  });
}

export function useSaveMyProfile() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: saveMyProfile,
    // Refetch rather than assume: the server may normalise or reject stale state.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.all(accountId) }),
  });
}
```
Rules:
- No retries (global default). Disable submit while `isPending`.
- After a **timeout** on a write, refetch the record before allowing a retry.
- Lifecycle actions invalidate both the detail and its list.
- Paged lists use `useInfiniteQuery` with `getNextPageParam: last => last.data?.hasMore ? page + 1 : undefined`; never auto-fetch every page; reset to page 1 when filters change.
- Live-notification refetch (guide 18) will invalidate these same keys, so keep them in the exported `…Keys` object.

### 3.5 Screens
Placement: member screens in `app/(dashboard)/<feature>/` with a `_layout.tsx`
stack. Onboarding screens in `app/(setup)/`. Add a tab only for top-level areas.

Use the design system. Never hand-roll colors, spacing or font sizes:

| Need | Use |
|---|---|
| Page with large title, scroll and safe area | `Screen` (`@/components/ui/Screen`) |
| Auth-style form page | `AuthLayout` |
| Settings-style grouped rows | `ListSection` + `ListRow` |
| Text | `ThemedText` with `type` (`display`, `subtitle`, `headline`, `callout`, `caption`…) and `tone` (`muted`, `tint`, `error`) |
| Inputs | `FormInput` (label, `leftIcon`, `error`, `helperText`), `SelectInput`, `DatePickerInput` |
| Actions | `PrimaryButton` with `variant` `primary`/`secondary`/`ghost`/`danger` |
| Confirmation (archive, cancel, decline, delete) | `ConfirmModal` with `tone="danger"` + `icon` |
| Inline status / empty / forbidden | `Notice` |
| Tabs inside a screen | `SegmentedControl` |
| Tokens | `Spacing`, `Radius`, `Typography`, `Shadow`, `Layout` from `@/constants/Theme`; colors via `useThemeColor` |

Every data screen handles these states:
**loading** (`Loader`), **empty** (a `Notice` or empty text that explains the
next step), **error** (toast already shown; offer pull-to-refresh), **forbidden**
(hide the entry point; show a `Notice` on direct navigation), **read-only** (view
without manage permission) and **stale action** (refetch on 400 conflicts).

Content rules: render user text only through `ThemedText`/`Text` (never as
HTML); dates via `formatLocalTimestamp`; money via `formatAud`; keep form
drafts on failure; never log credentials, codes or private documents.

### 3.6 Forms
```tsx
const { control, handleSubmit, setError, formState: { errors } } = useForm({ resolver: yupResolver(schema), defaultValues });
const save = useSaveMyProfile();

const onSubmit = (values: FormValues) =>
  save.mutate(toRequest(values), {
    onError: (error) => {
      // Bind server validation to fields; unmatched messages stay in the toast.
      const { fieldErrors } = mapApiValidation(error, FIELDS, { "Profile.FirstName": "firstName" });
      Object.entries(fieldErrors).forEach(([field, message]) => setError(field as FieldName, { message }));
    },
  });
```
- Yup mirrors the guide's field rules; the server still validates.
- PUT forms submit the complete mutable record. Load the record, then edit.
- New passwords use `newPasswordSchema()` from `utility/passwordPolicy.ts`.

### 3.7 Tests
Add `tests/<feature>.test.cjs` using the existing `node:test` + `vm` style (see
`tests/integration.test.cjs`). Cover at least:
- each service function's **method, path, params and body** (and that absent filters are omitted);
- `data: null` handling and paging (`hasMore`);
- access-policy helpers (view-only, no permission, setup exception, SuperAdmin);
- one form schema (valid/invalid);
- anything the guide's **Acceptance checks** lists that can run without a device.

Harness constraints (tests render screens by calling them directly):
- Auth screens may import only `@/components/*` (mocked), `expo-router`,
  `react-hook-form`, `yup`, `react-native` (`View`/`StyleSheet`) and `@/hooks|services|stores`.
  Put stateful UI, icons and animations inside components.
- Layout files (`app/**/_layout.tsx`) are mounted by `tests/startup.test.cjs`. Keep them free of new external modules.

Add a compile-only check in `tests/apiResponse.typecheck.ts` when a new response shape is unusual.

## 4. Verification (every guide)

```bash
npx tsc --noEmit
npm run lint
node --test tests/*.test.cjs
npx expo export --platform android --output-dir <scratch dir>
```
All must pass with no new warnings. **Do not launch or drive the emulator / Expo
Go unless the user asks.** Backend calls can't be tested from the dev machine
(network blocks `auete.store`), so say "not verified against the live API".

## 5. Definition of done

- [ ] Every endpoint in the guide's member scope has a typed service function.
- [ ] Every screen in the guide's "Screens" section exists with all states (§3.5).
- [ ] Permissions follow each endpoint's Access row; setup exceptions only where documented.
- [ ] Field rules are enforced in yup, and server validation is mapped to fields.
- [ ] Mutations disable double submit, invalidate affected queries, and refetch after timeouts.
- [ ] Superseded legacy code is removed or listed as a follow-up.
- [ ] Tests added; tsc, lint, tests and the Android export all pass.
- [ ] README section added; ROADMAP status updated.
- [ ] Report delivered in the format below.

## 6. Report format ("what I did with guide NN")

Keep it short and in plain language: what the user can now do, not how.

```markdown
Guide NN (<title>) is done. <one line: checks passed; not tested on a device or the live API; not committed>.

- Added the <page/feature> where members <do what>: <what it includes>.
- <one bullet per user-visible change; 3–6 bullets>

**Needs your decision:** <only real ones, one line each>
```

No requirement-by-requirement tables or file lists; the README section and the commit body hold the details.

Then ask whether to commit. When the user says so: branch `guide-NN-<slug>`,
commit, fast-forward `main`, push both. Never push without being asked.

# Service Provider cleanup report

Completed 19 October 2026. This inventory covers Task 2 relative to the project after genealogy removal.

This is a historical cleanup snapshot. The identity follow-up below records the subsequently approved Task 15 naming; other inventories and validation results describe Task 2. See README for current infrastructure and configuration.

## Result

Removed **80 legacy source files and 53 image assets**, modified **38 files**, and added **4 files**. The application now contains generic authentication, a minimal Home/Menu, email/password settings, and reusable infrastructure. No Service Provider business features were added.

No commit was made. This snapshot has no Git metadata; file changes were identified by SHA-256 comparisons. Installed dependencies and generated, ignored `.expo/` validation artifacts are excluded from this source inventory.

## Changes and rationale

- Removed all remaining family/member/relationship, invitation/claim, donation, aid/sponsorship, membership-card, biography/history, community, content, activity, and tip routes with their supporting hooks, interfaces, request cards, family search controls, and endpoints.
- Removed the two family profile update methods/mutations from authentication. The twelve generic auth service functions and their request paths remain.
- Removed family/profile completion and approval redirects. Registration opens email OTP. Tokenless login opens OTP only for an explicit `PENDING_VERIFICATION` response; other tokenless responses stay signed out. Token-bearing sessions open Home. No provider-profile, role, or approval policy was invented.
- Replaced the family dashboard/menu with Home and Account/Menu placeholders. Email/password settings, logout, generic update policy, and its update route remain. Removed the duplicate update placeholder.
- Reduced User to generic identity fields. Removed domain enums while retaining generic region request types.
- Retained location/lookup serialization and query mechanisms with caller-supplied endpoint paths. Without endpoints, hooks are disabled and manual service calls reject. No new backend paths or lookup domains were guessed.
- Decoupled photo selection from auth state and the profile-upload endpoint. Multi-selection now accepts caller-supplied options instead of searching family users. Generic media/form controls remain reusable.
- Replaced old names, logos, splash/fallback imagery, permission wording, and colors with neutral Service Provider branding. Added an editable SVG icon and PNG export.
- Removed old API hosts. EAS profiles explicitly set `EXPO_PUBLIC_BASE_URL` to an empty string. Without a host, UI auth actions and startup restoration/push/version requests remain inactive. The unconfigured startup path preserves persisted refresh credentials.
- Preserved approved native/cloud identity, Firebase file references, EAS profiles, and variant validation pending ownership/configuration decisions.
- Corrected an OTP timer reference type required by TypeScript and declared the Node config global for lint. Neither changes authentication behavior.

## Modified files

### Identity, configuration, and branding

- `README.md`
- `app.config.js`
- `app.json`
- `components/ui/Logo.tsx`
- `components/ui/imageComponent.tsx`
- `constants/Colors.ts`
- `eas.json`
- `package-lock.json`
- `package.json`

### Authentication, navigation, and generic identity

- `app/(auth)/_layout.tsx`
- `app/(auth)/forced-update.tsx`
- `app/(auth)/forgot-password.tsx`
- `app/(auth)/index.tsx`
- `app/(auth)/otp-register.tsx`
- `app/(auth)/register.tsx`
- `app/(auth)/set-new-password.tsx`
- `app/(dashboard)/(menu)/_layout.tsx`
- `app/(dashboard)/(menu)/changeEmailPassword.tsx`
- `app/(dashboard)/(menu)/index.tsx`
- `app/(dashboard)/_layout.tsx`
- `app/(dashboard)/index.tsx`
- `app/_layout.tsx`
- `hooks/useAppVersion.ts`
- `hooks/useAuth.ts`
- `hooks/useProtectedRoute.ts`
- `hooks/usePushNotification.ts`
- `hooks/useUserStateRedirect.ts`
- `interfaces/auth.interface.ts`
- `interfaces/enums.ts`
- `interfaces/user.interface.ts`
- `services/authService.ts`

### Reusable lookup and location mechanisms

- `hooks/useGetLocations.ts`
- `hooks/useLookup.ts`
- `services/locationService.ts`
- `services/lookupService.ts`

### Shared form and media primitives

- `components/form/SelectMultiInput.tsx`
- `components/ui/OTPComponent.tsx`
- `components/ui/UploadProfileImage.tsx`

## Added files

- `.env.example`
- `assets/images/service-provider-icon.png`
- `assets/images/service-provider-icon.svg`
- `docs/cleanup-report.md`

## Deleted files

### Family members, relationships, invitations, claims, and profile onboarding

- `app/(auth)/claim-user.tsx`
- `app/(auth)/profile.tsx`
- `app/(auth)/profilePhaseTwo.tsx`
- `app/(auth)/waiting-verification.tsx`
- `app/(dashboard)/(menu)/(manageFamilyMembers)/_layout.tsx`
- `app/(dashboard)/(menu)/(manageFamilyMembers)/familyMemberProfile.tsx`
- `app/(dashboard)/(menu)/(manageFamilyMembers)/index.tsx`
- `app/(dashboard)/(menu)/inviteUser.tsx`
- `app/(dashboard)/(menu)/updateProfile.tsx`
- `app/(dashboard)/requests.tsx`
- `components/form/SelectInputWithUserSearch.tsx`
- `components/sharedScreens/ProfileForm.tsx`
- `components/ui/InfoCard.tsx`
- `components/ui/RequestCard.tsx`
- `hooks/useClaimManagedUser.ts`
- `hooks/useFamilyMembers.ts`
- `hooks/useGetAllAidRequests.ts`
- `hooks/useGetBranches.ts`
- `hooks/useGetMyAidRequests.ts`
- `hooks/useGetRelationshipRequests.ts`
- `hooks/useGetUsers.ts`
- `hooks/useInviteNewUser.ts`
- `hooks/useManagedUser.ts`
- `hooks/useRelationshipRequestAction.ts`
- `hooks/useSearchManagedUsers.ts`
- `interfaces/family.member.profile.interface.ts`

### Zakat, Fitra, Sadaqah, and payment helpers

- `app/(dashboard)/(menu)/fitra.tsx`
- `app/(dashboard)/(menu)/sadaqah.tsx`
- `app/(dashboard)/(menu)/zakat.tsx`
- `hooks/useGetFitra.ts`
- `hooks/useGetFitraPaymentTypes.ts`
- `hooks/useGetSadaka.ts`
- `hooks/useGetZakat.ts`
- `hooks/usePayFitra.ts`
- `hooks/usePaySadaka.ts`
- `hooks/usePayZakat.ts`
- `hooks/usePaymentTypes.ts`

### Aid, beneficiaries, and sponsorship

- `app/(dashboard)/(menu)/(aid)/_layout.tsx`
- `app/(dashboard)/(menu)/(aid)/index.tsx`
- `app/(dashboard)/(menu)/(aid)/requestAid.tsx`
- `app/(dashboard)/(menu)/sponsoring.tsx`
- `hooks/useAidActions.ts`
- `hooks/useGetAidTypes.ts`
- `hooks/useGetBeneficiaries.ts`
- `hooks/useGetMyAids.ts`
- `hooks/useGetMyBeneficiaries.ts`
- `hooks/useSponsorBeneficiary.ts`

### Membership cards

- `app/(dashboard)/(menu)/idCard.tsx`
- `hooks/useCardActions.ts`
- `hooks/useDiscardMyBiographyDraft.ts`
- `hooks/useGetCardCurrentState.ts`
- `hooks/useGetCardHistory.ts`
- `interfaces/card.interface.ts`

### Biographies and family history

- `app/(dashboard)/(menu)/biographies.tsx`
- `app/(dashboard)/(menu)/biography.tsx`
- `app/(dashboard)/(menu)/biographyDetail.tsx`
- `app/(dashboard)/(menu)/history.tsx`
- `app/(dashboard)/(menu)/historyArticle.tsx`
- `hooks/useGetBiographies.ts`
- `hooks/useGetBiography.ts`
- `hooks/useGetHistory.ts`
- `hooks/useGetMyBiography.ts`
- `hooks/useUpdateMyBiography.ts`
- `hooks/useUploadBiographyMediaFile.ts`
- `interfaces/biography.interface.ts`

### Legacy content, community pages, activities, tips, and upload API

- `app/(dashboard)/(menu)/aboutUs.tsx`
- `app/(dashboard)/(menu)/announcements.tsx`
- `app/(dashboard)/(menu)/elections.tsx`
- `app/(dashboard)/(menu)/events.tsx`
- `app/(dashboard)/(menu)/privacyPolicy.tsx`
- `app/(dashboard)/(menu)/support.tsx`
- `hooks/useAnnouncements.ts`
- `hooks/useContactSupport.ts`
- `hooks/useGetAboutUs.ts`
- `hooks/useGetFeatures.ts`
- `hooks/useGetPrivacyPolicy.ts`
- `hooks/useGetRecentActivities.ts`
- `hooks/useGetTips.ts`
- `hooks/useUploadImage.ts`

### Obsolete duplicate update screen

- `app/forceUpdateScreen.tsx`

### Legacy branding and starter image assets

- `assets/images/Assets.xcassets/AppIcon.appiconset/Contents.json`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/100.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/102.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/1024.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/108.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/114.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/120.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/128.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/144.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/152.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/16.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/167.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/172.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/180.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/196.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/20.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/216.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/234.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/256.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/258.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/29.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/32.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/40.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/48.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/50.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/512.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/55.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/57.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/58.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/60.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/64.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/66.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/72.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/76.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/80.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/87.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/88.png`
- `assets/images/Assets.xcassets/AppIcon.appiconset/_/92.png`
- `assets/images/adaptive-icon.png`
- `assets/images/appstore-old.png`
- `assets/images/appstore.png`
- `assets/images/favicon.png`
- `assets/images/icon.png`
- `assets/images/logo-old.png`
- `assets/images/logo.png`
- `assets/images/logo2.png`
- `assets/images/partial-react-logo.png`
- `assets/images/playstore-old.png`
- `assets/images/playstore.png`
- `assets/images/react-logo.png`
- `assets/images/react-logo@2x.png`
- `assets/images/react-logo@3x.png`
- `assets/images/splash-icon.png`

## Infrastructure preserved

Byte-for-byte checks passed for:

- `services/api.ts`: Axios client, helpers, interceptors.
- `services/authSession.ts`: refresh coordination and session token handling.
- `utility/secureStore.ts` and `utility/restoreUser.ts`.
- `stores/authStore.ts`, `stores/theme.ts`, `stores/toastStore.ts`.
- `hooks/useNotification.ts`: generic notification API mutations.
- `components/ui/Toast.tsx`.

The root still owns the same single module-level QueryClient with unchanged default configuration/provider. React Hook Form, Yup schemas, credential/session mechanisms, Expo Router layout structure, notification listeners/token acquisition, theme resolution, font loading, loaders, shared controls, and EAS profile/variant mechanisms remain.

Only cleanup-related navigation, configuration guards, branding, and endpoint decoupling were changed. No security refactoring or architecture redesign was performed.

## Dependencies

Removed:

- `expo-document-picker`: biography document upload was its sole consumer.
- `react-native-webview`: all HTML/editor consumers were removed; Expo marks this peer optional.
- `react-native-svg`: no remaining source consumer or required dependency.
- `expo-image`: no source consumer or required dependency; retained images use React Native Image.

The lockfile lost 16 entries and gained none. Every retained package version is unchanged; no package was upgraded or added. `npm ls --depth=0` passes without missing or extraneous packages.

Core Expo/navigation/native support, authentication, query/state/form packages remain. Camera/image picker and date picker support retained primitives. Blur, haptics, and native in-app browser packages support retained generic components.

## Validation

| Check | Result |
| --- | --- |
| `node_modules/.bin/tsc --noEmit --incremental false` | Pass |
| `node_modules/.bin/eslint . --no-cache` | Pass: zero errors, 14 retained warnings |
| Local imports/assets | 169 references resolve across 70 source files |
| Routes/navigation | 14 declarations and 19 navigation destinations resolve |
| Legacy business code/endpoints/hosts scan | No matches in application source |
| Dependency integrity | `npm ls --depth=0` passes; retained versions unchanged |
| Android/iOS JavaScript export | Both native platforms export successfully |
| Retained auth API bindings | All 12 request bindings checked |
| Auth behavior | Synthetic checks pass for registration, pending-email login, token login/OTP, recovery, logout |
| Navigation behavior | Synthetic checks pass for signed-in/out routing, OTP access, bootstrap waiting, forced-update state |
| Native binary builds/device launch/push delivery | Not verified; Firebase inputs and ownership remain unresolved |

Synthetic checks executed the actual auth service/hook and navigation callbacks with mocked transport, session, and React hook boundaries. They do not establish live backend compatibility or complete end-to-end authentication. No application backend was contacted.

The icon PNG was visually inspected. The preview server was stopped. Export artifacts remain under ignored `.expo/cleanup-export`.

The 14 lint warnings concern retained toast effect dependencies, notification import/effect structure, empty auth response interfaces, and Axios import style. No lint rules were disabled to hide them; infrastructure work is deferred.

Export reports the expected unresolved `android.googleServicesFile` warning. Development config still rejects the missing Firebase file. A successful JS/Hermes export does not establish a successful native binary build.

## Identity follow-up (Task 15)

Task 2 deferred the native identities and URL scheme. Task 15 subsequently approved these Service Provider replacements in `app.json`:

- Android package: `com.kimzaster.serviceprovider` (`com.kimzaster.serviceprovider.dev` for development).
- iOS bundle identifier: `com.kimzaster.serviceprovider` (`com.kimzaster.serviceprovider.dev` for development).
- URL scheme, Expo slug, and npm package name: `service-provider`.
- Display name: Service Provider (Service Provider - Dev for development).

EAS project `02557e69-e417-490c-81ea-6d46a925c66a`, Firebase ownership, and Firebase file references are retained. No cloud configuration or ownership was changed. The workspace directory requires a manual rename to `service-provider` after closing the active tools; Git history and unrelated external paths remain untouched.

Neither Firebase input file is supplied. The existing owners must supply clients/files matching the approved packages, arrange signing/store records, and reconcile the Expo slug with the retained EAS project before cloud builds/submission. Remote EAS variables and credentials were not inspected. No app was published or submitted.

## Deferred decisions

- Service Provider API hosts and compatibility of auth, push, and version endpoints.
- Provider profiles, onboarding, approval states, roles, authorization.
- Support/content pages, media upload behavior, location/lookup schemas.
- Native IDs and deep-link scheme were later approved in Task 15 as recorded above; EAS/Firebase configuration, store URLs, and push routing still require external follow-up.
- Final branding assets and version-policy representation.
- Later infrastructure/security enhancements, including logging, refresh failure policy, cache/session lifecycle, password rules, and native theme persistence.

Task 2 stops here for review.

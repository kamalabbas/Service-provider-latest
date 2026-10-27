import type { User } from "@/interfaces/user.interface";
import type { ReferenceCatalogue } from "@/interfaces/reference.interface";
import { hasPermissions, isAdministrator, type AccessGrants } from "@/utility/permissions";

/** The signed-in user's normalized grants for UI access decisions. */
export const grantsOf = (user?: User | null): AccessGrants => ({
  accessLevel: user?.accessLevel ?? null,
  roles: user?.roles ?? [],
  permissions: user?.permissions ?? [],
});

/**
 * true when the user holds every permission. allowDuringSetup only where the
 * guide documents a profile-setup exception. The backend still authorizes.
 */
export const can = (user: User | null | undefined, permissions: readonly string[], allowDuringSetup = false) =>
  hasPermissions(grantsOf(user), permissions, allowDuringSetup);

// Guide 06: reference choices. Regions are public; other member catalogues need
// reference.view, including during profile setup.
export const canViewReferenceChoices = (user: User | null | undefined, catalogue: ReferenceCatalogue) =>
  catalogue === "regions" || can(user, ["reference.view"], true);
export const canViewReferenceAdmin = (user?: User | null) => can(user, ["reference-admin.view"]);
export const canManageReferenceChoices = (user?: User | null) => can(user, ["reference.manage"]);
export const canRetireReferenceChoices = (user?: User | null) => can(user, ["reference.delete"]);

// Guide 03: member types and roles.
export const canViewOwnMembership = (user?: User | null) => can(user, ["profiles.view"], true);
export const canSelectUserType = (user?: User | null) => can(user, ["profiles.manage"], true);
/** Self-deactivation needs only a signed-in session (setup included), no permission. */
export const canDeactivateOwnAccount = (user?: User | null) => user?.accessLevel === "full" || user?.accessLevel === "profile_setup";
export const canViewUsers = (user?: User | null) => can(user, ["users.view"]);
export const canDeactivateUsers = (user?: User | null) => can(user, ["users.delete"]);
export const canReactivateUsers = (user?: User | null) => can(user, ["users.manage"]);
export const canViewRoles = (user?: User | null) => can(user, ["roles.view"]);
export const canManageRoles = (user?: User | null) => can(user, ["roles.manage"]);
export const canDeleteRoles = (user?: User | null) => can(user, ["roles.delete"]);
/** Role assignment needs both grants. */
export const canAssignRoles = (user?: User | null) => can(user, ["roles.manage", "users.manage"]);
/** Type change is SuperAdmin-only; no permission grants it. */
export const canChangeUserType = (user?: User | null) => isAdministrator(grantsOf(user));

// Guide 04: profiles. A missing permission is not a missing profile.
export const canViewOwnProfile = (user?: User | null) => can(user, ["profiles.view"], true);
export const canEditOwnProfile = (user?: User | null) => can(user, ["profiles.manage"], true);
/** Target-user profile routes are SuperAdmin-only (full session). */
export const canManageUserProfiles = (user?: User | null) => isAdministrator(grantsOf(user));

// Guide 05: business details. Eligible types plus each operation's own permission;
// a user type alone is not access. Full access only (no setup exception).
export const BUSINESS_USER_TYPES: readonly string[] = ["tradeperson", "builder", "developer"];
const businessEligible = (userTypeCode?: string | null) => !!userTypeCode && BUSINESS_USER_TYPES.includes(userTypeCode);
export const canViewOwnBusiness = (user: User | null | undefined, userTypeCode?: string | null) =>
  businessEligible(userTypeCode) && can(user, ["businesses.view"]);
export const canManageOwnBusiness = (user: User | null | undefined, userTypeCode?: string | null) =>
  businessEligible(userTypeCode) && can(user, ["businesses.manage"]);
export const canArchiveOwnBusiness = (user: User | null | undefined, userTypeCode?: string | null) =>
  businessEligible(userTypeCode) && can(user, ["businesses.delete"]);
/** Admin business routes are SuperAdmin-only (full session). */
export const canManageBusinessesAsAdmin = (user?: User | null) => isAdministrator(grantsOf(user));

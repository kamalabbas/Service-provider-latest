import type { User } from "@/interfaces/user.interface";
import type { ReferenceCatalogue } from "@/interfaces/reference.interface";
import { hasPermissions, type AccessGrants } from "@/utility/permissions";

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

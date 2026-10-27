import type { AccessLevel } from '@/interfaces/serviceProviderAuth.interface';

export interface AccessGrants {
  accessLevel: AccessLevel | null;
  roles: readonly string[];
  permissions: readonly string[];
}

const claimArray = (value: unknown): string[] =>
  [...new Set((typeof value === 'string' ? [value] : Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string' && item.length > 0))];

/** Read already-decoded claims for UI decisions; the backend validates tokens. */
export function normalizeGrants(claims: Record<string, unknown>): AccessGrants {
  return {
    accessLevel: claims.access_level === 'full' || claims.access_level === 'profile_setup' ? claims.access_level : null,
    roles: claimArray(claims.role),
    permissions: claimArray(claims.permission),
  };
}

export function isAdministrator(grants: AccessGrants): boolean {
  return grants.accessLevel === 'full' && grants.roles.includes('SuperAdmin');
}

/** Setup exceptions must be explicitly enabled by the endpoint's feature guide. */
export function hasPermissions(grants: AccessGrants, required: readonly string[], allowDuringSetup = false): boolean {
  if (grants.accessLevel === 'profile_setup') return allowDuringSetup;
  return grants.accessLevel === 'full' && (isAdministrator(grants) || required.every(permission => grants.permissions.includes(permission)));
}

export const visibilityPermission = (feature: string, visible: boolean) => `${feature}.${visible ? 'manage' : 'delete'}`;

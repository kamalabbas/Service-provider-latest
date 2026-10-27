import type { AccessLevel } from "./serviceProviderAuth.interface";

// Signed-in identity derived from the access token (guide 01 returns no user object).
export interface User {
  /** JWT `sub`; the account identifier, kept as a string. */
  id: string;
  /** From the token's email claim when present, otherwise the sign-in email. */
  email?: string;
  accessLevel: AccessLevel;
  roles: string[];
  permissions: string[];
  /** true routes to initial type/profile setup instead of the normal app. */
  profileCompletionRequired: boolean;
}

import type { AccessTokenResponse } from '@/interfaces/serviceProviderAuth.interface';
import type { User } from '@/interfaces/user.interface';
import { normalizeGrants } from '@/utility/permissions';

const EMAIL_CLAIMS = ['email', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Self-contained so decoding does not depend on an engine's atob global.
function decodeBase64Url(segment: string): string {
  let bits = 0, value = 0, encoded = '';
  for (const char of segment) {
    const index = BASE64URL.indexOf(char);
    if (index < 0) throw new SyntaxError('Invalid base64url segment.');
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      encoded += `%${((value >> bits) & 0xff).toString(16).padStart(2, '0')}`;
    }
  }
  // Claims are UTF-8 JSON; percent-decode the bytes rather than assuming ASCII.
  return decodeURIComponent(encoded);
}

/** Read JWT claims for UI decisions only; the backend validates signatures. */
export function readAccessTokenClaims(accessToken: string): Record<string, unknown> | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const claims: unknown = JSON.parse(decodeBase64Url(parts[1]));
    return claims && typeof claims === 'object' && !Array.isArray(claims) ? claims as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/**
 * Build the signed-in identity from an authentication response. The mobile
 * API returns no user object, so the account ID is the token's `sub` claim.
 * Returns null when the token lacks a usable subject or access level.
 */
export function sessionUserFrom(
  response: Pick<AccessTokenResponse, 'accessToken' | 'profileCompletionRequired'>,
  fallbackEmail?: string,
): User | null {
  const claims = readAccessTokenClaims(response.accessToken);
  if (!claims || typeof claims.sub !== 'string' || !claims.sub) return null;
  const grants = normalizeGrants(claims);
  if (!grants.accessLevel) return null;
  const email = EMAIL_CLAIMS.map(name => claims[name]).find((value): value is string => typeof value === 'string' && value.length > 0);
  return {
    id: claims.sub,
    email: email ?? fallbackEmail,
    accessLevel: grants.accessLevel,
    roles: [...grants.roles],
    permissions: [...grants.permissions],
    profileCompletionRequired: response.profileCompletionRequired === true,
  };
}

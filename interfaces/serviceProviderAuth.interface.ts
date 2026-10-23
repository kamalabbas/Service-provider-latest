import type {
  refreshTokenRequest,
  sendEmailOtpRequest,
} from "./auth.interface";
import type { ApiResponse } from "./serviceProviderApi.interface";

// These existing request shapes already match 01-account-access.md.
export type { LoginRequest, RegisterRequest } from "./auth.interface";

export type RefreshTokenRequest = refreshTokenRequest;

/** Email must be nonblank, valid, and at most 254 characters. */
export type ResendVerificationRequest = sendEmailOtpRequest;

export interface VerifyEmailRequest {
  /** Original registration email; nonblank, valid, and at most 254 characters. */
  email: string;
  /** Six digits (^[0-9]{6}$); keep leading zeroes. */
  code: string;
}

/** Shared access-token payload, also returned by browser sign-in/refresh. */
export interface AccessTokenResponse {
  accessToken: string;
  /** UTC ISO 8601 timestamp, preserved as the API's date-time string. */
  expiresAtUtc: string;
  profileCompletionRequired: boolean;
}

/** Flat mobile sign-in/refresh payload; no user object is returned. */
export interface MobileAuthResponse extends AccessTokenResponse {
  refreshToken: string;
  /** UTC ISO 8601 timestamp, preserved as the API's date-time string. */
  refreshTokenExpiresAtUtc: string;
}

export interface MobileSignOutRequest extends RefreshTokenRequest {
  /** Stable, nonempty installation UUID; retained across sign-outs. */
  installationId: string;
}

export type AccessTokenResponseApiResponse = ApiResponse<AccessTokenResponse>;
export type MobileAuthResponseApiResponse = ApiResponse<MobileAuthResponse>;

/** Registration, verification, resend, and sign-out use this envelope. */
export type ObjectApiResponse = ApiResponse<object>;

export type AccessLevel = "profile_setup" | "full";

/** JWT claims described by guide 00, separate from the JSON auth response. */
export interface AccessTokenClaims {
  /** Account identifier; preserve the JWT string without numeric conversion. */
  sub: string;
  access_level: AccessLevel;
  role?: string | string[];
  permission?: string | string[];
}

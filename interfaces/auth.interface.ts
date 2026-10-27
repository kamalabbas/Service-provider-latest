// Guide 01 account-access requests. Responses use ApiResponse<...> from
// serviceProviderAuth.interface.ts.
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface refreshTokenRequest {
  refreshToken: string;
}

export interface sendEmailOtpRequest {
  email: string;
}

// Legacy credential shapes below still call /Auth/Credentials/* paths; the new
// backend documents no change-email or change-password endpoints.
export interface Token {
  accessToken: string;
  refreshToken: string;
}

export interface VerifyEmailOtpResponse {
  token?: Token;
}

export interface ChangeEmailRequest {
  userId: number;
  newEmail: string;
}

export interface VerifyNewEmailRequest {
  userId: number;
  otp: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {}

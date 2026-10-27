import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { postData } from "./api";
import { AxiosRequestConfig } from "axios";
import { AuthenticationOperation, beginAuthenticationOperation } from "./authSession";

import {
  ChangeEmailRequest,
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginRequest,
  RegisterRequest,
  sendForgotPasswordOtpRequest,
  SendForgotPasswordOtpResponse,
  setNewPasswordRequest,
  setNewPasswordResponse,
  VerifyEmailOtpResponse,
  VerifyNewEmailRequest,
  VerifyResetPasswordOtpRequest,
  VerifyResetPasswordOtpResponse,
} from "@/interfaces/auth.interface";
import {
  MobileAuthResponseApiResponse,
  MobileSignOutRequest,
  ObjectApiResponse,
  ResendVerificationRequest,
  VerifyEmailRequest,
} from "@/interfaces/serviceProviderAuth.interface";

// Operation metadata is local Axios configuration, never part of the wire body.
function postAuthentication<T, U>(url: string, body: T, operation = beginAuthenticationOperation()) {
  const config: AxiosRequestConfig & { _authenticationOperation: AuthenticationOperation; _sessionGeneration: number } = {
    _authenticationOperation: operation,
    _sessionGeneration: operation.generation,
  };
  return postData<T, U>(url, body, config);
}

// Guide 01: account access.
export const login = async (body: LoginRequest, operation?: AuthenticationOperation) => {
  return await postAuthentication<LoginRequest, MobileAuthResponseApiResponse>("/api/auth/mobile/sign-in", body, operation);
};

export const register = (body: RegisterRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<RegisterRequest, ObjectApiResponse>("/api/auth/register", body, operation);
};

export const verifyEmail = (body: VerifyEmailRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<VerifyEmailRequest, ObjectApiResponse>("/api/auth/verify-email", body, operation);
};

export const resendVerification = (body: ResendVerificationRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<ResendVerificationRequest, ObjectApiResponse>("/api/auth/resend-verification", body, operation);
};

export const logout = (body: MobileSignOutRequest, config?: AxiosRequestConfig) =>
  postData<MobileSignOutRequest, ObjectApiResponse>("/api/auth/mobile/sign-out", body, config);

// Legacy credential endpoints; not in the Service Provider backend contract.
export const changeEmail = (body: ChangeEmailRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<ChangeEmailRequest, BaseResponse<VerifyEmailOtpResponse>>("/Auth/Credentials/ChangeEmail", body, operation);
};

export const verifyNewEmail = (body: VerifyNewEmailRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<VerifyNewEmailRequest, BaseResponse<VerifyEmailOtpResponse>>("/Auth/Credentials/VerifyNewEmail", body, operation);
};

export const changePassword = (body: ChangePasswordRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<ChangePasswordRequest, BaseResponse<ChangePasswordResponse>>("/Auth/Credentials/ChangePassword", body, operation);
};

// Legacy password recovery; migrates with guide 02.
export const sendForgotPasswordOtp = (body: sendForgotPasswordOtpRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<sendForgotPasswordOtpRequest, BaseResponse<SendForgotPasswordOtpResponse>>("/Auth/SendForgotPasswordOtp", body, operation);
};

export const verifyResetPasswordOtp = (body: VerifyResetPasswordOtpRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<VerifyResetPasswordOtpRequest, BaseResponse<VerifyResetPasswordOtpResponse>>("/Auth/VerifyForgotPasswordOtp", body, operation);
};

export const setNewPassword = (body: setNewPasswordRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<setNewPasswordRequest, BaseResponse<setNewPasswordResponse>>("/Auth/ResetPassword", body, operation);
};

export default {
  login,
  register,
  verifyEmail,
  resendVerification,
  sendForgotPasswordOtp,
  verifyResetPasswordOtp,
  setNewPassword,
  changePassword,
  logout,
};

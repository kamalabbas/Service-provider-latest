import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { postData } from "./api";
import { AxiosRequestConfig } from "axios";
import { AuthenticationOperation, beginAuthenticationOperation } from "./authSession";

import {
  ChangeEmailRequest,
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  refreshTokenRequest,
  refreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  sendEmailOtpRequest,
  SendVerifyEmailResponse as sendEmailOtpResponse,
  sendForgotPasswordOtpRequest,
  SendForgotPasswordOtpResponse,
  setNewPasswordRequest,
  setNewPasswordResponse,
  VerifyEmailOtpRequest,
  VerifyEmailOtpResponse,
  VerifyNewEmailRequest,
  VerifyResetPasswordOtpRequest,
  VerifyResetPasswordOtpResponse,
} from "@/interfaces/auth.interface";

// Operation metadata is local Axios configuration, never part of the wire body.
function postAuthentication<T, U>(url: string, body: T, operation = beginAuthenticationOperation()) {
  const config: AxiosRequestConfig & { _authenticationOperation: AuthenticationOperation; _sessionGeneration: number } = {
    _authenticationOperation: operation,
    _sessionGeneration: operation.generation,
  };
  return postData<T, U>(url, body, config);
}

export const login = async (body: LoginRequest, operation?: AuthenticationOperation) => {
  return await postAuthentication<LoginRequest, BaseResponse<LoginResponse>>("/Auth/SignIn", body, operation);
};

export const register = (body: RegisterRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<RegisterRequest, BaseResponse<RegisterResponse>>("/Auth/SignUp", body, operation);
};

export const changeEmail = (body: ChangeEmailRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<ChangeEmailRequest, BaseResponse<VerifyEmailOtpResponse>>("/Auth/Credentials/ChangeEmail", body, operation);
};

export const verifyNewEmail = (body: VerifyNewEmailRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<VerifyNewEmailRequest, BaseResponse<VerifyEmailOtpResponse>>("/Auth/Credentials/VerifyNewEmail", body, operation);
};

export const verifyEmail = (body: VerifyEmailOtpRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<VerifyEmailOtpRequest, BaseResponse<VerifyEmailOtpResponse>>("/Auth/VerifyEmailOtp", body, operation);
};

export const sendEmailOtp = (body: sendEmailOtpRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<sendEmailOtpRequest, BaseResponse<sendEmailOtpResponse>>("/Auth/SendEmailOtp", body, operation);
};

export const refreshToken = (body: refreshTokenRequest) => {
  return postData<refreshTokenRequest, BaseResponse<refreshTokenResponse>>("/Auth/Refresh", body);
};

export const sendForgotPasswordOtp = (body: sendForgotPasswordOtpRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<sendForgotPasswordOtpRequest, BaseResponse<SendForgotPasswordOtpResponse>>("/Auth/SendForgotPasswordOtp", body, operation);
};

export const verifyResetPasswordOtp = (body: VerifyResetPasswordOtpRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<VerifyResetPasswordOtpRequest, BaseResponse<VerifyResetPasswordOtpResponse>>("/Auth/VerifyForgotPasswordOtp", body, operation);
};

export const setNewPassword = (body: setNewPasswordRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<setNewPasswordRequest, BaseResponse<setNewPasswordResponse>>("/Auth/ResetPassword", body, operation);
};

export const changePassword = (body: ChangePasswordRequest, operation?: AuthenticationOperation) => {
  return postAuthentication<ChangePasswordRequest, BaseResponse<ChangePasswordResponse>>("/Auth/Credentials/ChangePassword", body, operation);
};

export const logout = (body: LogoutRequest, config?: AxiosRequestConfig) => postData<LogoutRequest, any>("/Auth/Logout", body, config);

export default {
  login,
  register,
  refreshToken,
  sendForgotPasswordOtp,
  verifyResetPasswordOtp,
  setNewPassword,
  changePassword,
  logout,
};

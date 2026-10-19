import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { postData } from "./api";

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

export const login = async (body: LoginRequest) => {
  return await postData<LoginRequest, BaseResponse<LoginResponse>>("/Auth/SignIn", body);
};

export const register = (body: RegisterRequest) => {
  return postData<RegisterRequest, BaseResponse<RegisterResponse>>("/Auth/SignUp", body);
};

export const changeEmail = (body: ChangeEmailRequest) => {
  return postData<ChangeEmailRequest, BaseResponse<VerifyEmailOtpResponse>>("/Auth/Credentials/ChangeEmail", body);
};

export const verifyNewEmail = (body: VerifyNewEmailRequest) => {
  return postData<VerifyNewEmailRequest, BaseResponse<VerifyEmailOtpResponse>>("/Auth/Credentials/VerifyNewEmail", body);
};

export const verifyEmail = (body: VerifyEmailOtpRequest) => {
  return postData<VerifyEmailOtpRequest, BaseResponse<VerifyEmailOtpResponse>>("/Auth/VerifyEmailOtp", body);
};

export const sendEmailOtp = (body: sendEmailOtpRequest) => {
  return postData<sendEmailOtpRequest, BaseResponse<sendEmailOtpResponse>>("/Auth/SendEmailOtp", body);
};

export const refreshToken = (body: refreshTokenRequest) => {
  return postData<refreshTokenRequest, BaseResponse<refreshTokenResponse>>("/Auth/Refresh", body);
};

export const sendForgotPasswordOtp = (body: sendForgotPasswordOtpRequest) => {
  return postData<sendForgotPasswordOtpRequest, BaseResponse<SendForgotPasswordOtpResponse>>("/Auth/SendForgotPasswordOtp", body);
};

export const verifyResetPasswordOtp = (body: VerifyResetPasswordOtpRequest) => {
  return postData<VerifyResetPasswordOtpRequest, BaseResponse<VerifyResetPasswordOtpResponse>>("/Auth/VerifyForgotPasswordOtp", body);
};

export const setNewPassword = (body: setNewPasswordRequest) => {
  return postData<setNewPasswordRequest, BaseResponse<setNewPasswordResponse>>("/Auth/ResetPassword", body);
};

export const changePassword = (body: ChangePasswordRequest) => {
  return postData<ChangePasswordRequest, BaseResponse<ChangePasswordResponse>>("/Auth/Credentials/ChangePassword", body);
};

export const logout = (body: LogoutRequest) => postData<LogoutRequest, any>("/Auth/Logout", body);

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

import { isAxiosError, isCancel } from "axios";

export type ApiErrorAction = "signIn" | "register" | "verifyCode" | "sendCode" | "resetPassword" | "changeEmail" | "changePassword";

// A display-only projection. Original errors still propagate to callers; no
// request, response payload, headers, or backend free text enters this object.
export interface AppError {
  kind: "network" | "timeout" | "http" | "cancelled" | "unknown";
  message: string;
  status?: number;
}

const actionMessages: Record<ApiErrorAction, string> = {
  signIn: "Unable to sign in. Check your details and try again.",
  register: "Unable to register. Check your details and try again.",
  verifyCode: "Unable to verify the code. Check it and try again.",
  sendCode: "Unable to request a code. Check your details and try again.",
  resetPassword: "Unable to reset your password. Please try again.",
  changeEmail: "Unable to change your email. Check your details and try again.",
  changePassword: "Unable to change your password. Check your details and try again.",
};

export function toAppError(error: unknown, action?: ApiErrorAction): AppError {
  if (isCancel(error) || (isAxiosError(error) && error.code === "ERR_CANCELED")) {
    return { kind: "cancelled", message: "Request cancelled." };
  }

  const fallback = action ? actionMessages[action] : "Unable to complete the request. Please try again.";
  if (!isAxiosError(error)) return { kind: "unknown", message: fallback };

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return { kind: "timeout", message: "The request timed out. Please try again." };
  }

  if (error.response) {
    const status = error.response.status;
    let message = fallback;
    if (status === 403) message = "You don't have permission to complete this request.";
    else if (status === 429) message = "Too many requests. Please wait and try again.";
    else if (status >= 500) message = "The service is temporarily unavailable. Please try again later.";
    else if (!action && status === 401) message = "Unable to authorize this request. Please try again.";
    else if (!action && (status === 400 || status === 422)) message = "Please check the information you entered and try again.";
    return { kind: "http", status, message };
  }

  if (error.code === "ERR_NETWORK" || error.request) {
    return { kind: "network", message: "Unable to connect. Check your connection and try again." };
  }
  return { kind: "unknown", message: fallback };
}

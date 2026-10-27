import * as yup from "yup";

// Backend password policy (guides 01 and 02).
export const PASSWORD_RULE_TEXT =
  "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a symbol.";

export const newPasswordSchema = (requiredMessage = "Password is required") =>
  yup
    .string()
    .min(8, "Password must be at least 8 characters")
    .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
    .matches(/[a-z]/, "Password must contain at least one lowercase letter")
    .matches(/[0-9]/, "Password must contain at least one number")
    .matches(/[^a-zA-Z0-9]/, "Password must contain at least one symbol")
    .required(requiredMessage);

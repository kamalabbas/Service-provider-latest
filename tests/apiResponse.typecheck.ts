// Compile-only fixtures: these requests are never invoked by the test runner.
import type { LoginRequest, VerifyResetPasswordOtpResponse } from "../interfaces/auth.interface";
import type { BaseResponse } from "../interfaces/baseResponse.interface";
import type { ApiPage, ApiResponse } from "../interfaces/serviceProviderApi.interface";
import { deleteData, getData, postData, putData } from "../services/api";

interface Detail {
  id: number;
}

export function requests(body: LoginRequest) {
  return {
    defaultGet: getData("/contract-test"),
    defaultPost: postData("/contract-test", body),
    defaultPut: putData("/contract-test", body),
    defaultDelete: deleteData("/contract-test"),
    detail: getData<ApiResponse<Detail>>("/contract-test"),
    array: getData<ApiResponse<Detail[]>>("/contract-test"),
    page: getData<ApiResponse<ApiPage<Detail>>>("/contract-test"),
    noPayload: postData<LoginRequest, ApiResponse<null>>("/contract-test", body),
    typedPost: postData<LoginRequest, ApiResponse<Detail>>("/contract-test", body),
    typedPut: putData<LoginRequest, ApiResponse<Detail>>("/contract-test", body),
    typedDelete: deleteData<ApiResponse<Detail>>("/contract-test"),
    legacy: postData<LoginRequest, BaseResponse<VerifyResetPasswordOtpResponse>>("/Auth/VerifyForgotPasswordOtp", body),
    text: getData<string>("/health/live", { responseType: "text" }),
    binary: getData<ArrayBuffer>("/contract-test", { responseType: "arraybuffer" }),
  };
}

type Responses = { [Key in keyof ReturnType<typeof requests>]: Awaited<ReturnType<typeof requests>[Key]> };
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;
type Assert<Condition extends true> = Condition;

export type DefaultGet = Assert<Equal<Responses["defaultGet"], unknown>>;
export type DefaultPost = Assert<Equal<Responses["defaultPost"], unknown>>;
export type DefaultPut = Assert<Equal<Responses["defaultPut"], unknown>>;
export type DefaultDelete = Assert<Equal<Responses["defaultDelete"], unknown>>;
export type NullableDetail = Assert<Equal<Responses["detail"]["data"], Detail | null | undefined>>;
export type NullableArray = Assert<Equal<Responses["array"]["data"], Detail[] | null | undefined>>;
export type NullablePage = Assert<Equal<Responses["page"]["data"], ApiPage<Detail> | null | undefined>>;
export type NoPayload = Assert<Equal<Responses["noPayload"]["data"], null | undefined>>;
export type TypedPost = Assert<Equal<Responses["typedPost"], ApiResponse<Detail>>>;
export type TypedPut = Assert<Equal<Responses["typedPut"], ApiResponse<Detail>>>;
export type TypedDelete = Assert<Equal<Responses["typedDelete"], ApiResponse<Detail>>>;
export type LegacyRecovery = Assert<Equal<Responses["legacy"], BaseResponse<VerifyResetPasswordOtpResponse>>>;
export type RawText = Assert<Equal<Responses["text"], string>>;
export type RawBinary = Assert<Equal<Responses["binary"], ArrayBuffer>>;

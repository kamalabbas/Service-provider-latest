import {
  CreateReferenceChoiceRequest,
  ManagedReferenceChoiceListResponse,
  ManagedReferenceChoiceResponse,
  REFERENCE_CATALOGUES,
  ReferenceCatalogue,
  ReferenceChoiceListResponse,
  UpdateReferenceChoiceRequest,
} from "@/interfaces/reference.interface";
import { deleteData, getData, postData, putData } from "./api";

// Non-region codes: 2–80 lowercase letters/digits/underscores, starting with a letter.
export const REFERENCE_CODE_PATTERN = /^[a-z][a-z0-9_]{1,79}$/;

function catalogueSegment(catalogue: ReferenceCatalogue): string {
  if (!REFERENCE_CATALOGUES.includes(catalogue)) throw new Error("Unknown reference catalogue.");
  return catalogue;
}

function codeSegment(code: string): string {
  if (!code || code !== code.trim()) throw new Error("A reference choice code is required.");
  return encodeURIComponent(code);
}

// Guide 06: active member choices. Regions are public; the rest need reference.view.
export const getReferenceChoices = (catalogue: ReferenceCatalogue, signal?: AbortSignal) =>
  getData<ReferenceChoiceListResponse>(`/api/members/${catalogueSegment(catalogue)}`, { signal });

// Admin (guide 19): delegated permission routes; lists include inactive rows.
export const adminListReferenceChoices = (catalogue: ReferenceCatalogue, signal?: AbortSignal) =>
  getData<ManagedReferenceChoiceListResponse>(`/api/admin/reference-choices/${catalogueSegment(catalogue)}`, { signal });

export const adminCreateReferenceChoice = (catalogue: ReferenceCatalogue, body: CreateReferenceChoiceRequest) => {
  // New regions can't be created freely; the server restricts them to Australian choices.
  if (catalogue !== "regions" && !REFERENCE_CODE_PATTERN.test(body.code)) {
    throw new Error("Use 2–80 lowercase letters, digits or underscores, starting with a letter.");
  }
  return postData<CreateReferenceChoiceRequest, ManagedReferenceChoiceResponse>(
    `/api/admin/reference-choices/${catalogueSegment(catalogue)}`, body);
};

export const adminUpdateReferenceChoice = (catalogue: ReferenceCatalogue, code: string, body: UpdateReferenceChoiceRequest) =>
  putData<UpdateReferenceChoiceRequest, ManagedReferenceChoiceResponse>(
    `/api/admin/reference-choices/${catalogueSegment(catalogue)}/${codeSegment(code)}`, body);

/** Retires the choice; existing references to it are preserved. */
export const adminRetireReferenceChoice = (catalogue: ReferenceCatalogue, code: string) =>
  deleteData<ManagedReferenceChoiceResponse>(`/api/admin/reference-choices/${catalogueSegment(catalogue)}/${codeSegment(code)}`);

export const adminReactivateReferenceChoice = (catalogue: ReferenceCatalogue, code: string) =>
  postData<undefined, ManagedReferenceChoiceResponse>(
    `/api/admin/reference-choices/${catalogueSegment(catalogue)}/${codeSegment(code)}/reactivate`, undefined);

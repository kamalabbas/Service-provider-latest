import type { ApiResponse } from "./serviceProviderApi.interface";

/** Guide 06 catalogue path segments, exactly as the API spells them. */
export type ReferenceCatalogue = "regions" | "occupations" | "employee-positions" | "licence-types";

export const REFERENCE_CATALOGUES: readonly ReferenceCatalogue[] = ["regions", "occupations", "employee-positions", "licence-types"];

/** Active member choice: submit `code`, display `displayName`. */
export interface ReferenceChoice {
  code: string;
  displayName: string;
}

/** Management rows include inactive (retired) choices. */
export interface ManagedReferenceChoice extends ReferenceChoice {
  displayOrder: number;
  isActive: boolean;
}

/** Codes are immutable; region codes are limited to the predefined Australian choices. */
export interface CreateReferenceChoiceRequest {
  code: string;
  displayName: string;
  displayOrder: number;
}

/** PUT edits the label and order, never the code. */
export interface UpdateReferenceChoiceRequest {
  displayName: string;
  displayOrder: number;
}

export type ReferenceChoiceListResponse = ApiResponse<ReferenceChoice[]>;
export type ManagedReferenceChoiceListResponse = ApiResponse<ManagedReferenceChoice[]>;
export type ManagedReferenceChoiceResponse = ApiResponse<ManagedReferenceChoice>;

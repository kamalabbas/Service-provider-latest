import type { ApiResponse } from "./serviceProviderApi.interface";

/** Guide 04. Codes for selections, names for display. */
export interface ProfileOccupation {
  occupationCode: string;
  occupationName: string;
  /** Recorded as entered; not independently verified. */
  licence: string;
}

/** GET /api/members/me/profile: data is null before the first save. */
export interface Profile {
  firstName: string;
  lastName: string;
  mobilePhone: string;
  landlinePhone?: string | null;
  streetAddress: string;
  suburb: string;
  regionCode: string;
  postalCode: string;
  isPostalSameAsAddress: boolean;
  postalAddress: string;
  postalSuburb: string;
  postalRegionCode: string;
  postalPostalCode: string;
  /** Business contact only; never changes the sign-in email. */
  contactEmail?: string | null;
  website?: string | null;
  governmentSectorName?: string | null;
  occupations: ProfileOccupation[];
  /** Public URL; may change after a replacement upload. */
  pictureUrl?: string | null;
}

export interface ProfileOccupationRequest {
  occupationCode: string;
  licence: string;
}

/** PUT replaces the profile and its occupation set: submit the complete form. */
export interface SaveProfileRequest {
  firstName: string;
  lastName: string;
  mobilePhone: string;
  landlinePhone?: string | null;
  streetAddress: string;
  suburb: string;
  regionCode: string;
  postalCode: string;
  /** Send explicitly; the server defaults it to false when omitted. */
  isPostalSameAsAddress: boolean;
  postalAddress?: string | null;
  postalSuburb?: string | null;
  postalRegionCode?: string | null;
  postalPostalCode?: string | null;
  contactEmail?: string | null;
  /** Absolute URL. */
  website?: string | null;
  governmentSectorName?: string | null;
  occupations: ProfileOccupationRequest[];
}

/** SuperAdmin profile history entry. */
export interface BusinessAdminEvent {
  id: number;
  actorUserId: number;
  action: string;
  createdAtUtc: string;
}

export type ProfileResponse = ApiResponse<Profile>;
export type BusinessAdminEventListResponse = ApiResponse<BusinessAdminEvent[]>;

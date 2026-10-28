import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/** Guide 16. Retired is final: it can't be edited or republished. */
export type AnnouncementStatus = "draft" | "published" | "retired";

/** selected_user_types targets the member's current type, not the type at publication. */
export type AnnouncementAudience = "all" | "selected_user_types";

/** Plain text, never HTML. Members only ever receive published items for their audience. */
export interface Announcement {
  id: number;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  userTypeCodes: string[];
  status: AnnouncementStatus;
  createdByUserId: number;
  updatedByUserId: number;
  publishedAtUtc?: string | null;
  retiredAtUtc?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** Audit event; before/after are snapshots. */
export interface AnnouncementEvent {
  id: number;
  announcementId: number;
  actorUserId: number;
  action: string;
  before?: Record<string, unknown> | null;
  after: Record<string, unknown>;
  createdAtUtc: string;
}

/** Title ≤ 200, body ≤ 10000. userTypeCodes: nonempty for selected_user_types, empty for all. */
export interface SaveAnnouncementRequest {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  userTypeCodes: string[];
}

export interface AdminAnnouncementListFilters {
  status?: AnnouncementStatus;
}

export type AnnouncementResponse = ApiResponse<Announcement>;
export type AnnouncementPageResponse = ApiResponse<ApiPage<Announcement>>;
export type AnnouncementEventPageResponse = ApiResponse<ApiPage<AnnouncementEvent>>;

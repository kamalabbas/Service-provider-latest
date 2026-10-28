import {
  AdminAnnouncementListFilters,
  AnnouncementEventPageResponse,
  AnnouncementPageResponse,
  AnnouncementResponse,
  SaveAnnouncementRequest,
} from "@/interfaces/announcement.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireDatabaseId } from "@/utility/apiValues";
import { getData, postData, putData } from "./api";

export const ANNOUNCEMENT_TITLE_MAX = 200;
export const ANNOUNCEMENT_BODY_MAX = 10000;

const adminPath = (announcementId: number, action = "") => `/api/admin/announcements/${requireDatabaseId(announcementId)}${action}`;

const text = (value: string, max: number, message: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(message);
  if ([...trimmed].length > max) throw new Error(`Use at most ${max} characters.`);
  return trimmed;
};

/** "all" sends no type selections; selected types need at least one catalogue code. */
export function announcementBody(body: SaveAnnouncementRequest): SaveAnnouncementRequest {
  const codes = [...new Set(body.userTypeCodes.map((code) => code.trim()).filter(Boolean))];
  if (body.audience === "selected_user_types" && codes.length === 0) throw new Error("Choose at least one member type.");
  return {
    title: text(body.title, ANNOUNCEMENT_TITLE_MAX, "Enter a title."),
    body: text(body.body, ANNOUNCEMENT_BODY_MAX, "Enter the announcement text."),
    audience: body.audience,
    userTypeCodes: body.audience === "all" ? [] : codes,
  };
}

// Guide 16: published announcements for the member's current audience (full access only).
export const listAnnouncements = (page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<AnnouncementPageResponse>("/api/announcements", { params: pageParams(page, pageSize), signal });

export const getAnnouncement = (announcementId: number, signal?: AbortSignal) =>
  getData<AnnouncementResponse>(`/api/announcements/${requireDatabaseId(announcementId)}`, { signal });

// Admin (guide 19): SuperAdmin-only authoring. Saving never publishes.
export const adminListAnnouncements = (filters: AdminAnnouncementListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<AnnouncementPageResponse>("/api/admin/announcements", {
    params: { ...(filters.status ? { status: filters.status } : {}), ...pageParams(page, pageSize) },
    signal,
  });

export const adminGetAnnouncement = (announcementId: number, signal?: AbortSignal) =>
  getData<AnnouncementResponse>(adminPath(announcementId), { signal });

/** Creates a draft. */
export const adminCreateAnnouncement = (body: SaveAnnouncementRequest) =>
  postData<SaveAnnouncementRequest, AnnouncementResponse>("/api/admin/announcements", announcementBody(body));

/** Drafts and published items; a published edit reaches live readers. Retired is final. */
export const adminUpdateAnnouncement = (announcementId: number, body: SaveAnnouncementRequest) =>
  putData<SaveAnnouncementRequest, AnnouncementResponse>(adminPath(announcementId), announcementBody(body));

export const adminPublishAnnouncement = (announcementId: number) =>
  postData<undefined, AnnouncementResponse>(adminPath(announcementId, "/publish"), undefined);

export const adminRetireAnnouncement = (announcementId: number) =>
  postData<undefined, AnnouncementResponse>(adminPath(announcementId, "/retire"), undefined);

export const adminGetAnnouncementHistory = (announcementId: number, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<AnnouncementEventPageResponse>(adminPath(announcementId, "/history"), { params: pageParams(page, pageSize), signal });

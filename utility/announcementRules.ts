import type { Announcement, AnnouncementStatus } from "@/interfaces/announcement.interface";
import type { User } from "@/interfaces/user.interface";
import { canManageAnnouncementsAsAdmin } from "@/utility/access";

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: "Draft",
  published: "Published",
  retired: "Retired",
};

export interface AnnouncementAdminActions {
  edit: boolean;
  publish: boolean;
  retire: boolean;
  /** Edits to a published item reach live readers; confirm before saving. */
  confirmLiveEdit: boolean;
}

/** Drafts are edited then explicitly published; retired is final (no restore, no republish). */
export function announcementAdminActions(announcement: Pick<Announcement, "status">, user: User | null | undefined): AnnouncementAdminActions {
  const admin = canManageAnnouncementsAsAdmin(user);
  const { status } = announcement;
  return {
    edit: admin && status !== "retired",
    publish: admin && status === "draft",
    retire: admin && status === "published",
    confirmLiveEdit: admin && status === "published",
  };
}

/** A short one-line preview of the plain-text body for lists. */
export function announcementPreview(body: string, max = 120) {
  const line = body.replace(/\s+/g, " ").trim();
  const chars = [...line];
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : line;
}

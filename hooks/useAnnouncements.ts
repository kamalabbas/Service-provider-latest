import type { AdminAnnouncementListFilters, SaveAnnouncementRequest } from "@/interfaces/announcement.interface";
import {
  adminCreateAnnouncement,
  adminGetAnnouncement,
  adminGetAnnouncementHistory,
  adminListAnnouncements,
  adminPublishAnnouncement,
  adminRetireAnnouncement,
  adminUpdateAnnouncement,
  getAnnouncement,
  listAnnouncements,
} from "@/services/announcementService";
import { useAuthStore } from "@/stores/authStore";
import { canManageAnnouncementsAsAdmin, canViewAnnouncements } from "@/utility/access";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 20;

// Keys always include the account ID so a different account never reads this cache.
export const announcementKeys = {
  all: (accountId: string | null) => ["announcements", accountId] as const,
  list: (accountId: string | null, pageSize: number) => [...announcementKeys.all(accountId), "list", pageSize] as const,
  detail: (accountId: string | null, announcementId: number) => [...announcementKeys.all(accountId), "detail", announcementId] as const,
  admin: (accountId: string | null) => [...announcementKeys.all(accountId), "admin"] as const,
};

/** Published items for the member's current audience. No read/unread state exists. */
export function useAnnouncements(pageSize = PAGE_SIZE) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: announcementKeys.list(user?.id ?? null, pageSize),
    queryFn: ({ pageParam, signal }) => listAnnouncements(pageParam, pageSize, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canViewAnnouncements(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAnnouncement(announcementId: number | null) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: announcementKeys.detail(user?.id ?? null, announcementId ?? 0),
    queryFn: ({ signal }) => getAnnouncement(announcementId!, signal),
    enabled: announcementId !== null && canViewAnnouncements(user),
    select: (response) => response.data ?? null,
    // A retirement or audience change makes it inaccessible; don't keep showing it.
    retry: false,
  });
}

// Admin (guide 19): SuperAdmin authoring.
export function useAdminAnnouncements(filters: AdminAnnouncementListFilters = {}) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...announcementKeys.admin(user?.id ?? null), "list", filters],
    queryFn: ({ pageParam, signal }) => adminListAnnouncements(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canManageAnnouncementsAsAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAdminAnnouncement(announcementId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...announcementKeys.admin(user?.id ?? null), "detail", announcementId],
    queryFn: ({ signal }) => adminGetAnnouncement(announcementId, signal),
    enabled: canManageAnnouncementsAsAdmin(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminAnnouncementHistory(announcementId: number) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...announcementKeys.admin(user?.id ?? null), "history", announcementId],
    queryFn: ({ pageParam, signal }) => adminGetAnnouncementHistory(announcementId, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canManageAnnouncementsAsAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

/** Save is separate from publish. Every write refetches member and admin views. */
export function useAdminAnnouncementActions() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSettled = () => queryClient.invalidateQueries({ queryKey: announcementKeys.all(accountId) });
  return {
    create: useMutation({ mutationFn: (body: SaveAnnouncementRequest) => adminCreateAnnouncement(body), onSettled }),
    update: useMutation({
      mutationFn: ({ announcementId, body }: { announcementId: number; body: SaveAnnouncementRequest }) => adminUpdateAnnouncement(announcementId, body),
      onSettled,
    }),
    publish: useMutation({ mutationFn: (announcementId: number) => adminPublishAnnouncement(announcementId), onSettled }),
    retire: useMutation({ mutationFn: (announcementId: number) => adminRetireAnnouncement(announcementId), onSettled }),
  };
}

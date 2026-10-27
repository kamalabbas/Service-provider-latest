import { SaveServiceRequest, ServiceSearchFilters } from "@/interfaces/service.interface";
import {
  adminArchiveService,
  adminCreateUserService,
  adminGetService,
  adminListUserServices,
  adminUpdateService,
  archiveMyService,
  createMyService,
  getDiscoveredService,
  getMyService,
  getMyServices,
  searchServices,
  updateMyService,
} from "@/services/serviceListingService";
import { useAuthStore } from "@/stores/authStore";
import { canManageServicesAsAdmin, canViewServices } from "@/utility/access";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 20;

// Keys always include the account ID so a different account never reads this cache.
export const serviceKeys = {
  all: (accountId: string | null) => ["services", accountId] as const,
  mine: (accountId: string | null) => [...serviceKeys.all(accountId), "me"] as const,
  mineDetail: (accountId: string | null, serviceId: number) => [...serviceKeys.mine(accountId), serviceId] as const,
  search: (accountId: string | null, filters: ServiceSearchFilters | null) => [...serviceKeys.all(accountId), "search", filters] as const,
  discovered: (accountId: string | null, serviceId: number) => [...serviceKeys.all(accountId), "discovered", serviceId] as const,
  admin: (accountId: string | null) => [...serviceKeys.all(accountId), "admin"] as const,
};

/** Own listings, active and archived. */
export function useMyServices(enabled = true) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: serviceKeys.mine(user?.id ?? null),
    queryFn: ({ signal }) => getMyServices(signal),
    enabled: enabled && canViewServices(user),
    select: (response) => response.data ?? [],
  });
}

export function useMyService(serviceId: number | null) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: serviceKeys.mineDetail(user?.id ?? null, serviceId ?? 0),
    queryFn: ({ signal }) => getMyService(serviceId!, signal),
    enabled: serviceId !== null && canViewServices(user),
    select: (response) => response.data ?? null,
  });
}

/** POST without an ID, PUT with one. Refetches own lists; discovery refetches on return. */
export function useSaveMyService(serviceId: number | null) {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: (body: SaveServiceRequest) => (serviceId === null ? createMyService(body) : updateMyService(serviceId, body)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceKeys.mine(accountId) }),
  });
}

export function useArchiveMyService() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: (serviceId: number) => archiveMyService(serviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceKeys.mine(accountId) }),
  });
}

/** Paged nearby search; pages load on demand only. A new filter set starts at page 1. */
export function useServiceSearch(filters: ServiceSearchFilters | null) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: serviceKeys.search(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => searchServices(filters!, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: filters !== null && canViewServices(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useDiscoveredService(serviceId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: serviceKeys.discovered(user?.id ?? null, serviceId),
    queryFn: ({ signal }) => getDiscoveredService(serviceId, signal),
    enabled: canViewServices(user),
    select: (response) => response.data ?? null,
  });
}

// Admin (guide 19): SuperAdmin listings for a selected user, never via the admin's /me.
export function useAdminUserServices(userId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...serviceKeys.admin(user?.id ?? null), "user", userId],
    queryFn: ({ signal }) => adminListUserServices(userId, signal),
    enabled: canManageServicesAsAdmin(user),
    select: (response) => response.data ?? [],
  });
}

export function useAdminService(serviceId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...serviceKeys.admin(user?.id ?? null), "detail", serviceId],
    queryFn: ({ signal }) => adminGetService(serviceId, signal),
    enabled: canManageServicesAsAdmin(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminServiceActions() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: serviceKeys.admin(accountId) });
  return {
    createForUser: useMutation({
      mutationFn: ({ userId, body }: { userId: number; body: SaveServiceRequest }) => adminCreateUserService(userId, body),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ serviceId, body }: { serviceId: number; body: SaveServiceRequest }) => adminUpdateService(serviceId, body),
      onSuccess,
    }),
    archive: useMutation({ mutationFn: adminArchiveService, onSuccess }),
  };
}

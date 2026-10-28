import { AdminClientListFilters, ClientListFilters } from "@/interfaces/client.interface";
import { adminListClients, adminSetClientHidden, listMyClients, listMyProviders, setClientHidden } from "@/services/clientService";
import { useAuthStore } from "@/stores/authStore";
import { canManageClientsAsAdmin, canViewClients } from "@/utility/access";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 20;

// Keys always include the account ID so a different account never reads this cache.
export const clientKeys = {
  all: (accountId: string | null) => ["clients", accountId] as const,
  clients: (accountId: string | null, filters: ClientListFilters) => [...clientKeys.all(accountId), "clients", filters] as const,
  providers: (accountId: string | null, filters: ClientListFilters) => [...clientKeys.all(accountId), "providers", filters] as const,
  admin: (accountId: string | null) => [...clientKeys.all(accountId), "admin"] as const,
};

const pages = {
  initialPageParam: 1,
  getNextPageParam: (last: { data?: { hasMore: boolean } | null }, _pages: unknown, page: number) => (last.data?.hasMore ? page + 1 : undefined),
};

/** Provider view: my clients, by business. */
export function useMyClients(filters: ClientListFilters) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: clientKeys.clients(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => listMyClients(filters, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: canViewClients(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

/** Customer view: businesses I've had accepted inspections with. */
export function useMyProviders(filters: ClientListFilters) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: clientKeys.providers(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => listMyProviders(filters, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: canViewClients(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

/** Refetches the lists rather than patching rows; also after a conflict. */
export function useSetClientHidden() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: ({ businessId, clientUserId, isHidden }: { businessId: number; clientUserId: number; isHidden: boolean }) =>
      setClientHidden(businessId, clientUserId, isHidden),
    onSettled: () => queryClient.invalidateQueries({ queryKey: clientKeys.all(accountId) }),
  });
}

// Admin (guide 19): SuperAdmin relationships.
export function useAdminClients(filters: AdminClientListFilters = {}) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...clientKeys.admin(user?.id ?? null), filters],
    queryFn: ({ pageParam, signal }) => adminListClients(filters, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: canManageClientsAsAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAdminSetClientHidden() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: ({ businessId, clientUserId, isHidden }: { businessId: number; clientUserId: number; isHidden: boolean }) =>
      adminSetClientHidden(businessId, clientUserId, isHidden),
    onSettled: () => queryClient.invalidateQueries({ queryKey: clientKeys.all(accountId) }),
  });
}

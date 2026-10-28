import { AdminPriceCatalogueFilters, CreatePriceCatalogueItemRequest, PriceCatalogueFilters, UpdatePriceCatalogueItemRequest } from "@/interfaces/priceCatalogue.interface";
import {
  adminCreatePriceCatalogueItem,
  adminGetPriceCatalogueHistory,
  adminGetPriceCatalogueItem,
  adminListPriceCatalogue,
  adminPublishPriceCatalogueItem,
  adminRetirePriceCatalogueItem,
  adminUpdatePriceCatalogueItem,
  getPriceCatalogueItem,
  listPriceCatalogue,
} from "@/services/priceCatalogueService";
import { useAuthStore } from "@/stores/authStore";
import { canViewPriceCatalogue, canViewPriceCatalogueAdmin } from "@/utility/access";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 20;

// Keys always include the account ID so a different account never reads this cache.
export const priceCatalogueKeys = {
  all: (accountId: string | null) => ["price-catalogue", accountId] as const,
  list: (accountId: string | null, filters: PriceCatalogueFilters) => [...priceCatalogueKeys.all(accountId), "list", filters] as const,
  detail: (accountId: string | null, itemId: number) => [...priceCatalogueKeys.all(accountId), "detail", itemId] as const,
  admin: (accountId: string | null) => [...priceCatalogueKeys.all(accountId), "admin"] as const,
};

const pages = {
  initialPageParam: 1,
  getNextPageParam: (last: { data?: { hasMore: boolean } | null }, _pages: unknown, page: number) => (last.data?.hasMore ? page + 1 : undefined),
};

/** Published items; a new filter set starts at page 1. */
export function usePriceCatalogue(filters: PriceCatalogueFilters) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: priceCatalogueKeys.list(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => listPriceCatalogue(filters, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: canViewPriceCatalogue(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function usePriceCatalogueItem(itemId: number | null) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: priceCatalogueKeys.detail(user?.id ?? null, itemId ?? 0),
    queryFn: ({ signal }) => getPriceCatalogueItem(itemId!, signal),
    enabled: itemId !== null && canViewPriceCatalogue(user),
    select: (response) => response.data ?? null,
  });
}

// Management: price-catalogue-admin.view to read; .manage/.delete per action.
export function useAdminPriceCatalogue(filters: AdminPriceCatalogueFilters = {}) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...priceCatalogueKeys.admin(user?.id ?? null), "list", filters],
    queryFn: ({ pageParam, signal }) => adminListPriceCatalogue(filters, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: canViewPriceCatalogueAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAdminPriceCatalogueItem(itemId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...priceCatalogueKeys.admin(user?.id ?? null), "detail", itemId],
    queryFn: ({ signal }) => adminGetPriceCatalogueItem(itemId, signal),
    enabled: canViewPriceCatalogueAdmin(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminPriceCatalogueHistory(itemId: number) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...priceCatalogueKeys.admin(user?.id ?? null), "history", itemId],
    queryFn: ({ pageParam, signal }) => adminGetPriceCatalogueHistory(itemId, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: canViewPriceCatalogueAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

/** Member and management views both change, so every catalogue query refetches. */
export function useAdminPriceCatalogueActions() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSettled = () => queryClient.invalidateQueries({ queryKey: priceCatalogueKeys.all(accountId) });
  return {
    create: useMutation({ mutationFn: (body: CreatePriceCatalogueItemRequest) => adminCreatePriceCatalogueItem(body), onSettled }),
    update: useMutation({
      mutationFn: ({ itemId, body }: { itemId: number; body: UpdatePriceCatalogueItemRequest }) => adminUpdatePriceCatalogueItem(itemId, body),
      onSettled,
    }),
    publish: useMutation({ mutationFn: (itemId: number) => adminPublishPriceCatalogueItem(itemId), onSettled }),
    retire: useMutation({ mutationFn: (itemId: number) => adminRetirePriceCatalogueItem(itemId), onSettled }),
  };
}

import {
  AdminPriceItemRequestFilters,
  ApprovePriceItemRequest,
  CreatePriceItemRequest,
  PriceItemRequestFilters,
  ProviderPriceFilters,
  SubmitProviderPriceRequest,
} from "@/interfaces/providerPrice.interface";
import {
  adminApprovePriceItemRequest,
  adminCreatePriceItemRequest,
  adminGetPriceItemRequest,
  adminGetProviderPrice,
  adminListPriceItemRequests,
  adminListProviderPrices,
  adminRejectPriceItemRequest,
  adminRestoreProviderPrice,
  adminSubmitProviderPrice,
  adminUpdateProviderPrice,
  adminWithdrawProviderPrice,
  createPriceItemRequest,
  getPriceItemRequest,
  getPriceItemRequestHistory,
  getProviderPrice,
  getProviderPriceHistory,
  listAvailablePriceItems,
  listMyPriceItemRequests,
  listMyProviderPrices,
  restoreProviderPrice,
  submitProviderPrice,
  updateProviderPrice,
  withdrawProviderPrice,
} from "@/services/providerPriceService";
import { useAuthStore } from "@/stores/authStore";
import { canManageProviderPricesAsAdmin, canViewProviderPrices } from "@/utility/access";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { priceCatalogueKeys } from "./usePriceCatalogue";

const PAGE_SIZE = 20;

// Keys always include the account ID so a different account never reads this cache.
export const providerPriceKeys = {
  all: (accountId: string | null) => ["provider-prices", accountId] as const,
  mine: (accountId: string | null, filters: ProviderPriceFilters) => [...providerPriceKeys.all(accountId), "mine", filters] as const,
  available: (accountId: string | null) => [...providerPriceKeys.all(accountId), "available"] as const,
  detail: (accountId: string | null, id: number) => [...providerPriceKeys.all(accountId), "detail", id] as const,
  requests: (accountId: string | null, filters: PriceItemRequestFilters) => [...providerPriceKeys.all(accountId), "requests", filters] as const,
  request: (accountId: string | null, id: number) => [...providerPriceKeys.all(accountId), "request", id] as const,
  admin: (accountId: string | null) => [...providerPriceKeys.all(accountId), "admin"] as const,
};

const pages = {
  initialPageParam: 1,
  getNextPageParam: (last: { data?: { hasMore: boolean } | null }, _pages: unknown, page: number) => (last.data?.hasMore ? page + 1 : undefined),
};

/** Prices change the shared catalogue average, so both refetch after writes. */
function useRefreshPrices() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: providerPriceKeys.all(accountId) }),
    queryClient.invalidateQueries({ queryKey: priceCatalogueKeys.all(accountId) }),
  ]);
}

export function useMyProviderPrices(filters: ProviderPriceFilters) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: providerPriceKeys.mine(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => listMyProviderPrices(filters, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: canViewProviderPrices(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAvailablePriceItems(enabled = true) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: providerPriceKeys.available(user?.id ?? null),
    queryFn: ({ pageParam, signal }) => listAvailablePriceItems(pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: enabled && canViewProviderPrices(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useProviderPrice(id: number | null) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: providerPriceKeys.detail(user?.id ?? null, id ?? 0),
    queryFn: ({ signal }) => getProviderPrice(id!, signal),
    enabled: id !== null && canViewProviderPrices(user),
    select: (response) => response.data ?? null,
  });
}

export function useProviderPriceHistory(id: number | null) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...providerPriceKeys.detail(user?.id ?? null, id ?? 0), "history"],
    queryFn: ({ pageParam, signal }) => getProviderPriceHistory(id!, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: id !== null && canViewProviderPrices(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

/** Refetches after every write, including conflicts (another change may have landed). */
export function useProviderPriceActions() {
  const refresh = useRefreshPrices();
  const onSettled = () => { refresh(); };
  return {
    submit: useMutation({ mutationFn: (body: SubmitProviderPriceRequest) => submitProviderPrice(body), onSettled }),
    update: useMutation({ mutationFn: ({ id, price }: { id: number; price: number }) => updateProviderPrice(id, { price }), onSettled }),
    withdraw: useMutation({ mutationFn: (id: number) => withdrawProviderPrice(id), onSettled }),
    restore: useMutation({ mutationFn: ({ id, price }: { id: number; price: number }) => restoreProviderPrice(id, { price }), onSettled }),
  };
}

export function useMyPriceItemRequests(filters: PriceItemRequestFilters) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: providerPriceKeys.requests(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => listMyPriceItemRequests(filters, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: canViewProviderPrices(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function usePriceItemRequest(id: number | null) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: providerPriceKeys.request(user?.id ?? null, id ?? 0),
    queryFn: ({ signal }) => getPriceItemRequest(id!, signal),
    enabled: id !== null && canViewProviderPrices(user),
    select: (response) => response.data ?? null,
  });
}

export function usePriceItemRequestHistory(id: number | null) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...providerPriceKeys.request(user?.id ?? null, id ?? 0), "history"],
    queryFn: ({ pageParam, signal }) => getPriceItemRequestHistory(id!, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: id !== null && canViewProviderPrices(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useCreatePriceItemRequest() {
  const refresh = useRefreshPrices();
  return useMutation({ mutationFn: (body: CreatePriceItemRequest) => createPriceItemRequest(body), onSettled: () => { refresh(); } });
}

// Admin (guide 19): SuperAdmin prices and item-request review.
export function useAdminProviderPrices(filters: ProviderPriceFilters = {}) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...providerPriceKeys.admin(user?.id ?? null), "prices", filters],
    queryFn: ({ pageParam, signal }) => adminListProviderPrices(filters, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: canManageProviderPricesAsAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAdminProviderPrice(id: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...providerPriceKeys.admin(user?.id ?? null), "price", id],
    queryFn: ({ signal }) => adminGetProviderPrice(id, signal),
    enabled: canManageProviderPricesAsAdmin(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminPriceItemRequests(filters: AdminPriceItemRequestFilters = {}) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...providerPriceKeys.admin(user?.id ?? null), "requests", filters],
    queryFn: ({ pageParam, signal }) => adminListPriceItemRequests(filters, pageParam, PAGE_SIZE, signal),
    ...pages,
    enabled: canManageProviderPricesAsAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAdminPriceItemRequest(id: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...providerPriceKeys.admin(user?.id ?? null), "request", id],
    queryFn: ({ signal }) => adminGetPriceItemRequest(id, signal),
    enabled: canManageProviderPricesAsAdmin(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminProviderPriceActions() {
  const refresh = useRefreshPrices();
  const onSettled = () => { refresh(); };
  return {
    submitForBusiness: useMutation({
      mutationFn: ({ businessId, body }: { businessId: number; body: SubmitProviderPriceRequest }) => adminSubmitProviderPrice(businessId, body),
      onSettled,
    }),
    update: useMutation({ mutationFn: ({ id, price }: { id: number; price: number }) => adminUpdateProviderPrice(id, { price }), onSettled }),
    withdraw: useMutation({ mutationFn: (id: number) => adminWithdrawProviderPrice(id), onSettled }),
    restore: useMutation({ mutationFn: ({ id, price }: { id: number; price: number }) => adminRestoreProviderPrice(id, { price }), onSettled }),
    proposeForBusiness: useMutation({
      mutationFn: ({ businessId, body }: { businessId: number; body: CreatePriceItemRequest }) => adminCreatePriceItemRequest(businessId, body),
      onSettled,
    }),
    approve: useMutation({ mutationFn: ({ id, body }: { id: number; body: ApprovePriceItemRequest }) => adminApprovePriceItemRequest(id, body), onSettled }),
    reject: useMutation({ mutationFn: ({ id, reason }: { id: number; reason: string }) => adminRejectPriceItemRequest(id, { reason }), onSettled }),
  };
}

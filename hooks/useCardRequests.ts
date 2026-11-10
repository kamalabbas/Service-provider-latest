import {
  AdminCancelCardRequest,
  AdminCardDecisionRequest,
  AdminCardRequestListFilters,
  AdminCreateCardRequest,
  CardDeliveryAddress,
  CardRequestListFilters,
  CardRequestResponse,
} from "@/interfaces/cardRequest.interface";
import {
  adminCancelCardRequest,
  adminCreateCardRequest,
  adminDecideCardRequest,
  adminGetCardRequest,
  adminListCardRequests,
  adminUpdateCardDeliveryAddress,
  cancelCardRequest,
  getCardRequest,
  listMyCardRequests,
  getCardAllowances,
  listCardRefunds,
  updateCardDeliveryAddress,
} from "@/services/cardRequestService";
import { useAuthStore } from "@/stores/authStore";
import { canReviewCardRequests, canViewCardRequests } from "@/utility/access";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 20;

// Keys always include the account ID so a different account never reads this cache.
export const cardRequestKeys = {
  all: (accountId: string | null) => ["card-requests", accountId] as const,
  list: (accountId: string | null, filters: CardRequestListFilters) => [...cardRequestKeys.all(accountId), "list", filters] as const,
  detail: (accountId: string | null, requestId: number) => [...cardRequestKeys.all(accountId), "detail", requestId] as const,
  admin: (accountId: string | null) => [...cardRequestKeys.all(accountId), "admin"] as const,
};

export function useMyCardRequests(filters: CardRequestListFilters) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: cardRequestKeys.list(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => listMyCardRequests(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canViewCardRequests(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useCardRequest(requestId: number | null) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: cardRequestKeys.detail(user?.id ?? null, requestId ?? 0),
    queryFn: ({ signal }) => getCardRequest(requestId!, signal),
    enabled: requestId !== null && canViewCardRequests(user),
    select: (response) => response.data ?? null,
  });
}

/** Creating, editing and cancelling refetch every card request view, including after conflicts. */
export function useCardRequestActions() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: cardRequestKeys.all(accountId) });
  const options = {
    onSuccess: async (response: CardRequestResponse) => {
      if (response.data) queryClient.setQueryData(cardRequestKeys.detail(accountId, response.data.id), response);
      await refresh();
    },
    onError: () => { refresh(); },
  };
  return {
    updateAddress: useMutation({
      mutationFn: ({ requestId, address }: { requestId: number; address: CardDeliveryAddress }) => updateCardDeliveryAddress(requestId, address),
      ...options,
    }),
    cancel: useMutation({ mutationFn: (requestId: number) => cancelCardRequest(requestId), ...options }),
  };
}

// Admin (guide 19): SuperAdmin review queue.
export function useAdminCardRequests(filters: AdminCardRequestListFilters = {}) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...cardRequestKeys.admin(user?.id ?? null), "list", filters],
    queryFn: ({ pageParam, signal }) => adminListCardRequests(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canReviewCardRequests(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAdminCardRequest(requestId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...cardRequestKeys.admin(user?.id ?? null), "detail", requestId],
    queryFn: ({ signal }) => adminGetCardRequest(requestId, signal),
    enabled: canReviewCardRequests(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminCardRequestActions() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSettled = () => queryClient.invalidateQueries({ queryKey: cardRequestKeys.all(accountId) });
  return {
    createForOwner: useMutation({
      mutationFn: ({ ownerUserId, body }: { ownerUserId: number; body: AdminCreateCardRequest }) => adminCreateCardRequest(ownerUserId, body),
      onSettled,
    }),
    decide: useMutation({
      mutationFn: ({ requestId, body }: { requestId: number; body: AdminCardDecisionRequest }) => adminDecideCardRequest(requestId, body),
      onSettled,
    }),
    cancel: useMutation({
      mutationFn: ({ requestId, body }: { requestId: number; body: AdminCancelCardRequest }) => adminCancelCardRequest(requestId, body),
      onSettled,
    }),
    updateAddress: useMutation({
      mutationFn: ({ requestId, address }: { requestId: number; address: CardDeliveryAddress }) => adminUpdateCardDeliveryAddress(requestId, address),
      onSettled,
    }),
  };
}

// Guide 22: card fee, free card credits and automatic refunds.
export function useCardAllowances() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...cardRequestKeys.all(user?.id ?? null), "allowances"],
    queryFn: ({ signal }) => getCardAllowances(signal),
    enabled: canViewCardRequests(user),
    select: (response) => response.data ?? null,
  });
}

export function useCardRefunds() {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...cardRequestKeys.all(user?.id ?? null), "refunds"],
    queryFn: ({ pageParam, signal }) => listCardRefunds(pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canViewCardRequests(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

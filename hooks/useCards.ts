import { AdminCardActionRequest, AdminCardListFilters, Card, CardListFilters, CardResponse, UpdateCardSettingsRequest } from "@/interfaces/card.interface";
import { CardReplacementReason } from "@/interfaces/cardRequest.interface";
import {
  adminCardAction,
  adminGetCard,
  adminGetCardSettings,
  adminIssueCard,
  adminListCards,
  adminUpdateCardSettings,
  getCard,
  listMyCards,
  receiveCard,
  requestCardReplacement,
} from "@/services/cardService";
import { useAuthStore } from "@/stores/authStore";
import { canManageCardsAsAdmin, canViewCards } from "@/utility/access";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cardRequestKeys } from "./useCardRequests";

const PAGE_SIZE = 20;

// Keys always include the account ID so a different account never reads this cache.
export const cardKeys = {
  all: (accountId: string | null) => ["cards", accountId] as const,
  list: (accountId: string | null, filters: CardListFilters) => [...cardKeys.all(accountId), "list", filters] as const,
  detail: (accountId: string | null, cardId: number) => [...cardKeys.all(accountId), "detail", cardId] as const,
  admin: (accountId: string | null) => [...cardKeys.all(accountId), "admin"] as const,
};

export function useMyCards(filters: CardListFilters) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: cardKeys.list(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => listMyCards(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canViewCards(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useCard(cardId: number | null) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: cardKeys.detail(user?.id ?? null, cardId ?? 0),
    queryFn: ({ signal }) => getCard(cardId!, signal),
    enabled: cardId !== null && canViewCards(user),
    select: (response) => response.data ?? null,
  });
}

/**
 * Receipt and replacement change both cards and card requests (a lost
 * replacement cancels the old card at once), so both are refetched.
 */
export function useCardActions(cardId: number) {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: cardKeys.all(accountId) }),
    queryClient.invalidateQueries({ queryKey: cardRequestKeys.all(accountId) }),
  ]);
  return {
    receive: useMutation({
      mutationFn: () => receiveCard(cardId),
      onSuccess: async (response: CardResponse) => {
        queryClient.setQueryData(cardKeys.detail(accountId, cardId), response);
        await refresh();
      },
      onError: () => { refresh(); },
    }),
    replace: useMutation({
      mutationFn: ({ card, reason }: { card: Pick<Card, "id" | "subjectType">; reason: CardReplacementReason }) => requestCardReplacement(card, reason),
      onSettled: () => { refresh(); },
    }),
  };
}

// Admin (guide 19): SuperAdmin issuance, fulfilment and settings.
export function useAdminCards(filters: AdminCardListFilters = {}) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...cardKeys.admin(user?.id ?? null), "list", filters],
    queryFn: ({ pageParam, signal }) => adminListCards(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canManageCardsAsAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAdminCard(cardId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...cardKeys.admin(user?.id ?? null), "detail", cardId],
    queryFn: ({ signal }) => adminGetCard(cardId, signal),
    enabled: canManageCardsAsAdmin(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminCardSettings() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...cardKeys.admin(user?.id ?? null), "settings"],
    queryFn: ({ signal }) => adminGetCardSettings(signal),
    enabled: canManageCardsAsAdmin(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminCardActions() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSettled = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: cardKeys.all(accountId) }),
    queryClient.invalidateQueries({ queryKey: cardRequestKeys.all(accountId) }),
  ]);
  return {
    issue: useMutation({ mutationFn: (requestId: number) => adminIssueCard(requestId), onSettled }),
    act: useMutation({
      mutationFn: ({ cardId, body }: { cardId: number; body: AdminCardActionRequest }) => adminCardAction(cardId, body),
      onSettled,
    }),
    updateSettings: useMutation({ mutationFn: (body: UpdateCardSettingsRequest) => adminUpdateCardSettings(body), onSettled }),
  };
}

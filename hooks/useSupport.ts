import type {
  AdminSupportTicketListFilters,
  CreateSupportTicketRequest,
  SupportMode,
  SupportTicketListFilters,
  SupportTicketResponse,
} from "@/interfaces/support.interface";
import {
  adminCreateSupportTicket,
  adminListSupportTickets,
  closeSupportTicket,
  createSupportTicket,
  getSupportTicket,
  listMySupportTickets,
  listSupportMessages,
  listSupportTicketHistory,
  reopenSupportTicket,
  sendSupportMessage,
} from "@/services/supportService";
import { useAuthStore } from "@/stores/authStore";
import { canManageSupportAsAdmin, canViewSupport } from "@/utility/access";
import { mergeSupportMessages } from "@/utility/supportRules";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 20;

// Keys always include the account ID so a different account never reads this cache.
export const supportKeys = {
  all: (accountId: string | null) => ["support", accountId] as const,
  list: (accountId: string | null, filters: SupportTicketListFilters) => [...supportKeys.all(accountId), "list", filters] as const,
  ticket: (accountId: string | null, mode: SupportMode, ticketId: number) => [...supportKeys.all(accountId), mode, ticketId] as const,
  messages: (accountId: string | null, mode: SupportMode, ticketId: number) => [...supportKeys.ticket(accountId, mode, ticketId), "messages"] as const,
  history: (accountId: string | null, mode: SupportMode, ticketId: number) => [...supportKeys.ticket(accountId, mode, ticketId), "history"] as const,
  admin: (accountId: string | null) => [...supportKeys.all(accountId), "admin-inbox"] as const,
};

const canRead = (user: Parameters<typeof canViewSupport>[0], mode: SupportMode) =>
  mode === "admin" ? canManageSupportAsAdmin(user) : canViewSupport(user);

export function useMySupportTickets(filters: SupportTicketListFilters) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: supportKeys.list(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => listMySupportTickets(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canViewSupport(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useSupportTicket(ticketId: number | null, mode: SupportMode = "member") {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: supportKeys.ticket(user?.id ?? null, mode, ticketId ?? 0),
    queryFn: ({ signal }) => getSupportTicket(mode, ticketId!, signal),
    enabled: ticketId !== null && canRead(user, mode),
    select: (response) => response.data ?? null,
  });
}

/** Newest first, merged across pages and deduplicated by message ID. */
export function useSupportMessages(ticketId: number | null, mode: SupportMode = "member") {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: supportKeys.messages(user?.id ?? null, mode, ticketId ?? 0),
    queryFn: ({ pageParam, signal }) => listSupportMessages(mode, ticketId!, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: ticketId !== null && canRead(user, mode),
    select: (data) => mergeSupportMessages(data.pages.map((page) => page.data?.items ?? [])),
  });
}

export function useSupportTicketHistory(ticketId: number | null, mode: SupportMode = "member") {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: supportKeys.history(user?.id ?? null, mode, ticketId ?? 0),
    queryFn: ({ pageParam, signal }) => listSupportTicketHistory(mode, ticketId!, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: ticketId !== null && canRead(user, mode),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: (body: CreateSupportTicketRequest) => createSupportTicket(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supportKeys.all(accountId) }),
  });
}

/**
 * Replies, close and reopen refetch the ticket, its newest messages and every list,
 * on success and on failure (a concurrent reply or status change may have landed).
 * A sent reply is never appended locally: page boundaries may have shifted.
 */
export function useSupportThreadActions(ticketId: number, mode: SupportMode = "member") {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSettled = () => queryClient.invalidateQueries({ queryKey: supportKeys.all(accountId) });
  const onTicket = (response: SupportTicketResponse) => {
    if (response.data) queryClient.setQueryData(supportKeys.ticket(accountId, mode, ticketId), response);
  };
  return {
    send: useMutation({ mutationFn: (body: string) => sendSupportMessage(mode, ticketId, { body }), onSettled }),
    close: useMutation({ mutationFn: () => closeSupportTicket(mode, ticketId), onSuccess: onTicket, onSettled }),
    reopen: useMutation({ mutationFn: () => reopenSupportTicket(mode, ticketId), onSuccess: onTicket, onSettled }),
  };
}

// Admin (guide 19): SuperAdmin inbox with owner and status filters.
export function useAdminSupportTickets(filters: AdminSupportTicketListFilters = {}) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...supportKeys.admin(user?.id ?? null), filters],
    queryFn: ({ pageParam, signal }) => adminListSupportTickets(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canManageSupportAsAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAdminCreateSupportTicket() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: ({ ownerUserId, body }: { ownerUserId: number; body: CreateSupportTicketRequest }) => adminCreateSupportTicket(ownerUserId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supportKeys.all(accountId) }),
  });
}

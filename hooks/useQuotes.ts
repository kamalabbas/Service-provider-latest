import { NativeUploadFile } from "@/services/apiFiles";
import { AdminQuoteDecisionRequest, AdminQuoteListFilters, CreateQuoteRequest, QuoteListFilters, QuoteResponse } from "@/interfaces/quote.interface";
import {
  acceptQuote,
  adminCreateQuote,
  adminDecideQuote,
  adminGetQuote,
  adminListQuotes,
  adminUploadQuotePdf,
  createQuote,
  getQuote,
  listMyQuotes,
  rejectQuote,
  uploadQuotePdf,
  withdrawQuote,
} from "@/services/quoteService";
import { useAuthStore } from "@/stores/authStore";
import { canManageQuotesAsAdmin, canViewQuotes } from "@/utility/access";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 20;

// Keys always include the account ID so a different account never reads this cache.
export const quoteKeys = {
  all: (accountId: string | null) => ["quotes", accountId] as const,
  list: (accountId: string | null, filters: QuoteListFilters) => [...quoteKeys.all(accountId), "list", filters] as const,
  detail: (accountId: string | null, quoteId: number) => [...quoteKeys.all(accountId), "detail", quoteId] as const,
  admin: (accountId: string | null) => [...quoteKeys.all(accountId), "admin"] as const,
};

export function useMyQuotes(filters: QuoteListFilters) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: quoteKeys.list(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => listMyQuotes(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canViewQuotes(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useQuote(quoteId: number | null) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: quoteKeys.detail(user?.id ?? null, quoteId ?? 0),
    queryFn: ({ signal }) => getQuote(quoteId!, signal),
    enabled: quoteId !== null && canViewQuotes(user),
    select: (response) => response.data ?? null,
  });
}

/** Decisions and uploads refetch the quote and lists, including after a state conflict or expiry. */
export function useQuoteActions(quoteId: number) {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: quoteKeys.all(accountId) });
  const options = {
    onSuccess: async (response: QuoteResponse) => {
      queryClient.setQueryData(quoteKeys.detail(accountId, quoteId), response);
      await refresh();
    },
    onError: () => { refresh(); },
  };
  return {
    refresh,
    accept: useMutation({ mutationFn: () => acceptQuote(quoteId), ...options }),
    reject: useMutation({ mutationFn: (reason: string) => rejectQuote(quoteId, { reason }), ...options }),
    withdraw: useMutation({ mutationFn: (reason: string) => withdrawQuote(quoteId, { reason }), ...options }),
    uploadPdf: useMutation({ mutationFn: (file: NativeUploadFile) => uploadQuotePdf(quoteId, file), ...options }),
  };
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: (body: CreateQuoteRequest) => createQuote(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quoteKeys.all(accountId) }),
  });
}

// Admin (guide 19): SuperAdmin quotes.
export function useAdminQuotes(filters: AdminQuoteListFilters = {}) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...quoteKeys.admin(user?.id ?? null), "list", filters],
    queryFn: ({ pageParam, signal }) => adminListQuotes(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canManageQuotesAsAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAdminQuote(quoteId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...quoteKeys.admin(user?.id ?? null), "detail", quoteId],
    queryFn: ({ signal }) => adminGetQuote(quoteId, signal),
    enabled: canManageQuotesAsAdmin(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminQuoteActions() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSettled = () => queryClient.invalidateQueries({ queryKey: quoteKeys.all(accountId) });
  return {
    create: useMutation({ mutationFn: (body: CreateQuoteRequest) => adminCreateQuote(body), onSettled }),
    decide: useMutation({
      mutationFn: ({ quoteId, body }: { quoteId: number; body: AdminQuoteDecisionRequest }) => adminDecideQuote(quoteId, body),
      onSettled,
    }),
    uploadPdf: useMutation({
      mutationFn: ({ quoteId, file }: { quoteId: number; file: NativeUploadFile }) => adminUploadQuotePdf(quoteId, file),
      onSettled,
    }),
  };
}

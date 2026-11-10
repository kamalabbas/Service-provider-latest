import type { PaymentOperation } from "@/interfaces/payment.interface";
import type { ApiPage, ApiResponse } from "@/interfaces/serviceProviderApi.interface";
import { toAppError } from "@/services/apiError";
import { clearSubmit, forgetOperation, openPaymentPage, rememberOperation, requestIdFor } from "@/services/paymentFlow";
import {
  getPaymentAccount,
  getPaymentOperation,
  listInspectionRefunds,
  listPaymentConfirmations,
  listPaymentPlans,
  listPaymentTransactions,
  listSavedCards,
  removeSavedCard,
  setDefaultSavedCard,
} from "@/services/paymentService";
import { useAuthStore } from "@/stores/authStore";
import { canViewPayments } from "@/utility/access";
import { isOperationSettled } from "@/utility/paymentRules";
import { createUuid } from "@/utility/uuid";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

const PAGE_SIZE = 20;
const POLL_MS = 2500;
const BACKOFF_MS = 10000;

// Keys always include the account ID so a different account never reads this cache.
export const paymentKeys = {
  all: (accountId: string | null) => ["payments", accountId] as const,
  account: (accountId: string | null) => [...paymentKeys.all(accountId), "account"] as const,
  plans: (accountId: string | null) => [...paymentKeys.all(accountId), "plans"] as const,
  cards: (accountId: string | null) => [...paymentKeys.all(accountId), "cards"] as const,
  operation: (accountId: string | null, operationId: string) => [...paymentKeys.all(accountId), "operation", operationId] as const,
  history: (accountId: string | null, kind: "transactions" | "confirmations" | "refunds") => [...paymentKeys.all(accountId), kind] as const,
};

/** Verified benefits (price list, provider visibility), fees, free credits and subscription. */
export function usePaymentAccount() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: paymentKeys.account(user?.id ?? null),
    queryFn: ({ signal }) => getPaymentAccount(signal),
    enabled: canViewPayments(user),
    select: (response) => response.data ?? null,
  });
}

export function usePaymentPlans() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: paymentKeys.plans(user?.id ?? null),
    queryFn: ({ signal }) => listPaymentPlans(signal),
    enabled: canViewPayments(user),
    select: (response) => response.data ?? [],
  });
}

export function useSavedCards() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: paymentKeys.cards(user?.id ?? null),
    queryFn: ({ signal }) => listSavedCards(signal),
    enabled: canViewPayments(user),
    select: (response) => response.data ?? [],
  });
}

function usePaymentHistory<T>(kind: "transactions" | "confirmations" | "refunds", fetch: (page: number, pageSize: number, signal?: AbortSignal) => Promise<ApiResponse<ApiPage<T>>>) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: paymentKeys.history(user?.id ?? null, kind),
    queryFn: ({ pageParam, signal }) => fetch(pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canViewPayments(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

/** Charges and refunds with Stripe receipt links. */
export const usePaymentTransactions = () => usePaymentHistory("transactions", listPaymentTransactions);
/** Free and paid inspection confirmations (funding units). */
export const usePaymentConfirmations = () => usePaymentHistory("confirmations", listPaymentConfirmations);
/** Automatic inspection refunds. */
export const useInspectionRefunds = () => usePaymentHistory("refunds", listInspectionRefunds);

export function useSavedCardActions() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSettled = () => queryClient.invalidateQueries({ queryKey: paymentKeys.all(accountId) });
  return {
    setDefault: useMutation({ mutationFn: (cardId: string) => setDefaultSavedCard(cardId), onSettled }),
    remove: useMutation({ mutationFn: (cardId: string) => removeSavedCard(cardId), onSettled }),
  };
}

/**
 * Polls one operation every 2.5 s until it settles (10 s after a 429), and again whenever the
 * app returns to the foreground, e.g. after closing Stripe's page.
 */
export function usePaymentOperation(operationId: string | null) {
  const user = useAuthStore((state) => state.user);
  const query = useQuery({
    queryKey: paymentKeys.operation(user?.id ?? null, operationId ?? ""),
    queryFn: ({ signal }) => getPaymentOperation(operationId!, signal),
    enabled: !!operationId && canViewPayments(user),
    select: (response) => response.data ?? null,
    refetchInterval: (state) => {
      if (isOperationSettled(state.state.data?.data)) return false;
      const error = state.state.error;
      return isAxiosError(error) && error.response?.status === 429 ? BACKOFF_MS : POLL_MS;
    },
    refetchIntervalInBackground: false,
  });
  const { refetch } = query;
  useEffect(() => {
    if (!operationId) return;
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void refetch(); });
    return () => subscription.remove();
  }, [operationId, refetch]);
  return query;
}

export interface PaymentFlowOptions {
  /** Groups request IDs: one unresolved submission per kind, e.g. "subscription". */
  kind: string;
  /** Shown in Billing while the operation is still processing. */
  label: string;
  /** Called once when the operation succeeds or fails for good. */
  onSettled?: (operation: PaymentOperation) => void;
}

/**
 * Runs one logical purchase: reuse the request ID until the server answers, remember the
 * operation, open Stripe when it needs action, and poll the verified outcome. Coming back
 * from Stripe is never treated as proof of payment.
 */
export function usePaymentFlow({ kind, label, onSettled }: PaymentFlowOptions) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const accountId = user?.id ?? null;
  const [operationId, setOperationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const opened = useRef<string | null>(null);
  const reported = useRef<string | null>(null);
  const operation = usePaymentOperation(operationId);
  const current = operation.data ?? null;

  const open = useCallback(async (url?: string | null) => {
    try {
      await openPaymentPage(url);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The payment page couldn't be opened.");
    }
  }, []);

  /** `inputKey` must change whenever the input changes; identical input reuses the request ID. */
  const start = useCallback(async (inputKey: string, submit: (requestId: string) => Promise<{ data?: PaymentOperation | null }>) => {
    if (submitting || !accountId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const requestId = await requestIdFor(kind, inputKey, accountId, createUuid);
      const response = await submit(requestId);
      await clearSubmit(kind, accountId);
      const result = response.data;
      if (!result?.id) throw new Error("The payment couldn't be started.");
      reported.current = null;
      opened.current = null;
      queryClient.setQueryData(paymentKeys.operation(accountId, result.id), response);
      setOperationId(result.id);
      if (!isOperationSettled(result)) {
        await rememberOperation({ operationId: result.id, kind, label, userId: accountId, startedAtUtc: new Date().toISOString() });
      }
    } catch (error) {
      const info = toAppError(error);
      // No answer: the charge may exist. Keep the request ID so a retry resolves the same operation.
      const uncertain = info.kind === "timeout" || info.kind === "network" || (isAxiosError(error) && !error.response);
      if (!uncertain) await clearSubmit(kind, accountId);
      setSubmitError(uncertain
        ? "We couldn't confirm whether this went through. Tap the button again: you won't be charged twice."
        : !isAxiosError(error) && error instanceof Error ? error.message : null);
    } finally {
      setSubmitting(false);
    }
  }, [accountId, kind, label, queryClient, submitting]);

  // Open Stripe automatically the first time an operation asks for it.
  useEffect(() => {
    if (current?.status === "requires_action" && current.checkoutUrl && opened.current !== current.id) {
      opened.current = current.id;
      void open(current.checkoutUrl);
    }
  }, [current, open]);

  // Settle once: forget it, refresh billing and anything it created.
  useEffect(() => {
    if (!current || !isOperationSettled(current) || reported.current === current.id) return;
    reported.current = current.id;
    void forgetOperation(current.id);
    // Billing, plus whatever the operation created: a booking changes the requester's
    // inspections and the service's canRequestInspection; a card request its lists.
    const roots = ["payments", ...(current.inspectionId ? ["inspections", "services"] : []), ...(current.cardRequestId || current.refundRequired ? ["card-requests", "cards"] : [])];
    roots.forEach((root) => { void queryClient.invalidateQueries({ queryKey: [root, accountId] }); });
    onSettled?.(current);
  }, [accountId, current, onSettled, queryClient]);

  return {
    start,
    /** Resume an operation remembered from before (e.g. after an app restart). */
    resume: setOperationId,
    reopen: () => open(current?.checkoutUrl),
    reset: () => { setOperationId(null); setSubmitError(null); },
    operation: current,
    operationId,
    submitting,
    polling: !!operationId && !isOperationSettled(current),
    error: submitError,
  };
}

import {
  AcceptInspectionRequest,
  AdminAssignInspectionEmployeeRequest,
  AdminInspectionDecisionRequest,
  AdminInspectionListFilters,
  CreateInspectionRequest,
  InspectionListFilters,
  InspectionResponse,
  RateInspectionRequest,
} from "@/interfaces/inspection.interface";
import {
  acceptInspection,
  adminAssignInspectionEmployee,
  adminCreateInspectionForRequester,
  adminDecideInspection,
  adminGetInspection,
  adminListInspections,
  adminRateInspection,
  assignInspectionEmployee,
  cancelInspection,
  completeInspection,
  createInspection,
  getInspection,
  issueCompletionCode,
  listMyInspections,
  rateInspection,
  rejectInspection,
  setInspectionHidden,
} from "@/services/inspectionService";
import { useAuthStore } from "@/stores/authStore";
import { canManageInspectionsAsAdmin, canViewInspections } from "@/utility/access";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientKeys } from "./useClients";
import { serviceKeys } from "./useServices";

const PAGE_SIZE = 20;

// Keys always include the account ID so a different account never reads this cache.
export const inspectionKeys = {
  all: (accountId: string | null) => ["inspections", accountId] as const,
  list: (accountId: string | null, filters: InspectionListFilters) => [...inspectionKeys.all(accountId), "list", filters] as const,
  detail: (accountId: string | null, inspectionId: number) => [...inspectionKeys.all(accountId), "detail", inspectionId] as const,
  admin: (accountId: string | null) => [...inspectionKeys.all(accountId), "admin"] as const,
};

export function useMyInspections(filters: InspectionListFilters) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: inspectionKeys.list(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => listMyInspections(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canViewInspections(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useInspection(inspectionId: number | null) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: inspectionKeys.detail(user?.id ?? null, inspectionId ?? 0),
    queryFn: ({ signal }) => getInspection(inspectionId!, signal),
    enabled: inspectionId !== null && canViewInspections(user),
    select: (response) => response.data ?? null,
  });
}

/**
 * Every workflow write refetches the inspection and its lists; a state conflict
 * (another party acted first) also refetches so the screen shows the real state.
 */
export function useInspectionActions(inspectionId: number) {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  // Acceptance creates or updates a client relationship (guide 12).
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: inspectionKeys.all(accountId) }),
    queryClient.invalidateQueries({ queryKey: clientKeys.all(accountId) }),
  ]);
  const store = async (response: InspectionResponse) => {
    queryClient.setQueryData(inspectionKeys.detail(accountId, inspectionId), response);
    await refresh();
  };
  const options = { onSuccess: store, onError: () => { refresh(); } };

  return {
    refresh,
    accept: useMutation({ mutationFn: (body: AcceptInspectionRequest) => acceptInspection(inspectionId, body), ...options }),
    reject: useMutation({ mutationFn: (reason: string) => rejectInspection(inspectionId, { reason }), ...options }),
    cancel: useMutation({ mutationFn: (reason: string) => cancelInspection(inspectionId, { reason }), ...options }),
    complete: useMutation({ mutationFn: (code: string) => completeInspection(inspectionId, { code }), ...options }),
    assignWorker: useMutation({ mutationFn: (employeeId: number | null) => assignInspectionEmployee(inspectionId, employeeId), ...options }),
    rate: useMutation({ mutationFn: (body: RateInspectionRequest) => rateInspection(inspectionId, body), ...options }),
    setHidden: useMutation({ mutationFn: (isHidden: boolean) => setInspectionHidden(inspectionId, isHidden), ...options }),
    // The code lives only in component state: never cached, stored or logged.
    issueCode: useMutation({ mutationFn: () => issueCompletionCode(inspectionId), gcTime: 0 }),
  };
}

/** Discovery's canRequestInspection changes too, so service results refetch. */
export function useCreateInspection() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: (body: CreateInspectionRequest) => createInspection(body),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: inspectionKeys.all(accountId) }),
      queryClient.invalidateQueries({ queryKey: serviceKeys.all(accountId) }),
    ]),
  });
}

// Admin (guide 19): SuperAdmin inspections.
export function useAdminInspections(filters: AdminInspectionListFilters = {}) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...inspectionKeys.admin(user?.id ?? null), "list", filters],
    queryFn: ({ pageParam, signal }) => adminListInspections(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canManageInspectionsAsAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAdminInspection(inspectionId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...inspectionKeys.admin(user?.id ?? null), "detail", inspectionId],
    queryFn: ({ signal }) => adminGetInspection(inspectionId, signal),
    enabled: canManageInspectionsAsAdmin(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminInspectionActions() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSettled = () => queryClient.invalidateQueries({ queryKey: inspectionKeys.all(accountId) });
  return {
    createForRequester: useMutation({
      mutationFn: ({ requesterUserId, body }: { requesterUserId: number; body: CreateInspectionRequest }) => adminCreateInspectionForRequester(requesterUserId, body),
      onSettled,
    }),
    decide: useMutation({
      mutationFn: ({ inspectionId, body }: { inspectionId: number; body: AdminInspectionDecisionRequest }) => adminDecideInspection(inspectionId, body),
      onSettled,
    }),
    assignWorker: useMutation({
      mutationFn: ({ inspectionId, body }: { inspectionId: number; body: AdminAssignInspectionEmployeeRequest }) => adminAssignInspectionEmployee(inspectionId, body),
      onSettled,
    }),
    rate: useMutation({
      mutationFn: ({ inspectionId, body }: { inspectionId: number; body: RateInspectionRequest }) => adminRateInspection(inspectionId, body),
      onSettled,
    }),
  };
}

import { EmployeeListFilters, SaveEmployeeRequest } from "@/interfaces/employee.interface";
import {
  adminArchiveEmployee,
  adminCreateBusinessEmployee,
  adminGetEmployee,
  adminListUserEmployees,
  adminUpdateEmployee,
  archiveMyEmployee,
  createMyEmployee,
  getMyEmployee,
  listMyEmployees,
  updateMyEmployee,
} from "@/services/employeeService";
import { useAuthStore } from "@/stores/authStore";
import { canManageEmployeesAsAdmin, canViewEmployees } from "@/utility/access";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBusinessAccess } from "./useBusiness";

const PAGE_SIZE = 20;

// Keys always include the account ID so a different account never reads this cache.
export const employeeKeys = {
  all: (accountId: string | null) => ["employees", accountId] as const,
  list: (accountId: string | null, filters: EmployeeListFilters) => [...employeeKeys.all(accountId), "list", filters] as const,
  detail: (accountId: string | null, employeeId: number) => [...employeeKeys.all(accountId), "detail", employeeId] as const,
  admin: (accountId: string | null) => [...employeeKeys.all(accountId), "admin"] as const,
};

/** Paged roster; pages load on demand. includeArchived shows history. */
export function useMyEmployees(filters: EmployeeListFilters) {
  const { user, userTypeCode } = useBusinessAccess();
  return useInfiniteQuery({
    queryKey: employeeKeys.list(user?.id ?? null, filters),
    queryFn: ({ pageParam, signal }) => listMyEmployees(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canViewEmployees(user, userTypeCode),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useMyEmployee(employeeId: number | null) {
  const { user, userTypeCode } = useBusinessAccess();
  return useQuery({
    queryKey: employeeKeys.detail(user?.id ?? null, employeeId ?? 0),
    queryFn: ({ signal }) => getMyEmployee(employeeId!, signal),
    enabled: employeeId !== null && canViewEmployees(user, userTypeCode),
    select: (response) => response.data ?? null,
  });
}

/** POST without an ID, full-replacement PUT with one. */
export function useSaveMyEmployee(employeeId: number | null) {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: (body: SaveEmployeeRequest) => (employeeId === null ? createMyEmployee(body) : updateMyEmployee(employeeId, body)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeKeys.all(accountId) }),
  });
}

/**
 * Archival can clear accepted inspection assignments and cancel card requests,
 * so every screen refetches rather than patching local state.
 */
export function useArchiveMyEmployee() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (employeeId: number) => archiveMyEmployee(employeeId), onSuccess: () => queryClient.invalidateQueries() });
}

// Admin (guide 19): SuperAdmin rosters by target user/business IDs.
export function useAdminUserEmployees(userId: number, filters: EmployeeListFilters = {}) {
  const user = useAuthStore((state) => state.user);
  return useInfiniteQuery({
    queryKey: [...employeeKeys.admin(user?.id ?? null), "user", userId, filters],
    queryFn: ({ pageParam, signal }) => adminListUserEmployees(userId, filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => (last.data?.hasMore ? page + 1 : undefined),
    enabled: canManageEmployeesAsAdmin(user),
    select: (data) => data.pages.flatMap((page) => page.data?.items ?? []),
  });
}

export function useAdminEmployee(employeeId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...employeeKeys.admin(user?.id ?? null), "detail", employeeId],
    queryFn: ({ signal }) => adminGetEmployee(employeeId, signal),
    enabled: canManageEmployeesAsAdmin(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminEmployeeActions() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: employeeKeys.admin(accountId) });
  return {
    createForBusiness: useMutation({
      mutationFn: ({ businessId, body }: { businessId: number; body: SaveEmployeeRequest }) => adminCreateBusinessEmployee(businessId, body),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ employeeId, body }: { employeeId: number; body: SaveEmployeeRequest }) => adminUpdateEmployee(employeeId, body),
      onSuccess,
    }),
    archive: useMutation({ mutationFn: adminArchiveEmployee, onSuccess }),
  };
}

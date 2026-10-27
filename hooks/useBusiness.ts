import { BusinessResponse, SaveBusinessRequest } from "@/interfaces/business.interface";
import { PictureUploadFile } from "@/services/apiFiles";
import {
  adminArchiveBusiness,
  adminCreateBusinessForUser,
  adminGetBusiness,
  adminGetBusinessHistory,
  adminListBusinesses,
  adminUpdateBusiness,
  adminUploadBusinessPicture,
  archiveMyBusiness,
  createMyBusiness,
  getMyBusiness,
  updateMyBusiness,
  uploadMyBusinessPicture,
} from "@/services/businessService";
import { useAuthStore } from "@/stores/authStore";
import { canManageBusinessesAsAdmin, canViewOwnBusiness } from "@/utility/access";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMyMember } from "./useMembership";

// Keys always include the account ID so a different account never reads this cache.
export const businessKeys = {
  all: (accountId: string | null) => ["business", accountId] as const,
  me: (accountId: string | null) => [...businessKeys.all(accountId), "me"] as const,
  admin: (accountId: string | null) => [...businessKeys.all(accountId), "admin"] as const,
};

/** The member's type decides eligibility, so business screens read it with the business. */
export function useBusinessAccess() {
  const user = useAuthStore((state) => state.user);
  const member = useMyMember();
  return { user, member, userTypeCode: member.data?.userTypeCode ?? null };
}

/** The active business, or null when there is none. */
export function useMyBusiness() {
  const { user, userTypeCode } = useBusinessAccess();
  return useQuery({
    queryKey: businessKeys.me(user?.id ?? null),
    queryFn: ({ signal }) => getMyBusiness(signal),
    enabled: canViewOwnBusiness(user, userTypeCode),
    select: (response) => response.data ?? null,
  });
}

function useStoreMyBusiness() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  // The response is authoritative after server normalization; refetch to confirm.
  return async (response: BusinessResponse) => {
    queryClient.setQueryData(businessKeys.me(accountId), response);
    await queryClient.invalidateQueries({ queryKey: businessKeys.me(accountId) });
  };
}

/** POST when no business is active, PUT otherwise; never an implicit create. */
export function useSaveMyBusiness(exists: boolean) {
  const onSuccess = useStoreMyBusiness();
  return useMutation({
    mutationFn: (body: SaveBusinessRequest) => (exists ? updateMyBusiness(body) : createMyBusiness(body)),
    onSuccess,
  });
}

export function useUploadMyBusinessPicture() {
  const onSuccess = useStoreMyBusiness();
  return useMutation({ mutationFn: (file: PictureUploadFile) => uploadMyBusinessPicture(file), onSuccess });
}

/**
 * Archival also archives listings and the roster and cancels related card
 * requests, so every screen refetches rather than patching local flags.
 */
export function useArchiveMyBusiness() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: archiveMyBusiness, onSuccess: () => queryClient.invalidateQueries() });
}

// Admin (guide 19): SuperAdmin businesses, by stable user/business IDs.
export function useAdminBusinesses(filters: { userId?: number } = {}) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...businessKeys.admin(user?.id ?? null), "list", filters.userId ?? null],
    queryFn: ({ signal }) => adminListBusinesses(filters, signal),
    enabled: canManageBusinessesAsAdmin(user),
    select: (response) => response.data ?? [],
  });
}

export function useAdminBusiness(businessId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...businessKeys.admin(user?.id ?? null), "detail", businessId],
    queryFn: ({ signal }) => adminGetBusiness(businessId, signal),
    enabled: canManageBusinessesAsAdmin(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminBusinessHistory(businessId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...businessKeys.admin(user?.id ?? null), "history", businessId],
    queryFn: ({ signal }) => adminGetBusinessHistory(businessId, signal),
    enabled: canManageBusinessesAsAdmin(user),
    select: (response) => response.data ?? [],
  });
}

export function useAdminBusinessActions() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: businessKeys.admin(accountId) });
  return {
    createForUser: useMutation({
      mutationFn: ({ userId, body }: { userId: number; body: SaveBusinessRequest }) => adminCreateBusinessForUser(userId, body),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ businessId, body }: { businessId: number; body: SaveBusinessRequest }) => adminUpdateBusiness(businessId, body),
      onSuccess,
    }),
    archive: useMutation({ mutationFn: adminArchiveBusiness, onSuccess }),
    uploadPicture: useMutation({
      mutationFn: ({ businessId, file }: { businessId: number; file: PictureUploadFile }) => adminUploadBusinessPicture(businessId, file),
      onSuccess,
    }),
  };
}

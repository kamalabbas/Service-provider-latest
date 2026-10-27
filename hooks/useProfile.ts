import { ProfileResponse, SaveProfileRequest } from "@/interfaces/profile.interface";
import { PictureUploadFile } from "@/services/apiFiles";
import { refreshAccessToken } from "@/services/authSession";
import {
  adminGetUserProfile,
  adminGetUserProfileHistory,
  adminSaveUserProfile,
  adminUploadUserProfilePicture,
  getMyProfile,
  saveMyProfile,
  uploadMyProfilePicture,
} from "@/services/profileService";
import { useAuthStore } from "@/stores/authStore";
import { canManageUserProfiles, canViewOwnProfile } from "@/utility/access";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Keys always include the account ID so a different account never reads this cache.
export const profileKeys = {
  all: (accountId: string | null) => ["profile", accountId] as const,
  me: (accountId: string | null) => [...profileKeys.all(accountId), "me"] as const,
  admin: (accountId: string | null, userId: number) => [...profileKeys.all(accountId), "admin", userId] as const,
};

/** The signed-in member's profile, or null before the first save. */
export function useMyProfile() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: profileKeys.me(user?.id ?? null),
    queryFn: ({ signal }) => getMyProfile(signal),
    enabled: canViewOwnProfile(user),
    select: (response) => response.data ?? null,
  });
}

function useStoreMyProfile() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return async (response: ProfileResponse) => {
    queryClient.setQueryData(profileKeys.me(accountId), response);
    await queryClient.invalidateQueries({ queryKey: profileKeys.me(accountId) });
  };
}

/**
 * Saves the complete profile. During onboarding the session is refreshed so a
 * full-access token replaces the setup token; the caller checks the result.
 */
export function useSaveMyProfile() {
  const store = useStoreMyProfile();
  return useMutation({
    mutationFn: (body: SaveProfileRequest) => saveMyProfile(body),
    onSuccess: async (response) => {
      await store(response);
      if (useAuthStore.getState().user?.profileCompletionRequired) await refreshAccessToken();
    },
  });
}

export function useUploadMyProfilePicture() {
  const store = useStoreMyProfile();
  return useMutation({ mutationFn: (file: PictureUploadFile) => uploadMyProfilePicture(file), onSuccess: store });
}

// Admin (guide 19): SuperAdmin target-user profiles.
export function useAdminUserProfile(userId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: profileKeys.admin(user?.id ?? null, userId),
    queryFn: ({ signal }) => adminGetUserProfile(userId, signal),
    enabled: canManageUserProfiles(user),
    select: (response) => response.data ?? null,
  });
}

export function useAdminUserProfileHistory(userId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...profileKeys.admin(user?.id ?? null, userId), "history"],
    queryFn: ({ signal }) => adminGetUserProfileHistory(userId, signal),
    enabled: canManageUserProfiles(user),
    select: (response) => response.data ?? [],
  });
}

export function useAdminUserProfileActions(userId: number) {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: profileKeys.admin(accountId, userId) });
  return {
    save: useMutation({ mutationFn: (body: SaveProfileRequest) => adminSaveUserProfile(userId, body), onSuccess }),
    uploadPicture: useMutation({ mutationFn: (file: PictureUploadFile) => adminUploadUserProfilePicture(userId, file), onSuccess }),
  };
}

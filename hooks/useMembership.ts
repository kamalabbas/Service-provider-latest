import { MemberResponse, Role, SaveRoleRequest, SelectUserTypeRequest } from "@/interfaces/member.interface";
import { refreshAccessToken } from "@/services/authSession";
import {
  adminChangeUserType,
  adminCreateRole,
  adminDeactivateUser,
  adminDeleteRole,
  adminFindUserByEmail,
  adminGetUserRoles,
  adminListAllUsers,
  adminListPermissions,
  adminListRoles,
  adminReactivateUser,
  adminReplaceUserRoles,
  adminUpdateRole,
  deactivateMyAccount,
  getMyMember,
  getUserTypes,
  selectMyUserType,
} from "@/services/memberService";
import { useAuthStore } from "@/stores/authStore";
import { canAssignRoles, canViewOwnMembership, canViewRoles, canViewUsers } from "@/utility/access";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Keys always include the account ID so a different account never reads this cache.
export const memberKeys = {
  all: (accountId: string | null) => ["member", accountId] as const,
  me: (accountId: string | null) => [...memberKeys.all(accountId), "me"] as const,
  userTypes: (accountId: string | null) => [...memberKeys.all(accountId), "user-types"] as const,
  admin: (accountId: string | null) => [...memberKeys.all(accountId), "admin"] as const,
};

/** Public type list; fetched, never derived from role names. */
export function useUserTypes() {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useQuery({
    queryKey: memberKeys.userTypes(accountId),
    queryFn: ({ signal }) => getUserTypes(signal),
    staleTime: Infinity,
    select: (response) => response.data ?? [],
  });
}

/** The signed-in member, or null before the first type selection. */
export function useMyMember() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: memberKeys.me(user?.id ?? null),
    queryFn: ({ signal }) => getMyMember(signal),
    enabled: canViewOwnMembership(user),
    select: (response) => response.data ?? null,
  });
}

/** First type selection. A later change is an admin-only action. */
export function useSelectUserType() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: (body: SelectUserTypeRequest) => selectMyUserType(body),
    onSuccess: async (response: MemberResponse) => {
      queryClient.setQueryData(memberKeys.me(accountId), response);
      await queryClient.invalidateQueries({ queryKey: memberKeys.me(accountId) });
      // Types that need no profile get full access once the session refreshes.
      if (response.data && !response.data.profileCompletionRequired) await refreshAccessToken();
    },
  });
}

/** The caller signs out afterwards: the server has already revoked every session. */
export function useDeactivateMyAccount() {
  return useMutation({ mutationFn: deactivateMyAccount });
}

// Admin (guide 19): users, roles and type changes. Refetch after every lifecycle action.
export function useAdminUsers() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...memberKeys.admin(user?.id ?? null), "users"],
    queryFn: ({ signal }) => adminListAllUsers(signal),
    enabled: canViewUsers(user),
    select: (response) => response.data ?? [],
  });
}

export function useAdminUserByEmail(email: string) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...memberKeys.admin(user?.id ?? null), "user-by-email", email],
    queryFn: ({ signal }) => adminFindUserByEmail(email, signal),
    enabled: canViewUsers(user) && email.includes("@"),
    select: (response) => response.data ?? null,
  });
}

export function useAdminRoles() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...memberKeys.admin(user?.id ?? null), "roles"],
    queryFn: ({ signal }) => adminListRoles(signal),
    enabled: canViewRoles(user),
    select: (response) => response.data ?? [],
  });
}

export function useAdminPermissions() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...memberKeys.admin(user?.id ?? null), "permissions"],
    queryFn: ({ signal }) => adminListPermissions(signal),
    enabled: canViewRoles(user),
    staleTime: Infinity,
    select: (response) => response.data ?? [],
  });
}

export function useAdminUserRoles(userId: number) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...memberKeys.admin(user?.id ?? null), "user-roles", userId],
    queryFn: ({ signal }) => adminGetUserRoles(userId, signal),
    enabled: canViewRoles(user),
    select: (response) => response.data ?? [],
  });
}

export function useAdminMemberActions() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: memberKeys.admin(user?.id ?? null) });

  return {
    canAssignRoles: canAssignRoles(user),
    deactivateUser: useMutation({ mutationFn: adminDeactivateUser, onSuccess }),
    reactivateUser: useMutation({ mutationFn: adminReactivateUser, onSuccess }),
    changeUserType: useMutation({
      mutationFn: ({ userId, body }: { userId: number; body: SelectUserTypeRequest }) => adminChangeUserType(userId, body),
      onSuccess,
    }),
    createRole: useMutation({ mutationFn: (body: SaveRoleRequest) => adminCreateRole(body), onSuccess }),
    updateRole: useMutation({
      mutationFn: ({ roleId, body }: { roleId: number; body: SaveRoleRequest }) => adminUpdateRole(roleId, body),
      onSuccess,
    }),
    deleteRole: useMutation({ mutationFn: adminDeleteRole, onSuccess }),
    replaceUserRoles: useMutation({
      mutationFn: ({ userId, roleIds, roles }: { userId: number; roleIds: number[]; roles: Role[] }) =>
        adminReplaceUserRoles(userId, roleIds, roles),
      onSuccess,
    }),
  };
}

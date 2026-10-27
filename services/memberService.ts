import {
  AssignUserRolesRequest,
  MemberResponse,
  PermissionListResponse,
  Role,
  RoleListResponse,
  RoleResponse,
  SaveRoleRequest,
  SelectUserTypeRequest,
  UserAdministrationListResponse,
  UserAdministrationResponse,
  UserTypeListResponse,
} from "@/interfaces/member.interface";
import { ObjectApiResponse } from "@/interfaces/serviceProviderAuth.interface";
import { requireDatabaseId } from "@/utility/apiValues";
import { deleteData, getData, postData, putData } from "./api";

export const SUPER_ADMIN_ROLE = "SuperAdmin";

// Guide 03: member types and the signed-in member.
export const getUserTypes = (signal?: AbortSignal) =>
  getData<UserTypeListResponse>("/api/members/user-types", { signal });

export const getMyMember = (signal?: AbortSignal) =>
  getData<MemberResponse>("/api/members/me", { signal });

export const selectMyUserType = (body: SelectUserTypeRequest) =>
  putData<SelectUserTypeRequest, MemberResponse>("/api/members/me/user-type", body);

/** Revokes every refresh session; the client must sign out and clear private state. */
export const deactivateMyAccount = () =>
  postData<undefined, ObjectApiResponse>("/api/members/me/deactivate", undefined);

// Admin (guide 19): users. The all-users list is an unpaged array.
export const adminListAllUsers = (signal?: AbortSignal) =>
  getData<UserAdministrationListResponse>("/api/admin/users/all", { signal });

/** Exact-email lookup. */
export const adminFindUserByEmail = (email: string, signal?: AbortSignal) =>
  getData<UserAdministrationResponse>("/api/admin/users", { params: { email }, signal });

export const adminDeactivateUser = (userId: number) =>
  postData<undefined, ObjectApiResponse>(`/api/admin/users/${requireDatabaseId(userId)}/deactivate`, undefined);

export const adminReactivateUser = (userId: number) =>
  postData<undefined, ObjectApiResponse>(`/api/admin/users/${requireDatabaseId(userId)}/reactivate`, undefined);

/** SuperAdmin-only. Issues a new membership ID and revokes the user's sessions. */
export const adminChangeUserType = (userId: number, body: SelectUserTypeRequest) =>
  putData<SelectUserTypeRequest, MemberResponse>(`/api/admin/users/${requireDatabaseId(userId)}/user-type`, body);

// Admin (guide 19): roles and permissions.
export const adminListRoles = (signal?: AbortSignal) =>
  getData<RoleListResponse>("/api/admin/roles", { signal });

/** Permission strings the backend enforces; never invent others. */
export const adminListPermissions = (signal?: AbortSignal) =>
  getData<PermissionListResponse>("/api/admin/roles/permissions", { signal });

export const adminCreateRole = (body: SaveRoleRequest) =>
  postData<SaveRoleRequest, RoleResponse>("/api/admin/roles", body);

export const adminUpdateRole = (roleId: number, body: SaveRoleRequest) =>
  putData<SaveRoleRequest, RoleResponse>(`/api/admin/roles/${requireDatabaseId(roleId)}`, body);

/** A role still assigned to users must be unassigned first. */
export const adminDeleteRole = (roleId: number) =>
  deleteData<ObjectApiResponse>(`/api/admin/roles/${requireDatabaseId(roleId)}`);

export const adminGetUserRoles = (userId: number, signal?: AbortSignal) =>
  getData<RoleListResponse>(`/api/admin/users/${requireDatabaseId(userId)}/roles`, { signal });

/**
 * Replaces all non-SuperAdmin assignments with exactly roleIds. SuperAdmin
 * can't be assigned here and its ID must never be sent; existing SuperAdmin
 * membership is preserved by the server.
 */
export const adminReplaceUserRoles = (userId: number, roleIds: readonly number[], roles: readonly Role[]) => {
  const superAdminIds = new Set(roles.filter((role) => role.name === SUPER_ADMIN_ROLE).map((role) => role.id));
  if (roleIds.some((id) => superAdminIds.has(id))) throw new Error("SuperAdmin can't be assigned from the app.");
  const body: AssignUserRolesRequest = { roleIds: [...new Set(roleIds.map(requireDatabaseId))] };
  return putData<AssignUserRolesRequest, ObjectApiResponse>(`/api/admin/users/${requireDatabaseId(userId)}/roles`, body);
};

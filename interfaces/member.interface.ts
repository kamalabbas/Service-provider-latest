import type { ApiResponse } from "./serviceProviderApi.interface";

/** Guide 03. Current codes: tradeperson, builder, individual, developer, public_government_sector. Always fetch them. */
export interface UserType {
  code: string;
  displayName: string;
}

/** GET /api/members/me: data is null before the first type selection. */
export interface Member {
  /** Human-readable, type-prefixed (T/B/C/D/G); changes on an admin type change. */
  membershipId: string;
  userTypeCode: string;
  userTypeDisplayName: string;
  profileCompletionRequired: boolean;
}

/** First type selection only; this is not a later change-type feature. */
export interface SelectUserTypeRequest {
  userTypeCode: string;
}

/** Admin user row; member is null for accounts that haven't chosen a type yet. */
export interface UserAdministration {
  id: number;
  email: string;
  isDeactivated: boolean;
  member?: Member | null;
}

export interface Role {
  id: number;
  name: string;
  /** SuperAdmin and Member are system roles. */
  isSystemRole: boolean;
  /** Member: assigned to every new account; its permissions are editable, its name is not. */
  isDefaultRole: boolean;
  permissions: string[];
}

export interface SaveRoleRequest {
  /** 1–100 characters; type names, Administrator, Deleted and reserved names are rejected. */
  name: string;
  permissions: string[];
}

/** Replaces all non-SuperAdmin assignments: send the complete desired set. */
export interface AssignUserRolesRequest {
  roleIds: number[];
}

export type MemberResponse = ApiResponse<Member>;
export type UserTypeListResponse = ApiResponse<UserType[]>;
export type UserAdministrationResponse = ApiResponse<UserAdministration>;
export type UserAdministrationListResponse = ApiResponse<UserAdministration[]>;
export type RoleResponse = ApiResponse<Role>;
export type RoleListResponse = ApiResponse<Role[]>;
export type PermissionListResponse = ApiResponse<string[]>;

import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/** Guide 10. A roster record of the provider's business, not a sign-in account. */
export interface Employee {
  id: number;
  businessId: number;
  firstName: string;
  lastName: string;
  phone: string;
  /** Unique (case-insensitive) across active employees of every business. */
  email?: string | null;
  occupationCode: string;
  occupationName: string;
  positionCode?: string | null;
  positionName?: string | null;
  licence?: string | null;
  /** Archived employees can't receive new assignments or cards. */
  archivedAtUtc?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** Full replacement on PUT; email, position and licence are optional on both. */
export interface SaveEmployeeRequest {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  occupationCode: string;
  positionCode?: string | null;
  licence?: string | null;
}

export interface EmployeeListFilters {
  /** true exposes archived history. */
  includeArchived?: boolean;
}

export type EmployeeResponse = ApiResponse<Employee>;
export type EmployeePageResponse = ApiResponse<ApiPage<Employee>>;

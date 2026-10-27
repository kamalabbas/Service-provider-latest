import { EmployeeListFilters, EmployeePageResponse, EmployeeResponse, SaveEmployeeRequest } from "@/interfaces/employee.interface";
import { ObjectApiResponse } from "@/interfaces/serviceProviderAuth.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireDatabaseId } from "@/utility/apiValues";
import { deleteData, getData, postData, putData } from "./api";

/** includeArchived is sent only when true; the server defaults to active employees. */
export const employeeListParams = (filters: EmployeeListFilters = {}, page = 1, pageSize = 20) => ({
  ...(filters.includeArchived ? { includeArchived: true } : {}),
  ...pageParams(page, pageSize),
});

// Guide 10: the provider's roster (current active business).
export const listMyEmployees = (filters: EmployeeListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<EmployeePageResponse>("/api/employees/me", { params: employeeListParams(filters, page, pageSize), signal });

/** Owned active or archived employee. */
export const getMyEmployee = (employeeId: number, signal?: AbortSignal) =>
  getData<EmployeeResponse>(`/api/employees/me/${requireDatabaseId(employeeId)}`, { signal });

export const createMyEmployee = (body: SaveEmployeeRequest) =>
  postData<SaveEmployeeRequest, EmployeeResponse>("/api/employees/me", body);

/** Full replacement; the response holds the server-normalized values. */
export const updateMyEmployee = (employeeId: number, body: SaveEmployeeRequest) =>
  putData<SaveEmployeeRequest, EmployeeResponse>(`/api/employees/me/${requireDatabaseId(employeeId)}`, body);

/** Historical archive, never deletion. Repeating it succeeds. */
export const archiveMyEmployee = (employeeId: number) =>
  deleteData<ObjectApiResponse>(`/api/employees/me/${requireDatabaseId(employeeId)}`);

// Admin (guide 19): SuperAdmin roster routes by target IDs, never the admin's own roster.
export const adminListUserEmployees = (userId: number, filters: EmployeeListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<EmployeePageResponse>(`/api/admin/employees/users/${requireDatabaseId(userId)}`, { params: employeeListParams(filters, page, pageSize), signal });

export const adminGetEmployee = (employeeId: number, signal?: AbortSignal) =>
  getData<EmployeeResponse>(`/api/admin/employees/${requireDatabaseId(employeeId)}`, { signal });

export const adminCreateBusinessEmployee = (businessId: number, body: SaveEmployeeRequest) =>
  postData<SaveEmployeeRequest, EmployeeResponse>(`/api/admin/employees/businesses/${requireDatabaseId(businessId)}`, body);

export const adminUpdateEmployee = (employeeId: number, body: SaveEmployeeRequest) =>
  putData<SaveEmployeeRequest, EmployeeResponse>(`/api/admin/employees/${requireDatabaseId(employeeId)}`, body);

export const adminArchiveEmployee = (employeeId: number) =>
  deleteData<ObjectApiResponse>(`/api/admin/employees/${requireDatabaseId(employeeId)}`);

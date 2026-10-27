import {
  AdminBusinessListResponse,
  AdminBusinessResponse,
  BusinessHistoryResponse,
  BusinessResponse,
  SaveBusinessRequest,
} from "@/interfaces/business.interface";
import { ObjectApiResponse } from "@/interfaces/serviceProviderAuth.interface";
import { requireCoordinates, requireDatabaseId } from "@/utility/apiValues";
import { deleteData, getData, postData, putData } from "./api";
import { PictureUploadFile, pictureForm, uploadApiFile } from "./apiFiles";

const checked = (body: SaveBusinessRequest): SaveBusinessRequest => ({ ...body, ...requireCoordinates(body.latitude, body.longitude) });

// Guide 05: the signed-in member's active business.
export const getMyBusiness = (signal?: AbortSignal) =>
  getData<BusinessResponse>("/api/businesses/me", { signal });

/** Only when no business is active; the server rejects a second one. */
export const createMyBusiness = (body: SaveBusinessRequest) =>
  postData<SaveBusinessRequest, BusinessResponse>("/api/businesses/me", checked(body));

/** Edits the active business; never creates one. */
export const updateMyBusiness = (body: SaveBusinessRequest) =>
  putData<SaveBusinessRequest, BusinessResponse>("/api/businesses/me", checked(body));

/** Archives (never erases). Repeating it is safe. */
export const archiveMyBusiness = () =>
  deleteData<ObjectApiResponse>("/api/businesses/me");

/** JPEG/PNG, 5 MB, 16 million pixels; the server re-encodes it to fit 1600 pixels. */
export const uploadMyBusinessPicture = (file: PictureUploadFile) =>
  uploadApiFile<BusinessResponse>("put", "/api/businesses/me/picture", pictureForm(file));

// Admin (guide 19): SuperAdmin business routes, selected by stable IDs.
export const adminListBusinesses = (filters: { userId?: number } = {}, signal?: AbortSignal) =>
  getData<AdminBusinessListResponse>("/api/admin/businesses", {
    params: { userId: filters.userId === undefined ? undefined : requireDatabaseId(filters.userId) },
    signal,
  });

export const adminGetBusiness = (businessId: number, signal?: AbortSignal) =>
  getData<AdminBusinessResponse>(`/api/admin/businesses/${requireDatabaseId(businessId)}`, { signal });

/** The target needs a member record (first type selection); eligibility rules may be bypassed. */
export const adminCreateBusinessForUser = (userId: number, body: SaveBusinessRequest) =>
  postData<SaveBusinessRequest, AdminBusinessResponse>(`/api/admin/businesses/users/${requireDatabaseId(userId)}`, checked(body));

export const adminUpdateBusiness = (businessId: number, body: SaveBusinessRequest) =>
  putData<SaveBusinessRequest, AdminBusinessResponse>(`/api/admin/businesses/${requireDatabaseId(businessId)}`, checked(body));

export const adminArchiveBusiness = (businessId: number) =>
  deleteData<ObjectApiResponse>(`/api/admin/businesses/${requireDatabaseId(businessId)}`);

export const adminGetBusinessHistory = (businessId: number, signal?: AbortSignal) =>
  getData<BusinessHistoryResponse>(`/api/admin/businesses/${requireDatabaseId(businessId)}/history`, { signal });

export const adminUploadBusinessPicture = (businessId: number, file: PictureUploadFile) =>
  uploadApiFile<AdminBusinessResponse>("put", `/api/admin/businesses/${requireDatabaseId(businessId)}/picture`, pictureForm(file));

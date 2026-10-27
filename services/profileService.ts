import { BusinessAdminEventListResponse, ProfileResponse, SaveProfileRequest } from "@/interfaces/profile.interface";
import { requireDatabaseId } from "@/utility/apiValues";
import { getData, putData } from "./api";
import { PictureUploadFile, pictureForm, uploadApiFile } from "./apiFiles";

// Guide 04: the signed-in member's profile.
export const getMyProfile = (signal?: AbortSignal) =>
  getData<ProfileResponse>("/api/members/me/profile", { signal });

export const saveMyProfile = (body: SaveProfileRequest) =>
  putData<SaveProfileRequest, ProfileResponse>("/api/members/me/profile", body);

/** Needs a saved profile. JPEG/PNG, 5 MB, 16 million pixels; the server re-encodes it. */
export const uploadMyProfilePicture = (file: PictureUploadFile) =>
  uploadApiFile<ProfileResponse>("put", "/api/members/me/profile/picture", pictureForm(file));

// Admin (guide 19): SuperAdmin target-user profiles. Never impersonate the user.
export const adminGetUserProfile = (userId: number, signal?: AbortSignal) =>
  getData<ProfileResponse>(`/api/admin/users/${requireDatabaseId(userId)}/profile`, { signal });

export const adminSaveUserProfile = (userId: number, body: SaveProfileRequest) =>
  putData<SaveProfileRequest, ProfileResponse>(`/api/admin/users/${requireDatabaseId(userId)}/profile`, body);

export const adminGetUserProfileHistory = (userId: number, signal?: AbortSignal) =>
  getData<BusinessAdminEventListResponse>(`/api/admin/users/${requireDatabaseId(userId)}/profile/history`, { signal });

export const adminUploadUserProfilePicture = (userId: number, file: PictureUploadFile) =>
  uploadApiFile<ProfileResponse>("put", `/api/admin/users/${requireDatabaseId(userId)}/profile/picture`, pictureForm(file));

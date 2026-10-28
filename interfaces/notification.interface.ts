import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/** Guide 17. Expo push is for iOS/Android only. */
export type PushPlatform = "ios" | "android";

export interface RegisterPushInstallationRequest {
  /** Stable UUID for this app installation (utility/installationId.ts). */
  installationId: string;
  platform: PushPlatform;
  /** A real ExpoPushToken[...] / ExponentPushToken[...]; never fabricated. */
  expoPushToken: string;
}

/** Token text is never returned. */
export interface PushInstallation {
  installationId: string;
  platform: PushPlatform;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export type IssueReportPlatform = "ios" | "android" | "web";
export type IssueReportStatus = "new" | "investigating" | "resolved" | "dismissed";

/**
 * Anonymous or signed-in diagnostic report; at most 8192 bytes in total.
 * Never include credentials, codes or private content.
 */
export interface CreateIssueReportRequest {
  platform: IssueReportPlatform;
  appVersion: string;
  attemptedAction: string;
  errorMessage: string;
  deviceModel?: string | null;
  context?: string | null;
  /** The failing API's trace ID. */
  clientTraceId?: string | null;
}

export interface IssueReportSubmission {
  id: number;
}

export interface IssueReport extends CreateIssueReportRequest {
  id: number;
  reporterUserId?: number | null;
  status: IssueReportStatus;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface IssueReportEvent {
  id: number;
  reportId: number;
  actorUserId?: number | null;
  action: string;
  previousStatus?: string | null;
  status: string;
  note?: string | null;
  createdAtUtc: string;
}

export interface ChangeIssueReportStatusRequest {
  status: IssueReportStatus;
  /** At most 1000 characters. */
  note?: string | null;
}

export type PushInstallationResponse = ApiResponse<PushInstallation>;
export type PushInstallationListResponse = ApiResponse<PushInstallation[]>;
export type IssueReportSubmissionResponse = ApiResponse<IssueReportSubmission>;
export type IssueReportResponse = ApiResponse<IssueReport>;
export type IssueReportPageResponse = ApiResponse<ApiPage<IssueReport>>;
export type IssueReportEventPageResponse = ApiResponse<ApiPage<IssueReportEvent>>;

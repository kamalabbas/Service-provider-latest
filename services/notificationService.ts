import {
  ChangeIssueReportStatusRequest,
  CreateIssueReportRequest,
  IssueReportEventPageResponse,
  IssueReportPageResponse,
  IssueReportResponse,
  IssueReportStatus,
  IssueReportSubmissionResponse,
  PushInstallationListResponse,
  PushInstallationResponse,
  RegisterPushInstallationRequest,
} from "@/interfaces/notification.interface";
import { ObjectApiResponse } from "@/interfaces/serviceProviderAuth.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireDatabaseId } from "@/utility/apiValues";
import { buildIssueReport, ISSUE_REPORT_MAX_BYTES, utf8Length } from "@/utility/issueReport";
import { deleteData, getData, postData } from "./api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

const requireInstallationId = (installationId: string) => {
  if (!UUID.test(installationId)) throw new Error("A valid installation ID is required.");
  return installationId;
};

// Guide 17: this installation's push destination (setup sessions supported).
/** Updates only this installation; a token owned elsewhere is refused, not transferred. */
export const registerPushInstallation = (body: RegisterPushInstallationRequest) => {
  if (body.platform !== "ios" && body.platform !== "android") throw new Error("Push is only for iOS and Android.");
  if (!EXPO_TOKEN.test(body.expoPushToken) || body.expoPushToken.length > 255) throw new Error("A real Expo push token is required.");
  return postData<RegisterPushInstallationRequest, PushInstallationResponse>("/api/notifications/installations", {
    installationId: requireInstallationId(body.installationId),
    platform: body.platform,
    expoPushToken: body.expoPushToken,
  });
};

export const unregisterPushInstallation = (installationId: string) =>
  deleteData<ObjectApiResponse>(`/api/notifications/installations/${encodeURIComponent(requireInstallationId(installationId))}`);

export const listMyPushInstallations = (signal?: AbortSignal) =>
  getData<PushInstallationListResponse>("/api/notifications/installations/me", { signal });

// Guide 17: diagnostic issue reports (anonymous allowed; 5 per minute per IP).
/** Redacted and fitted to 8192 bytes; the server links a signed-in reporter itself. */
export const submitIssueReport = (input: CreateIssueReportRequest) => {
  const body = buildIssueReport(input);
  if (utf8Length(JSON.stringify(body)) > ISSUE_REPORT_MAX_BYTES) throw new Error("The report is too long. Shorten it and try again.");
  return postData<CreateIssueReportRequest, IssueReportSubmissionResponse>("/api/issue-reports", body);
};

// Admin (guide 19): SuperAdmin investigation. Reports are purged 90 days after creation.
export const adminListIssueReports = (status?: IssueReportStatus, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<IssueReportPageResponse>("/api/admin/issue-reports", { params: { ...(status ? { status } : {}), ...pageParams(page, pageSize) }, signal });

export const adminGetIssueReport = (id: number, signal?: AbortSignal) =>
  getData<IssueReportResponse>(`/api/admin/issue-reports/${requireDatabaseId(id)}`, { signal });

export const adminGetIssueReportHistory = (id: number, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<IssueReportEventPageResponse>(`/api/admin/issue-reports/${requireDatabaseId(id)}/history`, { params: pageParams(page, pageSize), signal });

export const adminChangeIssueReportStatus = (id: number, body: ChangeIssueReportStatusRequest) => {
  const note = body.note?.trim() || null;
  if (note && note.length > 1000) throw new Error("Keep the note to 1000 characters.");
  return postData<ChangeIssueReportStatusRequest, IssueReportResponse>(`/api/admin/issue-reports/${requireDatabaseId(id)}/status`, { status: body.status, note });
};

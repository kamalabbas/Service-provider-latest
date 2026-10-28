import type { CardDeliveryAddress, CardRequest, CardRequestStatus } from "@/interfaces/cardRequest.interface";
import type { User } from "@/interfaces/user.interface";
import { BUSINESS_USER_TYPES, can } from "@/utility/access";
import * as yup from "yup";

/** The API's "accepted" is shown as "Approved". */
export const CARD_REQUEST_STATUS_LABELS: Record<CardRequestStatus, string> = {
  pending: "Pending review",
  accepted: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Personal card: a completed member with card-requests.manage. */
export const canRequestPersonalCard = (user?: User | null) => can(user, ["card-requests.manage"]);

/** Employee card: an eligible provider with both employees.manage and card-requests.manage. */
export const canRequestEmployeeCard = (user: User | null | undefined, userTypeCode?: string | null) =>
  !!userTypeCode && BUSINESS_USER_TYPES.includes(userTypeCode) && can(user, ["employees.manage", "card-requests.manage"]);

export interface CardRequestActions {
  editAddress: boolean;
  cancel: boolean;
}

/** Only the owner, only while pending. Approved requests can't be cancelled. */
export function cardRequestActions(request: Pick<CardRequest, "status" | "ownerUserId">, user: User | null | undefined): CardRequestActions {
  const owner = !!user?.id && String(request.ownerUserId) === user.id;
  const pending = request.status === "pending";
  return {
    editAddress: owner && pending && can(user, ["card-requests.manage"]),
    cancel: owner && pending && can(user, ["card-requests.delete"]),
  };
}

/**
 * A pending request, or an approved one not yet fulfilled, blocks another for the
 * same subject. Advisory only: the server decides, including legacy approvals.
 */
export function hasOpenCardRequest(requests: readonly CardRequest[], subject: { employeeId?: number | null }) {
  return requests.some((request) =>
    (subject.employeeId == null ? request.subjectType === "personal" : request.employeeId === subject.employeeId) &&
    (request.status === "pending" || (request.status === "accepted" && !request.legacyApproval && !request.fulfillmentClosedAtUtc)));
}

export const DELIVERY_FIELDS = ["streetAddress", "suburb", "regionCode", "postalCode"] as const satisfies readonly (keyof CardDeliveryAddress)[];

export const deliveryAddressValues = (address?: CardDeliveryAddress | null): CardDeliveryAddress => ({
  streetAddress: address?.streetAddress ?? "",
  suburb: address?.suburb ?? "",
  regionCode: address?.regionCode ?? "",
  postalCode: address?.postalCode ?? "",
});

const required = (label: string, max: number) => yup.string().trim().required(`Enter ${label}`).max(max, `Use at most ${max} characters`);

export const deliveryAddressSchema: yup.ObjectSchema<CardDeliveryAddress> = yup.object({
  streetAddress: required("the street address", 255),
  suburb: required("the suburb", 100),
  regionCode: yup.string().trim().required("Choose a state or territory"),
  postalCode: required("the postcode", 20),
});

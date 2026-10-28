import type { ClientRelationship } from "@/interfaces/client.interface";
import type { User } from "@/interfaces/user.interface";
import { BUSINESS_USER_TYPES, can } from "@/utility/access";

export interface ClientActions {
  hide: boolean;
  restore: boolean;
}

/**
 * Hide needs clients.delete, restore clients.manage. A former provider whose
 * new type isn't eligible keeps read-only history.
 */
export function clientActions(relationship: Pick<ClientRelationship, "isHidden" | "providerUserId">, user: User | null | undefined, userTypeCode?: string | null): ClientActions {
  const provider = !!user?.id && String(relationship.providerUserId) === user.id;
  const eligible = !!userTypeCode && BUSINESS_USER_TYPES.includes(userTypeCode);
  const editable = provider && eligible;
  return {
    hide: editable && !relationship.isHidden && can(user, ["clients.delete"]),
    restore: editable && !!relationship.isHidden && can(user, ["clients.manage"]),
  };
}

/** Current ID, plus the original one when a type change has replaced it. */
export function clientMembershipText(relationship: Pick<ClientRelationship, "clientMembershipId" | "originalClientMembershipId">): string {
  return relationship.originalClientMembershipId && relationship.originalClientMembershipId !== relationship.clientMembershipId
    ? `Membership ID ${relationship.clientMembershipId} (originally ${relationship.originalClientMembershipId})`
    : `Membership ID ${relationship.clientMembershipId}`;
}

export const inspectionCountText = (relationship: Pick<ClientRelationship, "acceptedInspectionCount" | "completedInspectionCount">) =>
  `${relationship.acceptedInspectionCount} accepted · ${relationship.completedInspectionCount} completed`;

/** Stable list key: one row per business and client. */
export const relationshipKey = (relationship: Pick<ClientRelationship, "businessId" | "clientUserId">) =>
  `${relationship.businessId}:${relationship.clientUserId}`;

import { RecordCard } from "@/components/ui/RecordCard";
import type { Inspection } from "@/interfaces/inspection.interface";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { STATUS_LABELS, STATUS_TONES, inspectionRole } from "@/utility/inspectionRules";
import { useRouter } from "expo-router";

// An inspection in a list: status, the other party, when it was requested and the visit.
export function InspectionCard({ inspection, userId, anchor = false }: { inspection: Inspection; userId?: string | null; anchor?: boolean }) {
  const router = useRouter();
  const role = inspectionRole(inspection, userId ?? undefined);
  const details = [
    { icon: "person-outline" as const, text: role === "provider" ? `For ${inspection.requesterName}` : `With ${inspection.businessName}` },
    { icon: "calendar-outline" as const, text: `Requested ${formatLocalTimestamp(inspection.createdAtUtc)}` },
    ...(inspection.scheduledAtUtc ? [{ icon: "time-outline" as const, text: `Visit ${formatLocalTimestamp(inspection.scheduledAtUtc)}` }] : []),
  ];

  return (
    <RecordCard
      icon={role === "provider" ? "briefcase-outline" : "clipboard-outline"}
      title={inspection.serviceTitle}
      status={{
        label: `${STATUS_LABELS[inspection.status] ?? inspection.status}${inspection.isHidden ? " · hidden" : ""}`,
        tone: STATUS_TONES[inspection.status] ?? "neutral",
      }}
      details={details}
      onPress={() => router.push({ pathname: "/(dashboard)/(inspections)/[id]", params: { id: String(inspection.id) } }, { withAnchor: anchor })}
    />
  );
}

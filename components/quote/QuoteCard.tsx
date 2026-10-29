import { RecordCard } from "@/components/ui/RecordCard";
import type { Quote } from "@/interfaces/quote.interface";
import { formatAud, formatLocalTimestamp } from "@/utility/apiValues";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES, quoteRole } from "@/utility/quoteRules";
import { useRouter } from "expo-router";

// A quote in a list: number, total, status, service, the other party and dates.
export function QuoteCard({ quote, userId, anchor = false }: { quote: Quote; userId?: string | null; anchor?: boolean }) {
  const router = useRouter();
  const role = quoteRole(quote, userId ?? undefined);
  const details = [
    { icon: "construct-outline" as const, text: quote.serviceTitle },
    { icon: "person-outline" as const, text: role === "provider" ? `For ${quote.customerName}` : `From ${quote.businessName}` },
    { icon: "calendar-outline" as const, text: `Sent ${formatLocalTimestamp(quote.createdAtUtc)}` },
    ...(quote.status === "pending" ? [{ icon: "hourglass-outline" as const, text: `Expires ${formatLocalTimestamp(quote.expiresAtUtc)}` }] : []),
  ];

  return (
    <RecordCard
      icon={role === "provider" ? "paper-plane-outline" : "document-text-outline"}
      title={quote.quoteNumber}
      amount={formatAud(quote.totalAmount)}
      status={{ label: QUOTE_STATUS_LABELS[quote.status] ?? quote.status, tone: QUOTE_STATUS_TONES[quote.status] ?? "neutral" }}
      details={details}
      onPress={() => router.push({ pathname: "/(dashboard)/(quotes)/[id]", params: { id: String(quote.id) } }, { withAnchor: anchor })}
    />
  );
}

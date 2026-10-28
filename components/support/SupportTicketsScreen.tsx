import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spacing } from "@/constants/Theme";
import { useMySupportTickets } from "@/hooks/useSupport";
import type { SupportTicketStatus } from "@/interfaces/support.interface";
import { useAuthStore } from "@/stores/authStore";
import { canCreateSupportTickets, canViewSupport } from "@/utility/access";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { SUPPORT_STATUS_LABELS } from "@/utility/supportRules";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import { useSupportRoutes } from "./supportRoutes";

type Filter = "all" | SupportTicketStatus;

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Reply needed", value: "pending" },
  { label: "Closed", value: "closed" },
] as const satisfies readonly { label: string; value: Filter }[];

// Guide 15: the member's support conversations, newest activity first.
export default function SupportTicketsScreen() {
  const router = useRouter();
  const routes = useSupportRoutes();
  const user = useAuthStore((state) => state.user);
  const [filter, setFilter] = useState<Filter>("all");
  const tickets = useMySupportTickets(filter === "all" ? {} : { status: filter });

  useFocusEffect(useCallback(() => {
    tickets.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (!canViewSupport(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view support conversations." /></Screen>;
  }

  const list = tickets.data ?? [];

  return (
    <Screen hasHeader title="Support" subtitle="Ask our team for help. Replies appear here.">
      {canCreateSupportTickets(user) ? (
        <PrimaryButton title="New conversation" leftIcon="add-circle-outline" onPress={() => router.push(routes.create)} style={styles.spaced} />
      ) : null}
      <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} style={styles.spaced} />

      {tickets.isLoading ? (
        <Loader visible overlay={false} message="Loading conversations…" />
      ) : list.length === 0 ? (
        <Notice message={filter === "all" ? "No conversations yet." : "No conversations with this status."} />
      ) : (
        <>
          <ListSection>
            {list.map((ticket) => (
              <ListRow
                key={ticket.id}
                icon={ticket.status === "closed" ? "chatbubbles-outline" : ticket.status === "pending" ? "alert-circle-outline" : "chatbubble-ellipses-outline"}
                title={ticket.title}
                subtitle={`${SUPPORT_STATUS_LABELS[ticket.status] ?? ticket.status} · ${formatLocalTimestamp(ticket.lastMessageAtUtc)}`}
                onPress={() => router.push({ pathname: routes.ticket, params: { id: String(ticket.id) } })}
              />
            ))}
          </ListSection>
          {tickets.hasNextPage ? (
            <PrimaryButton
              title={tickets.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => tickets.fetchNextPage()}
              loading={tickets.isFetchingNextPage}
              disabled={tickets.isFetchingNextPage}
            />
          ) : (
            <ThemedText type="footnote" tone="muted" style={styles.end}>End of list.</ThemedText>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  spaced: { marginBottom: Spacing.lg },
  end: { textAlign: "center" },
});

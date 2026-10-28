import { PriceInputModal } from "@/components/price/PriceInputModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess } from "@/hooks/useBusiness";
import { usePriceCatalogueItem } from "@/hooks/usePriceCatalogue";
import { useMyProviderPrices, useProviderPrice, useProviderPriceActions, useProviderPriceHistory } from "@/hooks/useProviderPrices";
import { useToastStore } from "@/stores/toastStore";
import { formatAud, formatLocalTimestamp } from "@/utility/apiValues";
import { currentUtcYear, providerPriceActions } from "@/utility/providerPriceRules";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

const ACTION_LABELS: Record<string, string> = { created: "Submitted", updated: "Changed", withdrawn: "Withdrawn", restored: "Restored" };

// Guide 14: one yearly price with edit, withdraw, restore and history.
export default function PriceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const priceId = Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const showToast = useToastStore((state) => state.showToast);
  const { user, userTypeCode } = useBusinessAccess();
  const { data: row, isLoading } = useProviderPrice(priceId);
  // Other years of the same item tell whether an older row is still the latest.
  const siblings = useMyProviderPrices(row ? { itemId: row.itemId, businessId: row.businessId } : {});
  const item = usePriceCatalogueItem(row && row.itemStatus === "published" ? row.itemId : null);
  const history = useProviderPriceHistory(priceId);
  const actions = useProviderPriceActions();
  const [editing, setEditing] = useState<"edit" | "restore" | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the price…" /></Screen>;
  if (!row) return <Screen hasHeader><Notice tone="warning" message="This price is unavailable." /></Screen>;

  const allowed = providerPriceActions(row, siblings.data ?? [row], user, userTypeCode);
  const current = row.calendarYear === currentUtcYear();

  return (
    <Screen hasHeader title={row.itemName} subtitle={`${row.calendarYear} · ${row.businessName}`}>
      {row.withdrawnAtUtc ? (
        <Notice message={`Withdrawn ${formatLocalTimestamp(row.withdrawnAtUtc)}. It no longer counts towards the average, and older years don't count instead.`} style={styles.notice} />
      ) : !current ? (
        <Notice message="Prices from earlier years can't be changed. This one still counts towards the average while it's your latest." style={styles.notice} />
      ) : null}
      {row.businessArchivedAtUtc ? <Notice tone="warning" message="This business is archived. This price is history only." style={styles.notice} /> : null}

      <ListSection title="Price">
        <ListRow icon="pricetag-outline" title={formatAud(row.price)} subtitle={`${row.itemCode} · ${row.calendarYear}`} />
        {row.itemStatus === "retired" ? <ListRow icon="alert-circle-outline" title="Item retired" subtitle="It can only be withdrawn." /> : null}
        <ListRow icon="time-outline" title="Updated" subtitle={formatLocalTimestamp(row.updatedAtUtc)} />
      </ListSection>

      {(history.data ?? []).length ? (
        <ListSection title="History">
          {(history.data ?? []).map((event) => {
            const price = typeof event.after.price === "number" ? ` · ${formatAud(event.after.price)}` : "";
            return <ListRow key={event.id} icon="time-outline" title={`${ACTION_LABELS[event.action] ?? event.action}${price}`} subtitle={formatLocalTimestamp(event.createdAtUtc)} />;
          })}
        </ListSection>
      ) : null}
      {history.hasNextPage ? <PrimaryButton title="Show more history" variant="ghost" onPress={() => history.fetchNextPage()} style={styles.notice} /> : null}

      <View style={styles.actions}>
        {allowed.edit ? <PrimaryButton title="Change price" variant="secondary" leftIcon="create-outline" onPress={() => setEditing("edit")} /> : null}
        {allowed.restore ? <PrimaryButton title="Restore with a new price" leftIcon="refresh-outline" onPress={() => setEditing("restore")} /> : null}
        {allowed.withdraw ? <PrimaryButton title="Withdraw price" variant="danger" leftIcon="remove-circle-outline" onPress={() => setConfirmWithdraw(true)} /> : null}
      </View>

      <PriceInputModal
        visible={editing !== null}
        title={editing === "restore" ? "Restore this price" : "Change this price"}
        confirmLabel={editing === "restore" ? "Restore" : "Save"}
        item={item.data ?? null}
        initialPrice={editing === "edit" ? row.price : null}
        isLoading={actions.update.isPending || actions.restore.isPending}
        onCancel={() => setEditing(null)}
        onConfirm={(price) => {
          const mutation = editing === "restore" ? actions.restore : actions.update;
          mutation.mutate({ id: row.id, price }, {
            onSuccess: () => { setEditing(null); showToast(editing === "restore" ? "Price restored." : "Price updated.", "success"); },
          });
        }}
      />

      <ConfirmModal
        visible={confirmWithdraw}
        icon="remove-circle-outline"
        tone="danger"
        title="Withdraw this price?"
        message="It stays in your history but stops counting towards the average. An older year won't count in its place."
        confirmLabel="Withdraw"
        isLoading={actions.withdraw.isPending}
        onCancel={() => setConfirmWithdraw(false)}
        onConfirm={() => actions.withdraw.mutate(row.id, {
          onSuccess: () => showToast("Price withdrawn.", "success"),
          onSettled: () => setConfirmWithdraw(false),
        })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.lg },
  actions: { gap: Spacing.md, marginBottom: Spacing.lg },
});

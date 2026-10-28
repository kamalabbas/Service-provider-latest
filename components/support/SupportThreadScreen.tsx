import { FormInput } from "@/components/form/FormInput";
import { ThemedText } from "@/components/ThemedText";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Layout, Spacing } from "@/constants/Theme";
import { useSupportMessages, useSupportTicket, useSupportThreadActions } from "@/hooks/useSupport";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { SupportMode } from "@/interfaces/support.interface";
import { SUPPORT_MESSAGE_MAX } from "@/services/supportService";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { ADMIN_SUPPORT_STATUS_LABELS, SUPPORT_STATUS_LABELS, supportSenderLabel, supportTicketActions } from "@/utility/supportRules";
import { useHeaderHeight } from "@react-navigation/elements";
import { isAxiosError } from "axios";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageBubble } from "./MessageBubble";

const STATUS_NOTES: Record<SupportMode, Record<string, string>> = {
  member: {
    open: "Our team will reply here.",
    pending: "Support replied. Send a message to continue.",
    closed: "This conversation is closed. Reopen it to send another message.",
  },
  admin: {
    open: "The member is waiting for a reply.",
    pending: "Waiting for the member to reply.",
    closed: "This conversation is closed. Reopen it to reply.",
  },
};

// Guide 15: one conversation. The same screen serves members and, in admin mode,
// SuperAdmins (guide 19), calling each side's routes explicitly.
export default function SupportThreadScreen({ mode = "member" }: { mode?: SupportMode }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const ticket = useSupportTicket(ticketId, mode);
  const messages = useSupportMessages(ticketId, mode);
  const { send, close, reopen } = useSupportThreadActions(ticketId ?? 0, mode);
  const [draft, setDraft] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const background = useThemeColor({}, "muted");
  const border = useThemeColor({}, "separatorColor");
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  // Another participant may have replied or changed the status meanwhile.
  useFocusEffect(useCallback(() => {
    ticket.refetch();
    messages.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (ticket.isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the conversation…" /></Screen>;
  if (!ticket.data || ticketId === null) return <Screen hasHeader><Notice tone="warning" message="This conversation is unavailable." /></Screen>;

  const current = ticket.data;
  const actions = supportTicketActions(current, user, mode);
  const labels = mode === "admin" ? ADMIN_SUPPORT_STATUS_LABELS : SUPPORT_STATUS_LABELS;
  const onError = (error: Error) => { if (!isAxiosError(error)) showToast(error.message, "error"); };

  const sendDraft = () => {
    if (send.isPending || !draft.trim()) return;
    send.mutate(draft, { onSuccess: () => setDraft(""), onError });
  };

  const closeTicket = () => close.mutate(undefined, {
    onSuccess: () => { setConfirmClose(false); showToast("Conversation closed.", "success"); },
    onError: (error) => { setConfirmClose(false); onError(error); },
  });

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <View style={[styles.header, { borderColor: border }]}>
        <ThemedText type="headline">{current.title}</ThemedText>
        <ThemedText type="caption" tone="muted">
          {mode === "admin" ? `${current.ownerEmail} · ` : ""}{labels[current.status] ?? current.status}
        </ThemedText>
        <ThemedText type="caption" tone="muted">{STATUS_NOTES[mode][current.status] ?? ""}</ThemedText>
        {actions.close ? (
          <PrimaryButton title="Close conversation" variant="ghost" size="md" leftIcon="checkmark-done-outline" onPress={() => setConfirmClose(true)} />
        ) : null}
      </View>

      {/* Inverted: newest at the bottom, and loading older pages keeps the scroll position. */}
      <FlatList
        inverted
        style={styles.fill}
        contentContainerStyle={styles.messages}
        data={messages.data ?? []}
        keyExtractor={(message) => String(message.id)}
        renderItem={({ item }) => (
          <MessageBubble
            body={item.body}
            createdAtUtc={item.createdAtUtc}
            sender={supportSenderLabel(item, current, user)}
            mine={!!user?.id && String(item.senderUserId) === user.id}
          />
        )}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          messages.isLoading ? (
            <Loader visible overlay={false} message="Loading messages…" />
          ) : messages.hasNextPage ? (
            <PrimaryButton
              title={messages.isFetchingNextPage ? "Loading..." : "Show older messages"}
              variant="ghost"
              size="md"
              onPress={() => messages.fetchNextPage()}
              loading={messages.isFetchingNextPage}
              disabled={messages.isFetchingNextPage}
            />
          ) : (
            <ThemedText type="footnote" tone="muted" style={styles.start}>Start of conversation</ThemedText>
          )
        }
      />

      <View style={[styles.footer, { borderColor: border, paddingBottom: insets.bottom + Spacing.md }]}>
        {actions.reopen ? (
          <PrimaryButton
            title={reopen.isPending ? "Reopening..." : "Reopen conversation"}
            leftIcon="refresh-outline"
            onPress={() => reopen.mutate(undefined, { onSuccess: () => showToast("Conversation reopened.", "success"), onError })}
            loading={reopen.isPending}
            disabled={reopen.isPending}
          />
        ) : actions.reply ? (
          <View style={styles.composer}>
            <View style={styles.fill}>
              <FormInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message"
                multiline
                maxLength={SUPPORT_MESSAGE_MAX}
                accessibilityLabel="Message"
              />
            </View>
            <PrimaryButton
              title="Send"
              size="md"
              leftIcon="send-outline"
              onPress={sendDraft}
              loading={send.isPending}
              disabled={send.isPending || !draft.trim()}
            />
          </View>
        ) : current.status === "closed" ? (
          <ThemedText type="caption" tone="muted">This conversation is closed.</ThemedText>
        ) : null}
      </View>

      <ConfirmModal
        visible={confirmClose}
        icon="checkmark-done-outline"
        title="Close this conversation?"
        message="You can reopen it later to send another message."
        confirmLabel="Close"
        isLoading={close.isPending}
        onConfirm={closeTicket}
        onCancel={() => setConfirmClose(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    gap: Spacing.xs,
    paddingHorizontal: Layout.screenPadding - Spacing.xs,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  messages: { paddingHorizontal: Layout.screenPadding - Spacing.xs, paddingVertical: Spacing.md },
  start: { textAlign: "center", marginVertical: Spacing.md },
  footer: {
    paddingHorizontal: Layout.screenPadding - Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.sm },
});

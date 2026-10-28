import { ThemedText } from "@/components/ThemedText";
import { Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { StyleSheet, View } from "react-native";

type MessageBubbleProps = {
  body: string;
  sender: string;
  createdAtUtc: string;
  /** The viewer's own messages sit on the right. */
  mine: boolean;
};

// One immutable plain-text support message.
export function MessageBubble({ body, sender, createdAtUtc, mine }: MessageBubbleProps) {
  const own = useThemeColor({}, "primaryLight");
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "separatorColor");

  return (
    <View style={[styles.wrap, mine ? styles.mine : styles.theirs]}>
      <View style={[styles.bubble, { backgroundColor: mine ? own : surface, borderColor: border }]}>
        <ThemedText selectable>{body}</ThemedText>
      </View>
      <ThemedText type="footnote" tone="muted" style={mine ? styles.metaMine : undefined}>
        {`${sender} · ${formatLocalTimestamp(createdAtUtc)}`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: "85%", gap: Spacing.xxs, marginVertical: Spacing.xs },
  mine: { alignSelf: "flex-end" },
  theirs: { alignSelf: "flex-start" },
  bubble: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  metaMine: { textAlign: "right" },
});

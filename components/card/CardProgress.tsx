import { ThemedText } from "@/components/ThemedText";
import { Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { formatLocalTimestamp } from "@/utility/apiValues";
import type { cardSteps } from "@/utility/cardRules";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

type Steps = ReturnType<typeof cardSteps>;

// A vertical tracker: made → sent → received → ready to use, with the date of each step.
export function CardProgress({ steps }: { steps: Steps }) {
  const done = useThemeColor({}, "success");
  const pending = useThemeColor({}, "borderColor");
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "separatorColor");
  const current = steps.findIndex((step) => !step.done);

  return (
    <View style={[styles.box, { backgroundColor: surface, borderColor: border }]}>
      {steps.map((step, index) => {
        const isCurrent = index === current;
        const color = step.done ? done : pending;
        return (
          <View key={step.step} style={styles.row}>
            <View style={styles.rail}>
              <Ionicons name={step.done ? "checkmark-circle" : isCurrent ? "ellipse" : "ellipse-outline"} size={22} color={step.done || isCurrent ? done : pending} />
              {index < steps.length - 1 ? <View style={[styles.line, { backgroundColor: step.done ? color : pending }]} /> : null}
            </View>
            <View style={styles.text}>
              <ThemedText type={isCurrent ? "label" : "default"} tone={step.done || isCurrent ? "default" : "muted"}>
                {step.label}
              </ThemedText>
              {step.at ? (
                <ThemedText type="footnote" tone="muted">{formatLocalTimestamp(step.at)}</ThemedText>
              ) : isCurrent ? (
                <ThemedText type="footnote" tone="tint">Next step</ThemedText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, marginBottom: Spacing.xl },
  row: { flexDirection: "row", gap: Spacing.md, minHeight: 48 },
  rail: { alignItems: "center", width: 22 },
  line: { flex: 1, width: 2, marginVertical: Spacing.xxs },
  text: { flex: 1, gap: Spacing.xxs, paddingBottom: Spacing.md },
});

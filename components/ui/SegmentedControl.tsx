import { Radius, Spacing, Typography } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

type Option<T extends string> = { label: string; value: T };

type SegmentedControlProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl<T extends string>({ options, value, onChange, style }: SegmentedControlProps<T>) {
  const track = useThemeColor({}, "muted");
  const border = useThemeColor({}, "separatorColor");
  const selectedBackground = useThemeColor({}, "surface");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");

  return (
    <View style={[styles.track, { backgroundColor: track, borderColor: border }, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && [styles.selected, { backgroundColor: selectedBackground }]]}
          >
            <Text style={[styles.label, { color: selected ? text : muted }, selected && styles.labelSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
  },
  selected: {
    shadowColor: "#0D1A14",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: { ...Typography.label, fontWeight: "500" },
  labelSelected: { fontWeight: "600" },
});

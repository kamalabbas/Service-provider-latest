import { ThemedText } from "@/components/ThemedText";
import { BrandMark } from "@/components/ui/Logo";
import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Card } from "@/interfaces/card.interface";
import { cardValidityText, isCardUsable } from "@/utility/cardRules";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

const date = (value: string) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

// Guide 11-b: a card drawn from data. The API has no card image, PDF or public QR link.
// Height follows the content (no fixed aspect ratio), so nothing overflows on small screens.
export function CardFace({ card, now: nowProp }: { card: Card; now?: number }) {
  // Validity is judged at mount time unless a time is given (render stays pure).
  const [mountedAt] = useState(() => Date.now());
  const now = nowProp ?? mountedAt;
  const primary = useThemeColor({}, "primary");
  const onPrimary = useThemeColor({}, "buttonText");
  const usable = isCardUsable(card, now);
  const text = { color: onPrimary };
  const identity = [card.membershipId ?? card.providerMembershipId, card.employeeOccupationName, card.businessName].filter(Boolean).join(" · ");

  return (
    <View
      style={[styles.card, Shadow.card, { backgroundColor: primary }]}
      accessible
      accessibilityLabel={`Membership card ${card.cardNumber} for ${card.subjectName}. ${cardValidityText(card, now)}. Expires ${date(card.expiresAtUtc)}.`}
    >
      <View style={styles.top}>
        <BrandMark size={36} />
        <View style={[styles.chip, { backgroundColor: onPrimary }]}>
          <Ionicons name={usable ? "checkmark-circle" : "time-outline"} size={14} color={primary} />
          <ThemedText type="footnote" style={[styles.chipText, { color: primary }]} numberOfLines={1}>{cardValidityText(card, now)}</ThemedText>
        </View>
      </View>

      <View style={styles.middle}>
        <ThemedText type="headline" style={text} numberOfLines={2}>{card.subjectName}</ThemedText>
        {identity ? <ThemedText type="caption" style={[text, styles.dim]} numberOfLines={2}>{identity}</ThemedText> : null}
      </View>

      <ThemedText type="subtitle" style={[text, styles.number]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{card.cardNumber}</ThemedText>

      <View style={styles.dates}>
        <View style={styles.dateBlock}>
          <ThemedText type="footnote" style={[text, styles.dim]}>ISSUED</ThemedText>
          <ThemedText type="caption" style={text} numberOfLines={1}>{date(card.issuedAtUtc)}</ThemedText>
        </View>
        <View style={styles.dateBlock}>
          <ThemedText type="footnote" style={[text, styles.dim]}>EXPIRES</ThemedText>
          <ThemedText type="caption" style={text} numberOfLines={1}>{date(card.expiresAtUtc)}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md, marginBottom: Spacing.xl },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: Spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexShrink: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  chipText: { fontWeight: "700", flexShrink: 1 },
  middle: { gap: Spacing.xxs, marginTop: Spacing.sm },
  dim: { opacity: 0.8 },
  number: { letterSpacing: 2 },
  dates: { flexDirection: "row", flexWrap: "wrap", columnGap: Spacing.xxl, rowGap: Spacing.sm },
  dateBlock: { gap: Spacing.xxs },
});

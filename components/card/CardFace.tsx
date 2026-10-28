import { ThemedText } from "@/components/ThemedText";
import { BrandMark } from "@/components/ui/Logo";
import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Card } from "@/interfaces/card.interface";
import { cardValidityText, isCardUsable } from "@/utility/cardRules";
import { StyleSheet, View } from "react-native";

const date = (value: string) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

// Guide 11-b: a card drawn from data. The API has no card image, PDF or public QR link.
export function CardFace({ card, now = Date.now() }: { card: Card; now?: number }) {
  const primary = useThemeColor({}, "primary");
  const onPrimary = useThemeColor({}, "buttonText");
  const usable = isCardUsable(card, now);
  const text = { color: onPrimary };

  return (
    <View
      style={[styles.card, Shadow.card, { backgroundColor: primary, opacity: usable ? 1 : 0.75 }]}
      accessible
      accessibilityLabel={`Membership card ${card.cardNumber} for ${card.subjectName}. ${cardValidityText(card, now)}. Expires ${date(card.expiresAtUtc)}.`}
    >
      <View style={styles.top}>
        <BrandMark size={36} />
        <View style={[styles.badge, { borderColor: onPrimary }]}>
          <ThemedText type="caption" style={text}>{cardValidityText(card, now)}</ThemedText>
        </View>
      </View>

      <ThemedText type="headline" style={[text, styles.name]} numberOfLines={1}>{card.subjectName}</ThemedText>
      <ThemedText type="caption" style={[text, styles.dim]} numberOfLines={1}>
        {[card.membershipId ?? card.providerMembershipId, card.employeeOccupationName, card.businessName].filter(Boolean).join(" · ")}
      </ThemedText>

      <ThemedText type="subtitle" style={[text, styles.number]}>{card.cardNumber}</ThemedText>

      <View style={styles.dates}>
        <View>
          <ThemedText type="footnote" style={[text, styles.dim]}>ISSUED</ThemedText>
          <ThemedText type="caption" style={text}>{date(card.issuedAtUtc)}</ThemedText>
        </View>
        <View>
          <ThemedText type="footnote" style={[text, styles.dim]}>EXPIRES</ThemedText>
          <ThemedText type="caption" style={text}>{date(card.expiresAtUtc)}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.xs, marginBottom: Spacing.xl, aspectRatio: 1.586 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  badge: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xxs },
  name: { marginTop: "auto" },
  dim: { opacity: 0.8 },
  number: { letterSpacing: 2, marginTop: Spacing.sm },
  dates: { flexDirection: "row", gap: Spacing.xxl, marginTop: Spacing.sm },
});

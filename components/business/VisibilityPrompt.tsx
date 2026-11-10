import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Radius, Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { usePaymentAccount } from "@/hooks/usePayments";
import { useMyServices } from "@/hooks/useServices";
import { useThemeColor } from "@/hooks/useThemeColor";
import { canManageOwnBusiness, canManageOwnServices, canViewPayments } from "@/utility/access";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

// Providers only appear in search once they have a business, at least one active
// service listing and the Provider plan. Shown on Home, My business and My services until done.
export function VisibilityPrompt({ hideWhenOnServices = false }: { hideWhenOnServices?: boolean }) {
  const router = useRouter();
  const { user, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const services = useMyServices(!!business.data);
  const account = usePaymentAccount();
  const warningSurface = useThemeColor({}, "warningSurface");
  const warning = useThemeColor({}, "warning");

  if (!canManageOwnServices(user, userTypeCode) || business.isLoading || services.isLoading || account.isLoading) return null;

  const hasBusiness = !!business.data;
  const activeServices = (services.data ?? []).filter((service) => !service.archivedAtUtc).length;
  // Guide 21: listings are discoverable only with the Provider plan's verified benefit.
  const subscribed = account.data?.hasProviderVisibility === true || !canViewPayments(user);
  if (hasBusiness && activeServices > 0 && subscribed) return null;
  // On My services the "Add a service" button is right there; only the other steps matter.
  if (hideWhenOnServices && hasBusiness && activeServices === 0) return null;
  if (!hasBusiness && !canManageOwnBusiness(user, userTypeCode)) return null;

  const step = hasBusiness && activeServices > 0
    ? {
        title: "Subscribe to appear in search",
        text: "Your services are ready, but customers only see providers on the Provider plan. Subscribe to start getting inspection requests.",
        action: "See plans",
        go: () => router.push("/(dashboard)/(menu)/billing", { withAnchor: true }),
      }
    : hasBusiness
    ? {
        title: "Customers can't find you yet",
        text: "Add at least one service so your business appears in search. Without a service, no one can request an inspection from you.",
        action: "Add a service",
        go: () => router.push("/(dashboard)/(menu)/my-service-edit", { withAnchor: true }),
      }
    : {
        title: "Set up your business to get found",
        text: "Step 1: add your business. Step 2: add a service. Customers only see providers with at least one service.",
        action: "Add your business",
        go: () => router.push("/(dashboard)/(menu)/business-edit", { withAnchor: true }),
      };

  return (
    <View style={[styles.box, { backgroundColor: warningSurface, borderColor: warning }]} accessibilityRole="alert">
      <View style={styles.heading}>
        <Ionicons name="eye-off-outline" size={22} color={warning} />
        <ThemedText type="headline" style={styles.title}>{step.title}</ThemedText>
      </View>
      <ThemedText type="callout">{step.text}</ThemedText>
      <PrimaryButton title={step.action} leftIcon="add-circle-outline" onPress={step.go} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.xl },
  heading: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  title: { flex: 1 },
});

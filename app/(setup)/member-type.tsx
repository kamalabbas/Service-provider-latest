import { ThemedText } from "@/components/ThemedText";
import { Loader } from "@/components/ui/loader";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useMyMember, useSelectUserType, useUserTypes } from "@/hooks/useMembership";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useToastStore } from "@/stores/toastStore";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { ComponentProps, useState } from "react";
import { StyleSheet } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Decoration only: the list of types always comes from the API.
const TYPE_ICONS: Record<string, IconName> = {
  tradeperson: "hammer-outline",
  builder: "business-outline",
  individual: "person-outline",
  developer: "construct-outline",
  public_government_sector: "library-outline",
};

// Guide 03: first member-type selection. Changing it later is an admin action.
export default function MemberTypeScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const tint = useThemeColor({}, "tint");
  const muted = useThemeColor({}, "textMuted");
  const { data: types = [], isLoading: typesLoading, refetch } = useUserTypes();
  const { data: member, isLoading: memberLoading } = useMyMember();
  const selectType = useSelectUserType();
  const [selected, setSelected] = useState<string | null>(null);

  const confirm = () => {
    if (!selected || selectType.isPending) return;
    selectType.mutate({ userTypeCode: selected }, {
      onSuccess: (response) => {
        if (response.data) {
          showToast(`You're registered as ${response.data.userTypeDisplayName}. Membership ID ${response.data.membershipId}.`, "success");
        }
        router.back();
      },
    });
  };

  if (typesLoading || memberLoading) {
    return <Screen hasHeader><Loader visible overlay={false} message="Loading member types…" /></Screen>;
  }

  return (
    <Screen hasHeader title="Choose your member type" subtitle="This decides which features and profile details apply to you.">
      {member ? (
        <Notice
          message={`Your member type is ${member.userTypeDisplayName} (${member.membershipId}). Only an administrator can change it.`}
          style={styles.notice}
        />
      ) : (
        <Notice message="You choose this once. Changing it later needs an administrator." style={styles.notice} />
      )}

      {types.length === 0 ? (
        <>
          <Notice tone="warning" message="Member types couldn't be loaded." style={styles.notice} />
          <PrimaryButton title="Try again" variant="secondary" leftIcon="refresh-outline" onPress={() => refetch()} />
        </>
      ) : (
        <ListSection>
          {types.map((type) => {
            const isSelected = (selected ?? member?.userTypeCode) === type.code;
            return (
              <ListRow
                key={type.code}
                icon={TYPE_ICONS[type.code] ?? "ribbon-outline"}
                title={type.displayName}
                onPress={member ? undefined : () => setSelected(type.code)}
                trailing={<Ionicons name={isSelected ? "radio-button-on" : "radio-button-off"} size={22} color={isSelected ? tint : muted} />}
              />
            );
          })}
        </ListSection>
      )}

      {member ? null : (
        <>
          <PrimaryButton
            title={selectType.isPending ? "Saving..." : "Continue"}
            onPress={confirm}
            disabled={!selected}
            loading={selectType.isPending}
          />
          <ThemedText type="footnote" tone="muted" style={styles.footnote}>
            Your membership ID is issued when you continue.
          </ThemedText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.xl },
  footnote: { textAlign: "center", marginTop: Spacing.md },
});

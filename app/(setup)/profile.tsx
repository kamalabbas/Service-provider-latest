import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfilePicture } from "@/components/profile/ProfilePicture";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useMyMember } from "@/hooks/useMembership";
import { useMyProfile } from "@/hooks/useProfile";
import { refreshAccessToken } from "@/services/authSession";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { canEditOwnProfile, canViewOwnProfile } from "@/utility/access";
import { useState } from "react";
import { StyleSheet } from "react-native";

// Guide 04 onboarding: save the first profile, then a refreshed full-access
// session replaces the setup token and the app opens the member screens.
export default function SetupProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const { data: member, isLoading: memberLoading } = useMyMember();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const [stillInSetup, setStillInSetup] = useState(false);
  const [checking, setChecking] = useState(false);

  // The root navigator switches to the member screens once the flag clears.
  const verifySession = () => {
    if (useAuthStore.getState().user?.profileCompletionRequired) setStillInSetup(true);
    else showToast("Your profile is saved and your account is ready.", "success");
  };

  const checkAgain = async () => {
    setChecking(true);
    try {
      await refreshAccessToken();
      verifySession();
    } finally {
      setChecking(false);
    }
  };

  if (!canViewOwnProfile(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view your profile." /></Screen>;
  }
  if (memberLoading || profileLoading) {
    return <Screen hasHeader><Loader visible overlay={false} message="Loading your profile…" /></Screen>;
  }
  if (!member) {
    return <Screen hasHeader><Notice tone="warning" message="Choose your member type first." /></Screen>;
  }

  return (
    <Screen hasHeader title="Complete your profile" subtitle={`${member.userTypeDisplayName} · Membership ID ${member.membershipId}`}>
      {stillInSetup ? (
        <>
          <Notice tone="warning" message="Your profile is saved, but your account isn't ready yet. Check again in a moment." style={styles.notice} />
          <PrimaryButton title="Check again" variant="secondary" leftIcon="refresh-outline" onPress={checkAgain} loading={checking} disabled={checking} style={styles.check} />
        </>
      ) : null}
      <ProfilePicture pictureUrl={profile?.pictureUrl} canUpload={Boolean(profile) && canEditOwnProfile(user)} />
      <ProfileForm
        key={profile ? "saved" : "new"}
        profile={profile ?? null}
        userTypeCode={member.userTypeCode}
        submitLabel="Save and continue"
        onSaved={verifySession}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.md },
  check: { marginBottom: Spacing.xl },
});

import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfilePicture } from "@/components/profile/ProfilePicture";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { useMyMember } from "@/hooks/useMembership";
import { useMyProfile } from "@/hooks/useProfile";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { canEditOwnProfile, canViewOwnProfile } from "@/utility/access";

// Guide 04: the same profile form as onboarding, for later edits.
export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const { data: member, isLoading: memberLoading } = useMyMember();
  const { data: profile, isLoading: profileLoading } = useMyProfile();

  if (!canViewOwnProfile(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view your profile." /></Screen>;
  }
  if (memberLoading || profileLoading) {
    return <Screen hasHeader><Loader visible overlay={false} message="Loading your profile…" /></Screen>;
  }
  if (!member) {
    return <Screen hasHeader><Notice tone="warning" message="Your membership couldn't be loaded. Go back and try again." /></Screen>;
  }

  return (
    <Screen hasHeader>
      <ProfilePicture pictureUrl={profile?.pictureUrl} canUpload={Boolean(profile) && canEditOwnProfile(user)} />
      <ProfileForm
        // Remount with the saved record after a refetch.
        key={profile ? "saved" : "new"}
        profile={profile ?? null}
        userTypeCode={member.userTypeCode}
        submitLabel="Save changes"
        onSaved={() => showToast("Your profile has been saved.", "success")}
      />
    </Screen>
  );
}

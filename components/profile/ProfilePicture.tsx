import { ThemedText } from "@/components/ThemedText";
import { PicturePicker } from "@/components/ui/PicturePicker";
import { useUploadMyProfilePicture } from "@/hooks/useProfile";
import { usePendingProfilePictureStore } from "@/stores/pendingProfilePictureStore";

type ProfilePictureProps = {
  pictureUrl?: string | null;
  /** Upload needs a saved profile; before that the picture is kept locally. */
  canUpload: boolean;
  /** May pick a picture now and save it with the profile (onboarding). */
  canPickLater?: boolean;
};

// Guide 04: the server re-encodes the picture to a JPEG of at most 512 pixels per side.
export function ProfilePicture({ pictureUrl, canUpload, canPickLater = false }: ProfilePictureProps) {
  const upload = useUploadMyProfilePicture();
  const pending = usePendingProfilePictureStore((state) => state.file);
  const setPending = usePendingProfilePictureStore((state) => state.set);
  const deferred = !canUpload && canPickLater;
  return (
    <>
      <PicturePicker
        pictureUrl={pictureUrl}
        canUpload={canUpload}
        uploadHint="You can add a photo after saving your profile."
        uploading={upload.isPending}
        onUpload={upload.mutateAsync}
        successMessage="Profile picture updated."
        onPickLater={deferred ? setPending : undefined}
        previewUri={deferred ? pending?.uri : null}
      />
      {deferred && pending ? (
        <ThemedText type="footnote" tone="muted" style={{ textAlign: "center" }}>
          Your photo is saved with your profile.
        </ThemedText>
      ) : null}
    </>
  );
}

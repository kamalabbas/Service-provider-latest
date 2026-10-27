import { PicturePicker } from "@/components/ui/PicturePicker";
import { useUploadMyProfilePicture } from "@/hooks/useProfile";

type ProfilePictureProps = {
  pictureUrl?: string | null;
  /** Upload needs a saved profile. */
  canUpload: boolean;
};

// Guide 04: the server re-encodes the picture to a JPEG of at most 512 pixels per side.
export function ProfilePicture({ pictureUrl, canUpload }: ProfilePictureProps) {
  const upload = useUploadMyProfilePicture();
  return (
    <PicturePicker
      pictureUrl={pictureUrl}
      canUpload={canUpload}
      uploadHint="You can add a photo after saving your profile."
      uploading={upload.isPending}
      onUpload={upload.mutateAsync}
      successMessage="Profile picture updated."
    />
  );
}

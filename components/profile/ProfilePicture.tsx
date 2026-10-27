import { ThemedText } from "@/components/ThemedText";
import { ImageComponent } from "@/components/ui/imageComponent";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Spacing } from "@/constants/Theme";
import { useUploadMyProfilePicture } from "@/hooks/useProfile";
import { PictureUploadFile } from "@/services/apiFiles";
import { useToastStore } from "@/stores/toastStore";
import { isAxiosError } from "axios";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { StyleSheet, View } from "react-native";

type ProfilePictureProps = {
  pictureUrl?: string | null;
  /** Upload needs a saved profile. */
  canUpload: boolean;
};

const fileSize = (asset: ImagePicker.ImagePickerAsset) => {
  if (asset.fileSize) return asset.fileSize;
  try { return new File(asset.uri).size; } catch { return 0; }
};

// Guide 04: JPEG/PNG up to 5 MB and 16 million pixels; the server re-encodes it.
export function ProfilePicture({ pictureUrl, canUpload }: ProfilePictureProps) {
  const upload = useUploadMyProfilePicture();
  const showToast = useToastStore((state) => state.showToast);

  const choose = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;

    const mimeType = asset.mimeType ?? "image/jpeg";
    const file: PictureUploadFile = {
      uri: asset.uri,
      name: asset.fileName ?? (mimeType === "image/png" ? "profile.png" : "profile.jpg"),
      mimeType,
      size: fileSize(asset),
      width: asset.width,
      height: asset.height,
    };
    upload.mutate(file, {
      onSuccess: () => showToast("Profile picture updated.", "success"),
      // HTTP failures are already shown; local checks (type, size, pixels) are not.
      onError: (error) => { if (!isAxiosError(error)) showToast(error.message, "error"); },
    });
  };

  return (
    <View style={styles.container}>
      <ImageComponent source={pictureUrl} width={112} height={112} />
      {canUpload ? (
        <PrimaryButton
          title={upload.isPending ? "Uploading..." : pictureUrl ? "Change photo" : "Add photo"}
          variant="secondary"
          size="md"
          leftIcon="camera-outline"
          onPress={choose}
          disabled={upload.isPending}
          loading={upload.isPending}
        />
      ) : (
        <ThemedText type="footnote" tone="muted">You can add a photo after saving your profile.</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: Spacing.md, marginBottom: Spacing.xl },
});

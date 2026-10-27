import { ThemedText } from "@/components/ThemedText";
import { Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { PictureUploadFile } from "@/services/apiFiles";
import { useToastStore } from "@/stores/toastStore";
import { resolvePublicMediaUrl } from "@/utility/apiTransport";
import Ionicons from "@expo/vector-icons/Ionicons";
import { isAxiosError } from "axios";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Image, StyleSheet, View } from "react-native";
import { ImageComponent } from "./imageComponent";
import { PrimaryButton } from "./PrimaryButton";

type PicturePickerProps = {
  pictureUrl?: string | null;
  /** round: profile avatar; cover: wide business picture. */
  shape?: "round" | "cover";
  /** False hides the button and shows uploadHint instead. */
  canUpload: boolean;
  uploadHint?: string;
  uploading: boolean;
  /** Resolves on success; rejects with the API or local-check error. */
  onUpload: (file: PictureUploadFile) => Promise<unknown>;
  successMessage: string;
};

const fileSize = (asset: ImagePicker.ImagePickerAsset) => {
  if (asset.fileSize) return asset.fileSize;
  try { return new File(asset.uri).size; } catch { return 0; }
};

const publicUri = (url?: string | null) => {
  if (!url?.startsWith("/")) return url ?? null;
  try { return resolvePublicMediaUrl(url); } catch { return null; }
};

// Shared JPEG/PNG upload (5 MB, 16 million pixels; checked by pictureForm before sending).
export function PicturePicker({ pictureUrl, shape = "round", canUpload, uploadHint, uploading, onUpload, successMessage }: PicturePickerProps) {
  const showToast = useToastStore((state) => state.showToast);
  const muted = useThemeColor({}, "textMuted");
  const placeholder = useThemeColor({}, "primaryLight");
  const cover = shape === "cover";
  const uri = publicUri(pictureUrl);

  const choose = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: cover ? [4, 3] : [1, 1], quality: 0.9,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;

    const mimeType = asset.mimeType ?? "image/jpeg";
    try {
      await onUpload({
        uri: asset.uri,
        name: asset.fileName ?? (mimeType === "image/png" ? "picture.png" : "picture.jpg"),
        mimeType,
        size: fileSize(asset),
        width: asset.width,
        height: asset.height,
      });
      showToast(successMessage, "success");
    } catch (error) {
      // HTTP failures are already shown; local checks (type, size, pixels) are not.
      if (!isAxiosError(error)) showToast(error instanceof Error ? error.message : "The picture couldn't be uploaded.", "error");
    }
  };

  return (
    <View style={[styles.container, cover && styles.coverContainer]}>
      {cover ? (
        uri ? (
          <Image source={{ uri }} style={styles.cover} accessibilityLabel="Business picture" />
        ) : (
          <View style={[styles.cover, styles.coverEmpty, { backgroundColor: placeholder }]}>
            <Ionicons name="image-outline" size={36} color={muted} />
          </View>
        )
      ) : (
        <ImageComponent source={uri} width={112} height={112} />
      )}
      {canUpload ? (
        <PrimaryButton
          title={uploading ? "Uploading..." : uri ? "Change photo" : "Add photo"}
          variant="secondary"
          size="md"
          leftIcon="camera-outline"
          onPress={choose}
          disabled={uploading}
          loading={uploading}
        />
      ) : uploadHint ? (
        <ThemedText type="footnote" tone="muted">{uploadHint}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: Spacing.md, marginBottom: Spacing.xl },
  coverContainer: { alignItems: "stretch" },
  cover: { width: "100%", aspectRatio: 4 / 3, borderRadius: Radius.lg },
  coverEmpty: { alignItems: "center", justifyContent: "center" },
});

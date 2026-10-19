import { useThemeColor } from "@/hooks/useThemeColor";
import { Camera, CameraView } from "expo-camera";
import React, { useRef, useState } from "react";
import { ImageStyle, Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "./ThemedText";
import { ImageComponent } from "./ui/imageComponent";

interface UploadSelfieImageProps {
  style?: ImageStyle;
  onImageSelected: (uri: string) => void;
}

export const UploadSelfieImage = ({ style, onImageSelected }: UploadSelfieImageProps) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);

  const primaryColor = useThemeColor({}, "primary");
  const buttonTextColor = useThemeColor({}, "buttonText");
  const borderColor = useThemeColor({}, "borderColor");
  const backgroundColor = useThemeColor({}, "background");

  const takeSelfie = async () => {
    const permission = await Camera.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    setIsCameraOpen(true);
  };

  const captureSelfie = async () => {
    if (!cameraRef.current) return;

    const result = await cameraRef.current.takePictureAsync({
      quality: 0.7,
    });

    if (result?.uri) {
      const uri = result.uri;
      setImageUri(uri);
      onImageSelected(uri);
      setIsCameraOpen(false);
    }
  };

  return (
    <>
      <View style={[style, { alignItems: "center", marginTop: 20, marginBottom: 20 }]}>
        <TouchableOpacity onPress={takeSelfie}>
          <ImageComponent source={imageUri} width={130} height={130} />
        </TouchableOpacity>
      </View>

      <Modal visible={isCameraOpen} animationType="slide" onRequestClose={() => setIsCameraOpen(false)}>
        <View style={[styles.modalContainer, { backgroundColor }]}>
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />

          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor }]}
              onPress={() => setIsCameraOpen(false)}
            >
              <ThemedText>Cancel</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: primaryColor }]}
              onPress={captureSelfie}
            >
              <ThemedText style={{ color: buttonTextColor }}>Take Selfie</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 12,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 12,
  },
});
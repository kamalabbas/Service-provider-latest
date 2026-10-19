import * as ImagePicker from "expo-image-picker";
import { ImageStyle, StyleProp, TouchableOpacity, View } from "react-native";
import { ImageComponent } from "./imageComponent";

interface UploadProfileImageProps {
  style?: StyleProp<ImageStyle>;
  value?: string | null;
  onImageSelected: (uri: string) => void;
}

// A local photo-selection primitive. Uploading belongs to a future API consumer.
export const UploadProfileImage = ({ style, value, onImageSelected }: UploadProfileImageProps) => {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) onImageSelected(result.assets[0].uri);
  };

  return (
    <View style={[style, { alignItems: "center" }]}>
      <TouchableOpacity onPress={pickImage} activeOpacity={0.7} accessibilityLabel="Choose a photo">
        <ImageComponent source={value} width={130} height={130} />
      </TouchableOpacity>
    </View>
  );
};

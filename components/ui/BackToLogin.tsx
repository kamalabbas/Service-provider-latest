import { useThemeColor } from "@/hooks/useThemeColor";
import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "../ThemedText";

export interface Props {
    LinkText: string;
    messageText?: string;
    onPress: () => void;
}

export const BackToLogin = ({ LinkText = 'Return to Login', messageText, onPress }: Props) => {
    const linkColor = useThemeColor({}, "tint");
    const switchTextColor = useThemeColor({}, "text")

    return (
        <View style={styles.container}>
            <ThemedText>
                {messageText && <ThemedText style={[styles.switchText, { color: switchTextColor }]}>{messageText}</ThemedText>} {}
            </ThemedText>
            <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <ThemedText style={[ styles.messageText ,{ color: linkColor }]}>{LinkText}</ThemedText>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
    },
    switchText: {
        fontSize: 14,
        fontWeight: "500",
        textAlign: "center",
    },
    messageText: {
        fontWeight: "bold",
        textDecorationLine: "underline",
        fontSize: 14,
        textAlign: "center",
    },

});
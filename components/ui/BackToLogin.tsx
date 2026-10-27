import { Spacing } from "@/constants/Theme";
import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "../ThemedText";

export interface Props {
    LinkText: string;
    messageText?: string;
    onPress: () => void;
}

// A centered "message + link" line used in auth screen footers.
export const BackToLogin = ({ LinkText = 'Return to Login', messageText, onPress }: Props) => (
    <View style={styles.container}>
        {messageText ? <ThemedText type="callout" tone="muted">{messageText} </ThemedText> : null}
        <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <ThemedText type="link">{LinkText}</ThemedText>
        </Pressable>
    </View>
);

const styles = StyleSheet.create({
    container: {
        paddingVertical: Spacing.lg,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        flexWrap: "wrap",
    },
});

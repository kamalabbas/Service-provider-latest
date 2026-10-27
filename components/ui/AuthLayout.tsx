import { ThemedText } from "@/components/ThemedText";
import { Layout, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import React, { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "./Logo";

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  subtitle?: ReactNode;
  /** Pinned below the form, e.g. a "Don't have an account?" link. */
  footer?: ReactNode;
  /** The stack header already reserves the top inset on screens with a back button. */
  hasHeader?: boolean;
}>;

// Shared page structure for sign-in, registration, verification and recovery.
export function AuthLayout({ title, subtitle, footer, hasHeader = false, children }: AuthLayoutProps) {
  const background = useThemeColor({}, "background");
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: background }}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: (hasHeader ? 0 : insets.top) + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      enableResetScrollToCoords={false}
      extraScrollHeight={Spacing.xxl}
    >
      <View style={styles.content}>
        {hasHeader ? null : <Logo large={false} style={styles.brand} />}
        <View style={styles.heading}>
          <ThemedText type="display">{title}</ThemedText>
          {subtitle ? (
            typeof subtitle === "string"
              ? <ThemedText type="callout" tone="muted" style={styles.subtitle}>{subtitle}</ThemedText>
              : subtitle
          ) : null}
        </View>
        <View>{children}</View>
        <View style={styles.spacer} />
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Layout.screenPadding,
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: Layout.maxContentWidth,
    alignSelf: "center",
  },
  brand: {
    marginBottom: Spacing.xxl,
  },
  heading: {
    marginBottom: Spacing.xxl,
  },
  subtitle: {
    marginTop: Spacing.sm,
  },
  spacer: {
    flexGrow: 1,
    minHeight: Spacing.xl,
  },
  footer: {
    alignItems: "center",
  },
});

import { Radius, Shadow, Spacing, Typography } from '@/constants/Theme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToastStore } from '@/stores/toastStore';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Linking, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  visible: boolean;
  persist?: boolean; // keep toast visible until closed
  linkText?: string;
  linkURL?: string;
}

const DISPLAY_MS = 4000;
const TITLES = { success: 'Success', error: 'Something went wrong', info: 'Notice' } as const;
const ICONS = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle' } as const;

export const Toast: React.FC<ToastProps> = ({ message, type = 'error', visible, persist = false, linkText, linkURL }) => {
  const hideToast = useToastStore((s) => s.hideToast);
  const toastId = useToastStore((s) => s.id);
  const insets = useSafeAreaInsets();

  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'separatorColor');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const accent = {
    success: useThemeColor({}, 'success'),
    error: useThemeColor({}, 'error'),
    info: tint,
  }[type];
  const accentSurface = {
    success: useThemeColor({}, 'successSurface'),
    error: useThemeColor({}, 'errorSurface'),
    info: useThemeColor({}, 'primaryLight'),
  }[type];

  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -24, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => hideToast());
  }, [hideToast, opacity, translateY]);

  // Animate in for every new toast, and give each its own full display time.
  useEffect(() => {
    if (!visible) return;
    translateY.setValue(-24);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
    if (persist) return;
    const timer = setTimeout(dismiss, DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [visible, persist, toastId, dismiss, opacity, translateY]);

  // Swipe up to dismiss. The responder is created once, so read the latest dismiss.
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.min(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy < -24 || gesture.vy < -0.5) dismissRef.current();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  if (!visible) return null;

  const handleLinkPress = async () => {
    if (linkURL) {
      const supported = await Linking.canOpenURL(linkURL);
      if (supported) Linking.openURL(linkURL);
    }
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        Shadow.floating,
        { top: insets.top + Spacing.sm, backgroundColor: surface, borderColor: border, opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: accentSurface }]}>
        <Ionicons name={ICONS[type]} size={22} color={accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: text }]}>{TITLES[type]}</Text>
        <Text style={[styles.message, { color: muted }]}>{message}</Text>
        {linkURL ? (
          <Pressable onPress={handleLinkPress} hitSlop={6}>
            <Text style={[styles.link, { color: tint }]}>{linkText || 'Learn more'}</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={dismiss} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Dismiss notification">
        <Ionicons name="close" size={18} color={muted} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 9999,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: Spacing.xxs,
    paddingTop: Spacing.xxs,
  },
  title: {
    ...Typography.label,
  },
  message: {
    ...Typography.caption,
  },
  link: {
    ...Typography.caption,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  close: {
    padding: Spacing.xxs,
  },
});

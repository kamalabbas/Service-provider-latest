import type { TextStyle, ViewStyle } from "react-native";

// Shared layout tokens. Colors live in Colors.ts; use these for every spacing,
// radius, type and elevation decision so screens stay consistent.
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const Typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.2 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  callout: { fontSize: 15, lineHeight: 20 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 18 },
  footnote: { fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

// Both platforms' properties are listed; each platform ignores the other's.
export const Shadow = {
  card: {
    shadowColor: "#0D1A14",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: "#0D1A14",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;

export const Layout = {
  screenPadding: Spacing.xl,
  controlHeight: 52,
  maxContentWidth: 480,
} as const;

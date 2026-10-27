import { StyleSheet, Text, type TextProps } from 'react-native';

import { Typography } from '@/constants/Theme';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | 'default'
    | 'defaultSemiBold'
    | 'display'
    | 'title'
    | 'subtitle'
    | 'headline'
    | 'callout'
    | 'label'
    | 'caption'
    | 'footnote'
    | 'link';
  /** Secondary text uses the muted text color. */
  tone?: 'default' | 'muted' | 'tint' | 'error';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  tone = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const linkColor = useThemeColor({ light: lightColor, dark: darkColor }, 'tint');
  const mutedColor = useThemeColor({ light: lightColor, dark: darkColor }, 'textMuted');
  const errorColor = useThemeColor({ light: lightColor, dark: darkColor }, 'error');
  const toneColor = tone === 'muted' ? mutedColor : tone === 'tint' ? linkColor : tone === 'error' ? errorColor : undefined;

  return (
    <Text
      style={[
        { color },
        styles[type],
        type === 'link' ? { color: linkColor } : undefined,
        toneColor ? { color: toneColor } : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: Typography.body,
  defaultSemiBold: Typography.bodyStrong,
  display: Typography.display,
  title: Typography.display,
  subtitle: Typography.title,
  headline: Typography.headline,
  callout: Typography.callout,
  label: Typography.label,
  caption: Typography.caption,
  footnote: Typography.footnote,
  link: { ...Typography.callout, fontWeight: '600' },
});

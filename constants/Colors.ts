/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * The palette is derived from the brand logo green (#1A543C) on white.
 */
const brandGreen = "#1A543C";
const brandGreenDarkMode = "#2A7A57";
const brandGreenLight = "#6FCF9F";

export const Colors = {
  light: {
    text: "#10231A",
    textMuted: "#5B6B63",
    background: "#FFFFFF",
    surface: "#FFFFFF",
    muted: "#F2F6F4",
    tint: brandGreen,
    icon: brandGreen,
    tabIconDefault: "#8A9A92",
    tabIconSelected: brandGreen,
    error: "#C0392B",
    primary: brandGreen,
    primaryLight: "#E3EEE8",
    borderColor: "#C9D6CF",
    placeholder: "#7A8A82",
    buttonText: "#FFFFFF",
    separatorColor: "#E1E8E4",
    optionSeparator: "#E1E8E4",
    success: "#2E7D4F",
    warning: "#E0A800",
    white: "#FFFFFF",
  },
  dark: {
    text: "#E6EEEA",
    textMuted: "#9FB3A9",
    background: "#0D1A14",
    surface: "#15261E",
    muted: "#0A140F",
    tint: brandGreenLight,
    icon: brandGreenLight,
    tabIconDefault: "#7F948A",
    tabIconSelected: brandGreenLight,
    error: "#E5675A",
    primary: brandGreenDarkMode,
    primaryLight: "#1C3A2D",
    borderColor: "#2E443A",
    placeholder: "#7F948A",
    buttonText: "#FFFFFF",
    separatorColor: "#22332B",
    optionSeparator: "#2E443A",
    success: "#2E7D4F",
    warning: "#E0A800",
    white: "#FFFFFF",
  },
};

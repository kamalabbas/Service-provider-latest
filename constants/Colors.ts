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
    error: "#B42318",
    primary: brandGreen,
    primaryPressed: "#123D2B",
    primaryLight: "#E3EEE8",
    borderColor: "#D3DDD8",
    placeholder: "#7A8A82",
    buttonText: "#FFFFFF",
    separatorColor: "#E7EDEA",
    optionSeparator: "#E1E8E4",
    success: "#2E7D4F",
    successSurface: "#E5F3EA",
    errorSurface: "#FCEBE9",
    warning: "#B7791F",
    warningSurface: "#FDF3DC",
    overlay: "rgba(13, 26, 20, 0.45)",
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
    primaryPressed: "#21664A",
    primaryLight: "#1C3A2D",
    borderColor: "#2E443A",
    placeholder: "#7F948A",
    buttonText: "#FFFFFF",
    separatorColor: "#22332B",
    optionSeparator: "#2E443A",
    success: "#4CB97F",
    successSurface: "#16301F",
    errorSurface: "#3A1E1B",
    warning: "#E0B04A",
    warningSurface: "#33290F",
    overlay: "rgba(0, 0, 0, 0.6)",
    white: "#FFFFFF",
  },
};

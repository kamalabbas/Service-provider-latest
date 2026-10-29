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
  // A softer charcoal green: layers stay distinguishable and text stays readable.
  dark: {
    text: "#EEF3F0",
    textMuted: "#B0C1B8",
    background: "#1F2A25",
    surface: "#28352F",
    muted: "#1A2420",
    tint: brandGreenLight,
    icon: brandGreenLight,
    tabIconDefault: "#97AAA1",
    tabIconSelected: brandGreenLight,
    error: "#E5675A",
    primary: brandGreenDarkMode,
    primaryPressed: "#21664A",
    primaryLight: "#2D4C3E",
    borderColor: "#41554B",
    placeholder: "#97AAA1",
    buttonText: "#FFFFFF",
    separatorColor: "#36473F",
    optionSeparator: "#41554B",
    success: "#4CB97F",
    successSurface: "#223F2E",
    errorSurface: "#4A2825",
    warning: "#E0B04A",
    warningSurface: "#45391A",
    overlay: "rgba(0, 0, 0, 0.6)",
    white: "#FFFFFF",
  },
};

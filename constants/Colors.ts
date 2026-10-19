/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */
const primaryColor = "#CBD5E1";
const tintColorLight = "#94A3B8";
const tintColorDark = "#475569";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    muted: "#F5F6F7",
    tint: tintColorDark,
    icon: tintColorDark,
    tabIconDefault: primaryColor,
    tabIconSelected: tintColorDark,
    error: "#e74c3c",
    primary: primaryColor,
    borderColor: "#11181C",
    buttonText: "#11181C",
    separatorColor: "#11181C",
    optionSeparator: "#3b3a3aff",
    success: "#28a745",
    warning: "#F1C40F",
    white: "#FFFFFF",
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    muted: "#0F1112",
    tint: tintColorLight,
    icon: primaryColor,
    tabIconDefault: primaryColor,
    tabIconSelected: tintColorLight,
    error: "#e74c3c",
    primary: primaryColor,
    borderColor: "#ECEDEE",
    buttonText: "#11181C",
    separatorColor: "#eee",
    optionSeparator: "#dbdbdbff",
    success: "#28a745",
    warning: "#F1C40F",
    white: "#FFFFFF",
  },
};

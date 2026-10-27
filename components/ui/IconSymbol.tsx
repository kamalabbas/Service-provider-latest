// Fallback for using MaterialIcons on Android.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolViewProps, SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Partial<Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "list.clipboard": "assignment",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  menu: "menu",
  "person.2.fill": "people",
  "bell.fill": "notifications",
  bell: "notifications-none",
  "line.3.horizontal": "menu",
  magnifyingglass: "search",
  person: "person-outline",
  "questionmark.circle.fill": "help",
  "questionmark.circle": "help-outline",
  "pencil.circle.fill": "edit",
  "pencil.circle": "edit",
  pencil: "mode-edit-outline",
  "rectangle.portrait.and.arrow.right.fill": "logout",
  "rectangle.portrait.and.arrow.right": "logout",
  "megaphone.fill": "campaign",
  heart: "favorite-outline",
  "heart.fill": "favorite",
  "hands.sparkles.fill": "volunteer-activism",
  "person.3.fill": "diversity-3",
  "hand.raised.fill": "pan-tool",
  "banknote.fill": "attach-money",
  "person.badge.plus": "person-add-alt",
  "person.2.badge.gearshape": "group-add",
  megaphone: "campaign",
  "hands.sparkles": "volunteer-activism",
  "person.3": "diversity-3",
  "hand.raised": "pan-tool-alt",
  banknote: "attach-money",
  drop: "water-drop",
  "hands.clap": "handshake",
  basket: "shopping-basket",
  sparkles: "auto-awesome",
  "tray.and.arrow.up": "restaurant",
  "calendar.badge.plus": "event",
  "person.2.wave.2": "how-to-vote",
  "clock.arrow.circlepath": "history",
  "person.text.rectangle": "badge",
  "book.fill": "menu-book",
  "info.circle": "info-outline",
  lock: "lock-outline",
  "lock.fill": "lock",
  "lock.shield": "security",
  "arrow.clockwise": "refresh",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} weight={weight} />;
}

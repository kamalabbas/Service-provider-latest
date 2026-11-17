import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

/**
 * Whether the native map can render. Android builds need a Google Maps key (the map crashes
 * the app without one); Expo Go ships its own key, and iOS uses Apple Maps.
 */
export function mapAvailable(
  os: string = Platform.OS,
  environment: string | undefined = Constants.executionEnvironment,
  androidKeySet: unknown = Constants.expoConfig?.extra?.androidMapsEnabled,
): boolean {
  if (os !== "android") return true;
  if (environment === ExecutionEnvironment.StoreClient) return true;
  return androidKeySet === true;
}

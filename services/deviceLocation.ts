import { Coordinates, roundCoordinate } from "@/utility/coordinates";
import * as Location from "expo-location";

export type DeviceLocationResult =
  | { status: "granted"; coordinates: Coordinates }
  | { status: "denied" }
  | { status: "unavailable" };

/**
 * The device's current position, asking for foreground permission first.
 * Callers fall back to the map pin when permission is denied or no fix is available.
 */
export async function getDeviceLocation(): Promise<DeviceLocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") return { status: "denied" };
    // Network location can be missing (indoors, no Wi-Fi scan, emulators), and without a map the
    // member has no other way to set a point, so fall back to the last fix, then to GPS.
    const position =
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null)) ??
      (await Location.getLastKnownPositionAsync().catch(() => null)) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
    return {
      status: "granted",
      coordinates: { latitude: roundCoordinate(position.coords.latitude), longitude: roundCoordinate(position.coords.longitude) },
    };
  } catch {
    return { status: "unavailable" };
  }
}

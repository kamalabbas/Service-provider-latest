import * as yup from "yup";

const DECIMAL = /^-?\d+(\.\d+)?$/;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Coordinates are kept as text in forms so 0 and negatives round-trip. They're
 * set from the map pin or the device location, never typed by the member.
 */
export const coordinateField = (label: "latitude" | "longitude") => {
  const limit = label === "latitude" ? 90 : 180;
  return yup.string().trim().required("Set the location: use your current location or tap the map")
    .matches(DECIMAL, `The ${label} isn't valid. Set the location again.`)
    .test("range", `The ${label} must be between -${limit} and ${limit}`, (value) => !value || Math.abs(Number(value)) <= limit);
};

/** Text for a coordinate field; 0 stays "0". */
export const coordinateText = (value: number | null | undefined) => (value == null ? "" : String(value));

/** About 0.1 m precision is plenty for a map pin. */
export const roundCoordinate = (value: number) => Math.round(value * 1e6) / 1e6;

/** Valid coordinates from form text, or null when unset or invalid. */
export function parseCoordinates(latitude: string, longitude: string): Coordinates | null {
  if (!DECIMAL.test(latitude.trim()) || !DECIMAL.test(longitude.trim())) return null;
  const point = { latitude: Number(latitude), longitude: Number(longitude) };
  return Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180 ? point : null;
}

/** Whole-of-Australia view used before a location is set. */
export const AUSTRALIA_REGION = { latitude: -25.2744, longitude: 133.7751, latitudeDelta: 32, longitudeDelta: 32 };

/** Map region centred on a point, zoomed to street level, or Australia when unset. */
export const mapRegion = (point: Coordinates | null) =>
  point ? { ...point, latitudeDelta: 0.01, longitudeDelta: 0.01 } : AUSTRALIA_REGION;

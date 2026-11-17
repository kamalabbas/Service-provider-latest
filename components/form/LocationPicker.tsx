import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Layout, Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getDeviceLocation } from "@/services/deviceLocation";
import { Coordinates, mapRegion, roundCoordinate } from "@/utility/coordinates";
import { mapAvailable } from "@/utility/maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { MapPressEvent, Marker, MarkerDragStartEndEvent } from "react-native-maps";

type LocationPickerProps = {
  label?: string;
  value: Coordinates | null;
  onChange: (value: Coordinates) => void;
  error?: string;
  helperText?: string;
  /** Shown instead of helperText when this build has no map. */
  noMapHelperText?: string;
  /** Ask for the device location once when the picker first shows (search only). */
  locateOnMount?: boolean;
};

const DENIED = "Location access is off. Tap the map to place the pin, or allow location in your phone's settings.";
const UNAVAILABLE = "Your location couldn't be found. Tap the map to place the pin.";
const NO_MAP_DENIED = "Location access is off. Allow location in your phone's settings, then try again.";
const NO_MAP_UNAVAILABLE = "Your location couldn't be found. Check that location is on, then try again.";
const SHOW_MAP = mapAvailable();

// A map pin the member can tap or drag, plus "Use my current location".
export function LocationPicker({ label, value, onChange, error, helperText, noMapHelperText, locateOnMount }: LocationPickerProps) {
  const map = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const borderColor = useThemeColor({}, "borderColor");
  const errorColor = useThemeColor({}, "error");
  const tint = useThemeColor({}, "tint");
  const surface = useThemeColor({}, "surface");

  const set = (point: Coordinates) => {
    const rounded = { latitude: roundCoordinate(point.latitude), longitude: roundCoordinate(point.longitude) };
    onChange(rounded);
  };

  // Follow the pin, including changes made outside the map (e.g. "use my business location").
  useEffect(() => {
    if (value) map.current?.animateToRegion(mapRegion(value), 400);
  }, [value?.latitude, value?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const locate = async () => {
    setLocating(true);
    const result = await getDeviceLocation();
    setLocating(false);
    if (result.status === "granted") {
      setNotice(null);
      set(result.coordinates);
    } else {
      const denied = result.status === "denied";
      setNotice(SHOW_MAP ? (denied ? DENIED : UNAVAILABLE) : (denied ? NO_MAP_DENIED : NO_MAP_UNAVAILABLE));
    }
  };

  useEffect(() => {
    // Only on first show; later locates are explicit. Reading the device location is an
    // external sync; its loading flag is set as it starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (locateOnMount && !value) locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {label ? <ThemedText type="label" style={styles.label}>{label}</ThemedText> : null}
      {SHOW_MAP ? (
      <View style={[styles.mapFrame, { borderColor: error ? errorColor : borderColor }]}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={mapRegion(value)}
          onPress={(event: MapPressEvent) => set(event.nativeEvent.coordinate)}
          showsUserLocation={false}
          toolbarEnabled={false}
          accessibilityLabel="Map. Tap to place the pin."
        >
          {value ? (
            <Marker
              coordinate={value}
              draggable
              pinColor={tint}
              onDragEnd={(event: MarkerDragStartEndEvent) => set(event.nativeEvent.coordinate)}
            />
          ) : null}
        </MapView>
        {value ? null : (
          <View style={[styles.hint, { backgroundColor: surface }]} pointerEvents="none">
            <Ionicons name="hand-left-outline" size={16} color={tint} />
            <ThemedText type="caption">Tap the map to place the pin</ThemedText>
          </View>
        )}
      </View>
      ) : (
        // No map in this build: the member's location is set from the device instead.
        <View style={[styles.panel, { borderColor: error ? errorColor : borderColor, backgroundColor: surface }]}>
          <Ionicons name={value ? "location" : "location-outline"} size={22} color={tint} />
          <View style={styles.panelText}>
            <ThemedText type="headline">{value ? "Location set" : "No location yet"}</ThemedText>
            <ThemedText type="caption" tone="muted">
              {value ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}` : "Use your current location below."}
            </ThemedText>
          </View>
        </View>
      )}
      <PrimaryButton
        title={locating ? "Finding you..." : "Use my current location"}
        variant="secondary"
        size="md"
        leftIcon="locate-outline"
        onPress={locate}
        loading={locating}
        disabled={locating}
        style={styles.button}
      />
      {error ? (
        <ThemedText type="caption" tone="error" style={styles.message}>{error}</ThemedText>
      ) : notice ? (
        <ThemedText type="caption" tone="muted" style={styles.message}>{notice}</ThemedText>
      ) : (SHOW_MAP ? helperText : noMapHelperText) ? (
        <ThemedText type="footnote" tone="muted" style={styles.message}>{SHOW_MAP ? helperText : noMapHelperText}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", marginBottom: Spacing.lg },
  label: { marginBottom: Spacing.sm },
  mapFrame: { height: Layout.controlHeight * 4.5, borderRadius: Radius.md, borderWidth: 1, overflow: "hidden" },
  hint: {
    position: "absolute",
    top: Spacing.sm,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  panel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  panelText: { flex: 1, gap: Spacing.xxs },
  button: { marginTop: Spacing.md },
  message: { marginTop: Spacing.sm },
});

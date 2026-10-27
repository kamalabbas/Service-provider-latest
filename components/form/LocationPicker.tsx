import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Layout, Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getDeviceLocation } from "@/services/deviceLocation";
import { Coordinates, mapRegion, roundCoordinate } from "@/utility/coordinates";
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
  /** Ask for the device location once when the picker first shows (search only). */
  locateOnMount?: boolean;
};

const DENIED = "Location access is off. Tap the map to place the pin, or allow location in your phone's settings.";
const UNAVAILABLE = "Your location couldn't be found. Tap the map to place the pin.";

// A map pin the member can tap or drag, plus "Use my current location".
export function LocationPicker({ label, value, onChange, error, helperText, locateOnMount }: LocationPickerProps) {
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
      setNotice(result.status === "denied" ? DENIED : UNAVAILABLE);
    }
  };

  useEffect(() => {
    if (locateOnMount && !value) locate();
    // Only on first show; later locates are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {label ? <ThemedText type="label" style={styles.label}>{label}</ThemedText> : null}
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
      ) : helperText ? (
        <ThemedText type="footnote" tone="muted" style={styles.message}>{helperText}</ThemedText>
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
  button: { marginTop: Spacing.md },
  message: { marginTop: Spacing.sm },
});

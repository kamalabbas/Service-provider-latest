import type { SaveServiceRequest, ServiceListing } from "@/interfaces/service.interface";
import { coordinateField, coordinateText } from "@/utility/coordinates";
import * as yup from "yup";

export interface ServiceFormValues {
  title: string;
  description: string;
  occupationCode: string;
  suburb: string;
  regionCode: string;
  latitude: string;
  longitude: string;
}

export const SERVICE_FIELDS = [
  "title", "description", "occupationCode", "suburb", "regionCode", "latitude", "longitude",
] as const satisfies readonly (keyof ServiceFormValues)[];

/** A location to prefill a new listing from, e.g. the business. Never written back to it. */
export interface ListingLocation {
  suburb: string;
  regionCode: string;
  latitude: number;
  longitude: number;
}

export function serviceFormValues(listing?: ServiceListing | null, prefill?: ListingLocation | null): ServiceFormValues {
  const location = listing ?? prefill;
  return {
    title: listing?.title ?? "",
    description: listing?.description ?? "",
    occupationCode: listing?.occupationCode ?? "",
    suburb: location?.suburb ?? "",
    regionCode: location?.regionCode ?? "",
    latitude: coordinateText(location?.latitude),
    longitude: coordinateText(location?.longitude),
  };
}

const required = (label: string, max: number) => yup.string().trim().required(`Enter ${label}`).max(max, `Use at most ${max} characters`);

/** Mirrors SaveServiceRequest; the server still checks eligibility and references. */
export const serviceSchema: yup.ObjectSchema<ServiceFormValues> = yup.object({
  title: required("a title", 120),
  description: required("a description", 2000),
  occupationCode: yup.string().required("Choose an occupation"),
  suburb: required("a suburb", 100),
  regionCode: yup.string().required("Choose a state or territory"),
  latitude: coordinateField("latitude"),
  longitude: coordinateField("longitude"),
});

export function toSaveServiceRequest(values: ServiceFormValues): SaveServiceRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    occupationCode: values.occupationCode,
    suburb: values.suburb.trim(),
    regionCode: values.regionCode,
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
  };
}

/**
 * Occupations a provider may list. A Tradeperson is limited to the occupations
 * on their completed profile; Builder/Developer may choose any active one.
 */
export function allowedOccupationCodes(userTypeCode: string | null | undefined, profileOccupationCodes: readonly string[]): readonly string[] | null {
  return userTypeCode === "tradeperson" ? profileOccupationCodes : null;
}

/** Ratings: null average means no ratings, not zero stars. */
export function ratingText(average: number | null | undefined, count: number): string {
  if (average == null || count === 0) return "No ratings yet";
  return `${average.toFixed(1)} ★ (${count} ${count === 1 ? "rating" : "ratings"})`;
}

/** Estimated straight-line distance; not travel time or road distance. */
export function distanceText(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null) return null;
  return distanceKm < 1 ? "Under 1 km away" : `About ${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km away`;
}

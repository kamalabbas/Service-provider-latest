import type { Profile, SaveProfileRequest } from "@/interfaces/profile.interface";
import * as yup from "yup";

// Guide 04: type-specific sections follow the member's current user type, never a role.
export const TRADEPERSON = "tradeperson";
export const PUBLIC_GOVERNMENT_SECTOR = "public_government_sector";

export interface ProfileOccupationValue {
  occupationCode: string;
  licence: string;
}

/** Text inputs hold strings; blank optional fields are sent as null. */
export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  mobilePhone: string;
  landlinePhone: string;
  streetAddress: string;
  suburb: string;
  regionCode: string;
  postalCode: string;
  isPostalSameAsAddress: boolean;
  postalAddress: string;
  postalSuburb: string;
  postalRegionCode: string;
  postalPostalCode: string;
  contactEmail: string;
  website: string;
  governmentSectorName: string;
  occupations: ProfileOccupationValue[];
}

export const PROFILE_FIELDS = [
  "firstName", "lastName", "mobilePhone", "landlinePhone", "streetAddress", "suburb", "regionCode", "postalCode",
  "postalAddress", "postalSuburb", "postalRegionCode", "postalPostalCode", "contactEmail", "website",
  "governmentSectorName", "occupations",
] as const satisfies readonly (keyof ProfileFormValues)[];

/** Form values for a saved profile, or empty values for the first one. */
export function profileFormValues(profile?: Profile | null): ProfileFormValues {
  const same = profile?.isPostalSameAsAddress ?? true;
  return {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    mobilePhone: profile?.mobilePhone ?? "",
    landlinePhone: profile?.landlinePhone ?? "",
    streetAddress: profile?.streetAddress ?? "",
    suburb: profile?.suburb ?? "",
    regionCode: profile?.regionCode ?? "",
    postalCode: profile?.postalCode ?? "",
    isPostalSameAsAddress: same,
    postalAddress: same ? "" : profile?.postalAddress ?? "",
    postalSuburb: same ? "" : profile?.postalSuburb ?? "",
    postalRegionCode: same ? "" : profile?.postalRegionCode ?? "",
    postalPostalCode: same ? "" : profile?.postalPostalCode ?? "",
    contactEmail: profile?.contactEmail ?? "",
    website: profile?.website ?? "",
    governmentSectorName: profile?.governmentSectorName ?? "",
    occupations: (profile?.occupations ?? []).map(({ occupationCode, licence }) => ({ occupationCode, licence })),
  };
}

const PHONE = /^(?=.*\d)\+?[0-9 ()-]+$/;
const required = (label: string, max: number) => yup.string().trim().required(`Enter ${label}`).max(max, `Use at most ${max} characters`);
const optional = (max: number) => yup.string().trim().max(max, `Use at most ${max} characters`).defined();
/** Required only when the postal address differs from the street address. */
const postal = (message: string, max: number) =>
  optional(max).when("isPostalSameAsAddress", { is: false, then: (s) => s.required(message) });

/** Mirrors SaveProfileRequest and the guide's conditional rules; the server still validates. */
export function profileSchema(userTypeCode: string | null | undefined): yup.ObjectSchema<ProfileFormValues> {
  const isTradeperson = userTypeCode === TRADEPERSON;
  const isGovernment = userTypeCode === PUBLIC_GOVERNMENT_SECTOR;

  return yup.object({
    firstName: required("your first name", 100),
    lastName: required("your last name", 100),
    mobilePhone: required("a mobile number", 30).matches(PHONE, "Enter a valid phone number"),
    landlinePhone: optional(30).matches(PHONE, { message: "Enter a valid phone number", excludeEmptyString: true }),
    streetAddress: required("a street address", 255),
    suburb: required("a suburb", 100),
    regionCode: yup.string().required("Choose a state or territory"),
    postalCode: required("a postcode", 20),
    isPostalSameAsAddress: yup.boolean().required(),
    postalAddress: postal("Enter a postal address", 255),
    postalSuburb: postal("Enter a postal suburb", 100),
    postalRegionCode: postal("Choose a postal state or territory", 10),
    postalPostalCode: postal("Enter a postal postcode", 20),
    contactEmail: optional(254).email("Enter a valid email address"),
    website: optional(2048).url("Enter a full web address, e.g. https://example.com.au"),
    governmentSectorName: isGovernment ? required("the government sector name", 255) : optional(255),
    occupations: yup
      .array(yup.object({
        occupationCode: yup.string().required(),
        licence: isTradeperson ? required("the licence for this occupation", 255) : optional(255),
      }).required())
      .required()
      .test("distinct", "Choose each occupation once", (items) => new Set(items?.map((item) => item.occupationCode)).size === (items?.length ?? 0))
      .min(isTradeperson ? 1 : 0, "Choose at least one occupation"),
  });
}

const text = (value: string) => value.trim();
const optionalText = (value: string) => value.trim() || null;

/**
 * The complete JSON save. isPostalSameAsAddress is always sent; type-specific
 * details are cleared for other types so the server removes them.
 */
export function toSaveProfileRequest(values: ProfileFormValues, userTypeCode: string | null | undefined): SaveProfileRequest {
  const same = values.isPostalSameAsAddress;
  return {
    firstName: text(values.firstName),
    lastName: text(values.lastName),
    mobilePhone: text(values.mobilePhone),
    landlinePhone: optionalText(values.landlinePhone),
    streetAddress: text(values.streetAddress),
    suburb: text(values.suburb),
    regionCode: values.regionCode,
    postalCode: text(values.postalCode),
    isPostalSameAsAddress: same,
    postalAddress: same ? null : optionalText(values.postalAddress),
    postalSuburb: same ? null : optionalText(values.postalSuburb),
    postalRegionCode: same ? null : values.postalRegionCode || null,
    postalPostalCode: same ? null : optionalText(values.postalPostalCode),
    contactEmail: optionalText(values.contactEmail),
    website: optionalText(values.website),
    governmentSectorName: userTypeCode === PUBLIC_GOVERNMENT_SECTOR ? optionalText(values.governmentSectorName) : null,
    occupations: userTypeCode === TRADEPERSON
      ? values.occupations.map(({ occupationCode, licence }) => ({ occupationCode, licence: text(licence) }))
      : [],
  };
}

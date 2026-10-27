import type { Business, SaveBusinessRequest } from "@/interfaces/business.interface";
import * as yup from "yup";
import { coordinateField, coordinateText } from "@/utility/coordinates";

const digits = (value: string) => value.replace(/\s/g, "");

/** ABN: eleven digits, weighted checksum mod 89. Not proof of registration. */
export function isValidAbn(value: string): boolean {
  const abn = digits(value);
  if (!/^\d{11}$/.test(abn)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = weights.reduce((total, weight, i) => total + weight * (Number(abn[i]) - (i === 0 ? 1 : 0)), 0);
  return sum % 89 === 0;
}

/** ACN: nine digits, the last a mod-10 check digit. Not proof of registration. */
export function isValidAcn(value: string): boolean {
  const acn = digits(value);
  if (!/^\d{9}$/.test(acn)) return false;
  const sum = [8, 7, 6, 5, 4, 3, 2, 1].reduce((total, weight, i) => total + weight * Number(acn[i]), 0);
  return (10 - (sum % 10)) % 10 === Number(acn[8]);
}

export interface BusinessFormValues {
  businessName: string;
  abn: string;
  acn: string;
  phone: string;
  mobilePhone: string;
  streetAddress: string;
  suburb: string;
  regionCode: string;
  postalCode: string;
  latitude: string;
  longitude: string;
}

export const BUSINESS_FIELDS = [
  "businessName", "abn", "acn", "phone", "mobilePhone", "streetAddress", "suburb", "regionCode", "postalCode", "latitude", "longitude",
] as const satisfies readonly (keyof BusinessFormValues)[];

export function businessFormValues(business?: Business | null): BusinessFormValues {
  return {
    businessName: business?.businessName ?? "",
    abn: business?.abn ?? "",
    acn: business?.acn ?? "",
    phone: business?.phone ?? "",
    mobilePhone: business?.mobilePhone ?? "",
    streetAddress: business?.streetAddress ?? "",
    suburb: business?.suburb ?? "",
    regionCode: business?.regionCode ?? "",
    postalCode: business?.postalCode ?? "",
    latitude: coordinateText(business?.latitude),
    longitude: coordinateText(business?.longitude),
  };
}

const PHONE = /^(?=.*\d)\+?[0-9 ()-]+$/;
const required = (label: string, max: number) => yup.string().trim().required(`Enter ${label}`).max(max, `Use at most ${max} characters`);
const optional = (max: number) => yup.string().trim().max(max, `Use at most ${max} characters`).defined();
const phone = () => optional(30).matches(PHONE, { message: "Enter a valid phone number", excludeEmptyString: true });

/** Mirrors SaveBusinessRequest; the server still validates and normalizes. */
export const businessSchema: yup.ObjectSchema<BusinessFormValues> = yup.object({
  businessName: required("the business name", 255),
  abn: yup.string().trim().required("Enter the ABN").test("abn", "Enter a valid 11-digit ABN", (value) => !value || isValidAbn(value)),
  acn: optional(15).test("acn", "Enter a valid 9-digit ACN", (value) => !value || isValidAcn(value)),
  phone: phone(),
  mobilePhone: phone(),
  streetAddress: required("a street address", 255),
  suburb: required("a suburb", 100),
  regionCode: yup.string().required("Choose a state or territory"),
  postalCode: required("a postcode", 20),
  latitude: coordinateField("latitude"),
  longitude: coordinateField("longitude"),
});

const optionalText = (value: string) => value.trim() || null;

/** The complete JSON save. Spaces are removed from ABN/ACN; blank optional fields are null. */
export function toSaveBusinessRequest(values: BusinessFormValues): SaveBusinessRequest {
  return {
    businessName: values.businessName.trim(),
    abn: digits(values.abn),
    acn: digits(values.acn) || null,
    phone: optionalText(values.phone),
    mobilePhone: optionalText(values.mobilePhone),
    streetAddress: values.streetAddress.trim(),
    suburb: values.suburb.trim(),
    regionCode: values.regionCode,
    postalCode: values.postalCode.trim(),
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
  };
}

/** Display grouping only: ABN as "51 824 753 556", ACN as "004 085 616". */
export function formatRegistrationNumber(value: string | null | undefined): string {
  const number = digits(value ?? "");
  if (/^\d{11}$/.test(number)) return number.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4");
  if (/^\d{9}$/.test(number)) return number.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
  return number;
}

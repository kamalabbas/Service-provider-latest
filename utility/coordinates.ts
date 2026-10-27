import * as yup from "yup";

const DECIMAL = /^-?\d+(\.\d+)?$/;
const EXAMPLES = { latitude: "-33.8688", longitude: "151.2093" } as const;

/** Coordinates are typed as text so 0 and negative values edit naturally. */
export const coordinateField = (label: "latitude" | "longitude") => {
  const limit = label === "latitude" ? 90 : 180;
  return yup.string().trim().required(`Enter the ${label}`)
    .matches(DECIMAL, `Enter the ${label} as a decimal number, e.g. ${EXAMPLES[label]}`)
    .test("range", `The ${label} must be between -${limit} and ${limit}`, (value) => !value || Math.abs(Number(value)) <= limit);
};

/** Text for a coordinate input; 0 stays "0". */
export const coordinateText = (value: number | null | undefined) => (value == null ? "" : String(value));

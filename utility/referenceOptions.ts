import type { ReferenceChoice } from "@/interfaces/reference.interface";

export interface SelectOption {
  label: string;
  value: string;
  /** Shown but not selectable, e.g. a retired choice kept on a saved record. */
  disabled?: boolean;
}

/**
 * Active choices as select options, plus any saved code that is no longer
 * active. Guide 06: keep a retired code on a saved record and render it as
 * retired, but never offer it as a new selection.
 */
export function referenceOptions(choices: readonly ReferenceChoice[] | undefined, saved?: string | readonly string[] | null): SelectOption[] {
  const options: SelectOption[] = (choices ?? []).map((choice) => ({ label: choice.displayName, value: choice.code }));
  const active = new Set(options.map((option) => option.value));
  const savedCodes = saved == null ? [] : typeof saved === "string" ? [saved] : saved;
  for (const code of new Set(savedCodes)) {
    if (code && !active.has(code)) options.push({ label: `${code} (retired)`, value: code, disabled: true });
  }
  return options;
}

/** Display label for a stored code; unknown codes are shown as retired. */
export function referenceLabel(choices: readonly ReferenceChoice[] | undefined, code: string | null | undefined): string {
  if (!code) return "";
  return choices?.find((choice) => choice.code === code)?.displayName ?? `${code} (retired)`;
}

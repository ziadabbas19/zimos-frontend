/**
 * The active locale, free of React, for plain helpers that run outside a
 * component and under node --test (lib/referralCodes.ts and its siblings reach
 * this file by relative path). <LocaleProvider> sets it, during render, so a
 * helper called in the render that switches language already sees the new one.
 */
export type Locale = "en" | "ar";

let active: Locale = "en";

export function getActiveLocale(): Locale {
  return active;
}

export function setActiveLocale(next: Locale): void {
  active = next;
}

/** The Intl tag dates are written in: the merchant dashboard's for Arabic. */
export function dateLocale(): string {
  return active === "ar" ? "ar-EG" : "en";
}

/** "Hello {name}" + { name: "Sara" } -> "Hello Sara" */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in values ? String(values[k]) : `{${k}}`));
}

export type CountForm = "one" | "two" | "few" | "many";

/**
 * Which form a counted noun takes. Arabic has all four (دفعة واحدة، دفعتان،
 * 3 دفعات، 11 دفعة); English tables give "two", "few" and "many" the same plural.
 */
export function countForm(n: number): CountForm {
  if (n === 1) return "one";
  if (n === 2) return "two";
  const tens = n % 100;
  return tens >= 3 && tens <= 10 ? "few" : "many";
}

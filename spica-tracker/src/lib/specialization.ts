export const SPECIALIZATION_VALUES = ["SALARY", "TAX", "DOCS"] as const;

export type Specialization = (typeof SPECIALIZATION_VALUES)[number];

export const SPECIALIZATION_LABELS: Record<string, string> = {
  SALARY: "Зарплата",
  TAX: "Налоги",
  DOCS: "Ввод док-тов",
};

export const SPECIALIZATION_SHORT: Record<string, string> = {
  SALARY: "ЗП",
  TAX: "Налоги",
  DOCS: "Ввод док-тов",
};

export function isSpecialization(value: string): value is Specialization {
  return (SPECIALIZATION_VALUES as readonly string[]).includes(value);
}

export function specLabel(spec: string | null | undefined): string {
  if (!spec) return "Общая";
  return SPECIALIZATION_LABELS[spec] ?? "Общая";
}

export function specShort(spec: string | null | undefined): string {
  if (!spec) return "";
  return SPECIALIZATION_SHORT[spec] ?? spec;
}

// Суффикс для option в списках: « • ЗП», « • Налоги», « • Ввод док-тов»
export function specSuffix(spec: string | null | undefined): string {
  if (!spec) return "";
  return ` • ${specShort(spec)}`;
}

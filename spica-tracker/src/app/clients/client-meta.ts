export type Executor = {
  id: string;
  name: string;
  specialization: string | null;
};

export type Client = {
  id: string;
  name: string;
  taxSystem: string;
  legalForm: string | null;
  shortName: string | null;
  salaryPaymentDay: number | null;
  advanceDay: number | null;
  employeeCount: number | null;
  invoiceDay: number | null;
  invoiceAmount: number | null;
  paymentPeriod: string;
  accountNote: string | null;
  features: string | null;
  hasCashRegister: boolean;
  salaryViaCash: boolean;
  primaryExecutorId: string;
  secondaryExecutorId: string | null;
  createdAt: string;
  primaryExecutor: { id: string; name: string };
  secondaryExecutor: { id: string; name: string } | null;
};

export const TAX_SYSTEMS = [
  { value: "OSNO", label: "ОСНО" },
  { value: "USN", label: "УСН 6%" },
  { value: "USN15", label: "УСН 15%" },
  { value: "AUSN8", label: "АУСН 8%" },
  { value: "AUSN20", label: "АУСН 20%" },
  { value: "PSN", label: "ПСН" },
  { value: "ESHN", label: "ЕСХН" },
  { value: "PATENT", label: "Патент" },
];

export const LEGAL_FORMS = ["ООО", "ИП", "АО", "ОАО", "ЗАО", "НКО"];

export function taxLabel(value: string): string {
  const found = TAX_SYSTEMS.find((t) => t.value === value);
  return found ? found.label : value;
}

export const TAX_CATEGORIES: { label: string; values: string[] }[] = [
  { label: "АУСН", values: ["AUSN8", "AUSN20"] },
  { label: "УСН", values: ["USN", "USN15"] },
  { label: "ОСНО", values: ["OSNO", "ESHN"] },
  { label: "Патент", values: ["PSN", "PATENT"] },
];

export function taxCategory(value: string): string {
  const cat = TAX_CATEGORIES.find((c) => c.values.includes(value));
  return cat ? cat.label : "Другие";
}

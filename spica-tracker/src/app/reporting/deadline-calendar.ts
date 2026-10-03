export type DeadlineEvent = {
  /** Финальная дата (с учётом переноса из выходного) */
  date: string;
  /** Исходная дата срока до переноса */
  sourceDate: string;
  label: string;
  /** Какие системы налогообложения касаются срок */
  systems: string[];
};

export const CALENDAR_FROM = "2026-10-01";
export const CALENDAR_TO = "2026-10-30";

// Срок, попавший в выходной, переносится на следующий рабочий день
function nextWorkday(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const RAW: { date: string; label: string; systems: string[] }[] = [
  // Октябрь 2026: 25.10 — воскресенье, поэтому сроки уходят на 26.10 (пн)
  {
    date: "2026-10-25",
    label: "НДС: декларация за III квартал",
    systems: ["OSNO", "ESHN"],
  },
  {
    date: "2026-10-25",
    label: "НДС: уплата 1/3 квартала",
    systems: ["OSNO", "ESHN"],
  },
  {
    date: "2026-10-25",
    label: "УСН: уплата аванса (9 мес.)",
    systems: ["USN", "USN15"],
  },
  {
    date: "2026-10-25",
    label: "НДФЛ: аванс ИП (ст. 227.1)",
    systems: ["OSNO"],
  },
  {
    date: "2026-10-25",
    label: "НДФЛ: уведомление из источников выплат (ст. 230)",
    systems: ["OSNO"],
  },
  {
    date: "2026-10-25",
    label: "Уведомления: транспорт, земля, имущество",
    systems: ["OSNO", "USN", "USN15", "AUSN8", "AUSN20", "ESHN"],
  },
  {
    date: "2026-10-28",
    label: "Налог на прибыль: авансовый платёж",
    systems: ["OSNO"],
  },
  {
    date: "2026-10-28",
    label: "Налог на прибыль: декларация (9 мес.)",
    systems: ["OSNO"],
  },
];

export const DEADLINE_EVENTS: DeadlineEvent[] = RAW.map((e) => ({
  ...e,
  sourceDate: e.date,
  date: nextWorkday(e.date),
}))
  .filter((e) => e.date >= CALENDAR_FROM && e.date <= CALENDAR_TO)
  .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

// Группы строк по виду налогообложения (первый столбец календаря)
export const SYSTEM_GROUPS: {
  key: string;
  label: string;
  match: (taxSystem: string) => boolean;
}[] = [
  { key: "OSNO", label: "ОСНО", match: (t) => t === "OSNO" },
  { key: "USN6", label: "УСН 6%", match: (t) => t === "USN" },
  { key: "USN15", label: "УСН 15%", match: (t) => t === "USN15" },
  { key: "AUSN8", label: "АУСН 8%", match: (t) => t === "AUSN8" },
  { key: "AUSN20", label: "АУСН 20%", match: (t) => t === "AUSN20" },
  {
    key: "PSN",
    label: "ПСН (Патент)",
    match: (t) => t === "PSN" || t === "PATENT",
  },
  { key: "ESHN", label: "ЕСХН", match: (t) => t === "ESHN" },
];

export function groupLabel(taxSystem: string): string {
  const g = SYSTEM_GROUPS.find((x) => x.match(taxSystem));
  return g ? g.label : "Другие";
}

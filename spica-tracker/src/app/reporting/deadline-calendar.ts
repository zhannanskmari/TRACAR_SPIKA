export type DeadlineEvent = {
  /** Финальная дата (с учётом переноса из выходного) */
  date: string;
  /** Исходная дата срока до переноса */
  sourceDate: string;
  label: string;
  /** Какие системы налогообложения касаются срок */
  systems: string[];
  /** Тип задачи (REPORT_*) для карточек по этому сроку */
  taskType: string;
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

// Все системы налогообложения (налоговые агенты / работодатели)
const ALL_SYSTEMS = [
  "OSNO",
  "USN",
  "USN15",
  "AUSN8",
  "AUSN20",
  "PSN",
  "PATENT",
  "ESHN",
];

// Основные «имущественные» системы (транспорт, земля, имущество)
const PROPERTY_SYSTEMS = ["OSNO", "USN", "USN15", "AUSN8", "AUSN20", "ESHN"];

// Календарь налоговых сроков на октябрь 2026 (эталон):
// 03.10 (сб) → 05.10 (пн), 15.10 (чт), 25.10 (вс) → 26.10 (пн), 28.10 (ср)
const RAW_EVENTS: {
  date: string;
  label: string;
  systems: string[];
  taskType: string;
}[] = [
  // 5 октября (перенос с 3 октября — выходной)
  {
    date: "2026-10-03",
    label: "НДФЛ: уплата удержанного за период 23–30 сентября",
    systems: ALL_SYSTEMS,
    taskType: "REPORT_NDFL_PAY",
  },
  {
    date: "2026-10-03",
    label: "НДФЛ: уведомление об исчисленных суммах (23–30 сентября)",
    systems: ALL_SYSTEMS,
    taskType: "REPORT_NDFL_NOTICE",
  },

  // 15 октября (четверг)
  {
    date: "2026-10-15",
    label: "Страховые взносы на травматизм за сентябрь — уплата",
    systems: ALL_SYSTEMS,
    taskType: "REPORT_INSURANCE_PAY",
  },

  // 26 октября (перенос с 25 октября — воскресенье)
  {
    date: "2026-10-25",
    label: "6-НДФЛ за 9 месяцев 2026 — подача расчёта",
    systems: ALL_SYSTEMS,
    taskType: "REPORT_NDFL_6",
  },
  {
    date: "2026-10-25",
    label: "Декларация по НДС за III квартал 2026 — подача",
    systems: ["OSNO", "ESHN"],
    taskType: "REPORT_VAT_DECL",
  },
  {
    date: "2026-10-25",
    label: "Декларация по налогу на прибыль за 9 месяцев — подача",
    systems: ["OSNO"],
    taskType: "REPORT_PROFIT_DECL",
  },
  {
    date: "2026-10-25",
    label: "НДФЛ: уведомление об исчисленных суммах за октябрь",
    systems: ALL_SYSTEMS,
    taskType: "REPORT_NDFL_NOTICE",
  },
  {
    date: "2026-10-25",
    label: "УСН: уведомление об авансовом платеже за 9 месяцев",
    systems: ["USN", "USN15"],
    taskType: "REPORT_USN_NOTICE",
  },
  {
    date: "2026-10-25",
    label: "Транспортный налог: уведомление об авансе за III квартал",
    systems: PROPERTY_SYSTEMS,
    taskType: "REPORT_TRANSPORT_NOTICE",
  },
  {
    date: "2026-10-25",
    label: "ПСФ (персонифицированные сведения) за сентябрь — подача",
    systems: ALL_SYSTEMS,
    taskType: "REPORT_PSF",
  },
  {
    date: "2026-10-25",
    label: "ЕФС-1 (сведения о трудовой деятельности) за сентябрь",
    systems: ALL_SYSTEMS,
    taskType: "REPORT_EFS1",
  },
  {
    date: "2026-10-25",
    label: "Налог при АУСН за сентябрь — уплата",
    systems: ["AUSN8", "AUSN20"],
    taskType: "REPORT_AUSN_PAY",
  },

  // 28 октября (среда)
  {
    date: "2026-10-28",
    label: "УСН: уплата авансового платежа за 9 месяцев",
    systems: ["USN", "USN15"],
    taskType: "REPORT_USN_PAY",
  },
  {
    date: "2026-10-28",
    label: "Налог на имущество организаций: аванс за III квартал — уплата",
    systems: ["OSNO", "ESHN"],
    taskType: "REPORT_PROPERTY_PAY",
  },
  {
    date: "2026-10-28",
    label: "Налог на прибыль по итогам 9 месяцев — уплата",
    systems: ["OSNO"],
    taskType: "REPORT_PROFIT_PAY",
  },
  {
    date: "2026-10-28",
    label: "Транспортный налог: аванс за III квартал — уплата",
    systems: PROPERTY_SYSTEMS,
    taskType: "REPORT_TRANSPORT_PAY",
  },
  {
    date: "2026-10-28",
    label: "НДС: третий ежемесячный платёж за III квартал — уплата",
    systems: ["OSNO", "ESHN"],
    taskType: "REPORT_VAT_PAY",
  },
  {
    date: "2026-10-28",
    label: "РСВ (расчёт по страховым взносам) за 9 месяцев — подача",
    systems: ALL_SYSTEMS,
    taskType: "REPORT_RSV",
  },
  {
    date: "2026-10-28",
    label: "Страховые взносы по единому тарифу за сентябрь — уплата",
    systems: ALL_SYSTEMS,
    taskType: "REPORT_INSURANCE_PAY",
  },
];

export const DEADLINE_EVENTS: DeadlineEvent[] = RAW_EVENTS.map((e) => ({
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

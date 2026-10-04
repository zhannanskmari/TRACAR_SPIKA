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
  /**
   * Дополнительный отбор по датам выплаты (аванс/зарплата клиента):
   * PAY_23_30 — дни выплаты с 23 по 30; NOTICE_01_22 — дни с 01 по 22
   */
  daysRule?: "PAY_23_30" | "NOTICE_01_22";
  /** Уведомление по НДФЛ: не подаётся для ИП без сотрудников */
  ndflNotice?: boolean;
  /** Не подавать при количестве сотрудников = 0 */
  skipIfNoEmployees?: boolean;
  /** Срок только для клиентов, в имени которых есть эта строка */
  onlyClient?: string;
  /** Не подавать для ИП без сотрудников */
  skipIfIpWithoutEmployees?: boolean;
  /** Не подавать для НКО без сотрудников */
  skipIfNkoNoEmployees?: boolean;
  /** Только для клиентов с количеством сотрудников больше 0 */
  requireEmployees?: boolean;
  /** Карточка создаётся только вручную: отметка в таблице — по факту
   * существования карточки, а не по правилу срока */
  manualOnly?: boolean;
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

// Уведомления по НДФЛ на АУСН не подаются (НДФЛ считает ФНС)
const NDFL_NOTICE_SYSTEMS = ["OSNO", "USN", "USN15", "PSN", "PATENT", "ESHN"];

// На АУСН не подаются
const NO_AUSN_SYSTEMS = ["OSNO", "USN", "USN15", "PSN", "PATENT", "ESHN"];

// Календарь налоговых сроков на октябрь 2026 (эталон):
// 03.10 (сб) → 05.10 (пн), 15.10 (чт), 25.10 (вс) → 26.10 (пн), 28.10 (ср)
const RAW_EVENTS: {
  date: string;
  label: string;
  systems: string[];
  taskType: string;
  daysRule?: "PAY_23_30" | "NOTICE_01_22";
  ndflNotice?: boolean;
  skipIfNoEmployees?: boolean;
  onlyClient?: string;
  skipIfIpWithoutEmployees?: boolean;
  skipIfNkoNoEmployees?: boolean;
  requireEmployees?: boolean;
  manualOnly?: boolean;
}[] = [
  // 5 октября (перенос с 3 октября — выходной)
  {
    date: "2026-10-03",
    label: "НДФЛ: уплата удержанного за период 23–30 сентября",
    systems: NO_AUSN_SYSTEMS,
    taskType: "REPORT_NDFL_PAY",
    daysRule: "PAY_23_30",
  },
  {
    date: "2026-10-06",
    label: "НДФЛ на АУСН",
    systems: ["AUSN8", "AUSN20"],
    taskType: "REPORT_NDFL_PAY",
    requireEmployees: true,
  },
  {
    date: "2026-10-03",
    label: "НДФЛ: уведомление об исчисленных суммах (23–30 сентября)",
    systems: NDFL_NOTICE_SYSTEMS,
    taskType: "REPORT_NDFL_NOTICE",
    ndflNotice: true,
    skipIfNkoNoEmployees: true,
  },

  // 15 октября (четверг)
  {
    date: "2026-10-15",
    label: "Страховые взносы на травматизм за сентябрь — уплата",
    systems: ALL_SYSTEMS,
    taskType: "REPORT_INSURANCE_PAY",
    skipIfNoEmployees: true,
  },
  {
    date: "2026-10-25",
    label: "НДФЛ: уведомление об исчисленных суммах (01-22.10)",
    systems: NDFL_NOTICE_SYSTEMS,
    taskType: "REPORT_NDFL_NOTICE",
    daysRule: "NOTICE_01_22",
    ndflNotice: true,
    skipIfNkoNoEmployees: true,
  },

  // 27 октября (вторник)
  {
    date: "2026-10-27",
    label: "НДФЛ для АУСН",
    systems: ["AUSN8", "AUSN20"],
    taskType: "REPORT_NDFL_AUSN",
    requireEmployees: true,
  },

  // 26 октября (перенос с 25 октября — воскресенье)
  {
    date: "2026-10-25",
    label: "6-НДФЛ за 9 месяцев 2026 — подача расчёта",
    systems: NO_AUSN_SYSTEMS,
    taskType: "REPORT_NDFL_6",
    skipIfIpWithoutEmployees: true,
  },
  {
    date: "2026-10-25",
    label: "ПСВ за сентябрь",
    systems: NO_AUSN_SYSTEMS,
    taskType: "REPORT_PSF",
    skipIfIpWithoutEmployees: true,
    skipIfNkoNoEmployees: true,
  },
  {
    date: "2026-10-25",
    label: "4-ФСС: ЕФС-1 (сведения о страх.взн. от несч.сл.)",
    systems: NO_AUSN_SYSTEMS,
    taskType: "REPORT_EFS1",
    skipIfIpWithoutEmployees: true,
  },
  {
    date: "2026-10-25",
    label: "РСВ за 9 месяцев",
    systems: NO_AUSN_SYSTEMS,
    taskType: "REPORT_RSV",
    skipIfIpWithoutEmployees: true,
  },
  {
    date: "2026-10-25",
    label: "СЗВ-ТД",
    systems: ALL_SYSTEMS,
    taskType: "REPORT_SZV_TD",
    manualOnly: true,
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
    label: "УСН: уведомление об авансовом платеже за 9 месяцев",
    systems: ["USN", "USN15"],
    taskType: "REPORT_USN_NOTICE",
    skipIfNoEmployees: true,
    skipIfNkoNoEmployees: true,
  },
  {
    date: "2026-10-25",
    label: "Транспортный налог: уведомление об авансе за III квартал",
    systems: PROPERTY_SYSTEMS,
    taskType: "REPORT_TRANSPORT_NOTICE",
    onlyClient: "Солнечная Архитектура",
  },
  {
    date: "2026-10-25",
    label: "Налог при АУСН за сентябрь — уплата",
    systems: ["AUSN8", "AUSN20"],
    taskType: "REPORT_AUSN_PAY",
    skipIfNoEmployees: true,
  },

  // 28 октября (среда)
  {
    date: "2026-10-28",
    label: "УСН: уплата авансового платежа за 9 месяцев",
    systems: ["USN", "USN15"],
    taskType: "REPORT_USN_PAY",
    skipIfNoEmployees: true,
    skipIfNkoNoEmployees: true,
  },
  {
    date: "2026-10-28",
    label: "Транспортный налог: аванс за III квартал — уплата",
    systems: PROPERTY_SYSTEMS,
    taskType: "REPORT_TRANSPORT_PAY",
    onlyClient: "Солнечная Архитектура",
  },
  {
    date: "2026-10-28",
    label: "Налог на прибыль по итогам 9 месяцев — уплата",
    systems: ["OSNO"],
    taskType: "REPORT_PROFIT_PAY",
  },
  {
    date: "2026-10-28",
    label: "НДС: третий ежемесячный платёж за III квартал — уплата",
    systems: ["OSNO", "ESHN"],
    taskType: "REPORT_VAT_PAY",
  },
  {
    date: "2026-10-28",
    label: "НДФЛ: уплата удержанного за период 01–22 октября",
    systems: NO_AUSN_SYSTEMS,
    taskType: "REPORT_NDFL_PAY",
    daysRule: "NOTICE_01_22",
  },
  {
    date: "2026-10-28",
    label: "Страховые взносы по единому тарифу за сентябрь — уплата",
    systems: NO_AUSN_SYSTEMS,
    taskType: "REPORT_INSURANCE_PAY",
    skipIfNoEmployees: true,
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

type ClientDays = {
  name: string;
  taxSystem: string;
  advanceDay?: number | null;
  salaryPaymentDay?: number | null;
  legalForm?: string | null;
  employeeCount?: number | null;
};

function dayIn(
  day: number | null | undefined,
  from: number,
  to: number
): boolean {
  return day != null && day >= from && day <= to;
}

// Попадает ли срок под клиента: система налогообложения + для НДФЛ-правил —
// дни выплаты аванса/зарплаты (день аванса или день ЗП в указанном периоде);
// уведомления по НДФЛ — не для ИП без сотрудников
export function eventAppliesToClient(
  event: DeadlineEvent,
  client: ClientDays
): boolean {
  if (!event.systems.includes(client.taxSystem)) return false;
  if (event.ndflNotice && (client.employeeCount ?? 0) === 0) {
    return false;
  }
  if (event.skipIfNoEmployees && client.employeeCount === 0) return false;
  if (event.onlyClient && !client.name.includes(event.onlyClient)) return false;
  if (
    event.skipIfIpWithoutEmployees &&
    client.legalForm === "ИП" &&
    (client.employeeCount ?? 0) === 0
  ) {
    return false;
  }
  if (
    event.skipIfNkoNoEmployees &&
    client.legalForm === "НКО" &&
    (client.employeeCount ?? 0) === 0
  ) {
    return false;
  }
  if (event.requireEmployees && (client.employeeCount ?? 0) <= 0) {
    return false;
  }
  if (event.daysRule === "PAY_23_30") {
    return (
      dayIn(client.advanceDay, 23, 30) ||
      dayIn(client.salaryPaymentDay, 23, 30)
    );
  }
  if (event.daysRule === "NOTICE_01_22") {
    return (
      dayIn(client.advanceDay, 1, 22) ||
      dayIn(client.salaryPaymentDay, 1, 22)
    );
  }
  return true;
}

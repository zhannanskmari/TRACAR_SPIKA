export const STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "DONE",
  "SENT_TO_CLIENT",
  "REWORK",
  "OVERDUE",
] as const;

export type TaskStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  NEW: "Новые",
  IN_PROGRESS: "В работе",
  DONE: "Выполнено",
  SENT_TO_CLIENT: "Отправлено клиенту",
  REWORK: "На доработке",
  OVERDUE: "Просрочено",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  NEW: "border-zinc-200 bg-zinc-50",
  IN_PROGRESS: "border-blue-200 bg-blue-50",
  DONE: "border-green-200 bg-green-50",
  SENT_TO_CLIENT: "border-violet-200 bg-violet-50",
  REWORK: "border-amber-200 bg-amber-50",
  OVERDUE: "border-red-200 bg-red-50",
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  SALARY_CALC: "Расчёт ЗП",
  SALARY_PAYMENT: "Выплата ЗП",
  TAX_PAYMENT: "Уплата налога",
  REPORT: "Отчётность",
  IFNS_DEMAND: "Требование ИФНС",
  CLIENT_REQUEST: "Запрос клиента",
  PAYMENT_ORDER: "Платежка",
  DIADOK: "Диадок",
  ECP: "ЭЦП",
  NOTIFICATION: "Уведомление",
  BANK_REGISTRY: "Реестр в банк",
  OTHER: "Другое",
};

export const TASK_TYPE_BADGES: Record<string, string> = {
  SALARY_CALC: "bg-emerald-100 text-emerald-700",
  SALARY_PAYMENT: "bg-teal-100 text-teal-700",
  TAX_PAYMENT: "bg-orange-100 text-orange-700",
  REPORT: "bg-indigo-100 text-indigo-700",
  IFNS_DEMAND: "bg-rose-100 text-rose-700",
  CLIENT_REQUEST: "bg-sky-100 text-sky-700",
  PAYMENT_ORDER: "bg-cyan-100 text-cyan-700",
  DIADOK: "bg-violet-100 text-violet-700",
  ECP: "bg-fuchsia-100 text-fuchsia-700",
  NOTIFICATION: "bg-amber-100 text-amber-700",
  BANK_REGISTRY: "bg-lime-100 text-lime-700",
  OTHER: "bg-zinc-100 text-zinc-600",
};

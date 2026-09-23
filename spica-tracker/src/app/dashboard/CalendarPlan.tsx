"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Pencil, X, Check, CircleDot, Loader, RefreshCw, CheckCircle2, Send, AlertTriangle, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { TASK_TYPE_LABELS, STATUS_LABELS } from "@/lib/task-meta";
import { deadlineForDayIso } from "@/lib/dates";

export type CalendarClient = {
  id: string;
  name: string;
  taxSystem: string;
  tasks: CalendarTask[];
};

export type CalendarTask = {
  id: string;
  title: string;
  taskType: string;
  status: string;
  date: string | null;
  deadline: string | null;
  taxPaymentDate: string | null;
  salaryCalcDate: string | null;
  salaryPaymentDate: string | null;
  taxAmount: number | null;
  durationMinutes: number | null;
  factDurationMinutes: number | null;
  startTime: string | null;
  endTime: string | null;
  urgent: boolean;
  createdBy: { id: string; name: string } | null;
  assignedTo: { id: string; name: string; specialization: string | null } | null;
  executor: { id: string; name: string; specialization: string | null } | null;
};

const TASK_TYPES = [
  "SALARY_CALC",
  "SALARY_PAYMENT",
  "TAX_PAYMENT",
  "REPORT",
  "IFNS_DEMAND",
  "CLIENT_REQUEST",
  "PAYMENT_ORDER",
  "DIADOK",
  "ECP",
  "NOTIFICATION",
  "BANK_REGISTRY",
  "CURRENT_ACCOUNT",
  "CASH_DESK",
  "SUPPLIERS",
  "CUSTOMERS",
  "OTHER",
];

// Слоты времени с шагом 30 мин с 10:00 до 20:00
const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const h = String(10 + Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

// Индекс временного слота для времени "ЧЧ:ММ" (вне диапазона — к краю)
function toSlotIndex(time: string | null): number {
  if (!time) return 0;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return 0;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  const idx = Math.floor((minutes - 10 * 60) / 30);
  return Math.min(TIME_SLOTS.length - 1, Math.max(0, idx));
}

const CAL_COLORS: Record<string, { bg: string; text: string; amount: string }> = {
  blue:   { bg: "bg-sky-100",   text: "text-sky-900",   amount: "text-sky-700" },
  green:  { bg: "bg-emerald-100", text: "text-emerald-900", amount: "text-emerald-700" },
  beige:  { bg: "bg-amber-50",  text: "text-amber-900",  amount: "text-amber-700" },
};

// Символ статуса карточки (соответствует статусу задачи)
const STATUS_SYMBOL: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }
> = {
  NEW: { icon: CircleDot, label: "Новое", cls: "text-zinc-500" },
  IN_PROGRESS: { icon: Loader, label: "Ежедневник", cls: "text-blue-500" },
  REWORK: { icon: RefreshCw, label: "На доработке", cls: "text-amber-500" },
  DONE: { icon: CheckCircle2, label: "Выполнено", cls: "text-green-600" },
  SENT_TO_CLIENT: { icon: Send, label: "Отправлено клиенту", cls: "text-violet-500" },
  OVERDUE: { icon: AlertTriangle, label: "Просрочено", cls: "text-red-500" },
};

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join(".")
      .toUpperCase() + "."
  );
}

function cardColor(task: {
  assignedTo: { id: string; name: string } | null;
  taskType: string;
}): { bg: string; text: string; amount: string } {
  const name = task.assignedTo?.name ?? "";
  if (name.includes("Булгакова")) return CAL_COLORS.beige;
  if (name.includes("Анастасия") && task.taskType === "SALARY_CALC") return CAL_COLORS.blue;
  return CAL_COLORS.green;
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Понедельник текущей недели (без времени)
function startOfWeek(d: Date): Date {
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (res.getDay() + 6) % 7; // 0 — понедельник
  res.setDate(res.getDate() - dow);
  return res;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function formatShortDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

// Форматирование суммы с пробелами-разделителями групп, без локали
function formatAmount(n: number): string {
  return n
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function formatDdMm(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

// Карточка календаря с drag-and-drop: бросок в другой день меняет дедлайн.
// memo — чтобы подсветка цели и движение курсора не перерисовывали все карточки.
const DraggableCard = memo(function DraggableCard({
  task,
  clientName,
  dimmed,
  onOpen,
}: {
  task: CalendarTask;
  clientName: string;
  dimmed: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: task.id,
    data: { task, clientName },
  });
  const col = cardColor(task);
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      title={`${task.title}\nТяните в другой день, чтобы перенести. Нажмите, чтобы редактировать`}
      className={`mb-1 block w-full cursor-grab rounded text-left ${col.bg} px-1 py-1 text-[11px] leading-tight transition active:cursor-grabbing ${col.text} hover:ring-2 hover:ring-blue-300 ${
        dimmed ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1">
          {STATUS_SYMBOL[task.status] &&
            (() => {
              const s = STATUS_SYMBOL[task.status];
              const IconCmp = s.icon;
              return (
                <span
                  title={`Статус: ${s.label}`}
                  className={`shrink-0 ${s.cls}`}
                >
                  <IconCmp className="h-3 w-3" />
                </span>
              );
            })()}
          <span className="truncate font-medium">
            {TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
          </span>
          {task.urgent && (
            // срочная задача — значок огонька рядом с типом
            <span title="Срочная задача" className="shrink-0">
              <Flame className="h-3 w-3 text-red-600" />
            </span>
          )}
        </span>
        <Pencil className="h-3 w-3 shrink-0 opacity-40" />
      </div>
      <div className="truncate text-[10px] font-semibold text-zinc-800">
        {clientName}
      </div>
      <div className="line-clamp-2">{task.title}</div>
      {task.executor && (
        <div className="mt-0.5 truncate text-[10px] text-zinc-600">
          Исп — {initials(task.executor.name)}
        </div>
      )}
      {(task.taxAmount != null ||
        task.durationMinutes != null ||
        task.factDurationMinutes != null) && (
        <div className={`font-semibold ${col.amount}`}>
          {task.taxAmount != null && (
            <span>{formatAmount(task.taxAmount)} ₽</span>
          )}
          {task.taxAmount != null &&
            (task.durationMinutes != null ||
              task.factDurationMinutes != null) && <span> · </span>}
          {task.durationMinutes != null && (
            <span>План: {task.durationMinutes} мин</span>
          )}
          {task.durationMinutes != null &&
            task.factDurationMinutes != null && <span> · </span>}
          {task.factDurationMinutes != null && (
            <span>Факт: {task.factDurationMinutes} мин</span>
          )}
        </div>
      )}
      {(task.startTime || task.endTime) && (
        <div className="text-[10px] text-zinc-500">
          Начало: {task.startTime ?? "—"} · Окончание: {task.endTime ?? "—"}
        </div>
      )}
    </button>
  );
});

// Ячейка дня — зона сброса для карточек (id несёт ключ дня).
// Подсветка — из собственного isOver, чтобы не перерисовывать всю таблицу.
const DaySlot = memo(function DaySlot({
  id,
  dayKey,
  weekend,
  children,
}: {
  id: string;
  dayKey: string;
  weekend: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { dayKey } });
  return (
    <td
      ref={setNodeRef}
      className={`border-b px-1 py-1.5 align-top ${
        isOver
          ? "bg-blue-100 ring-2 ring-inset ring-blue-400"
          : weekend
            ? "bg-zinc-50/50"
            : "border-zinc-100"
      }`}
    >
      {children}
    </td>
  );
});

type EditModalProps = {
  task: CalendarTask;
  clientName: string;
  canEditTax: boolean;
  executors: { id: string; name: string; specialization: string | null }[];
  onClose: () => void;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
};

function EditModal({
  task,
  clientName,
  canEditTax,
  executors,
  onClose,
  onSave,
}: EditModalProps) {
  const [title, setTitle] = useState(task.title);
  const [taskType, setTaskType] = useState(task.taskType);
  const [status, setStatus] = useState(task.status);
  const [urgent, setUrgent] = useState(task.urgent);
  const [deadline, setDeadline] = useState(toDateInput(task.deadline));
  const [duration, setDuration] = useState(
    task.durationMinutes != null ? String(task.durationMinutes) : ""
  );
  const [factDuration, setFactDuration] = useState(
    task.factDurationMinutes != null ? String(task.factDurationMinutes) : ""
  );
  const [startTime, setStartTime] = useState(task.startTime ?? "");
  const [endTime, setEndTime] = useState(task.endTime ?? "");
  const [assignedToId, setAssignedToId] = useState(task.assignedTo?.id ?? "");
  const [taxAmount, setTaxAmount] = useState(
    task.taxAmount != null ? String(task.taxAmount) : ""
  );
  const [taxPaymentDate, setTaxPaymentDate] = useState(
    toDateInput(task.taxPaymentDate)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const label = "mb-1 block text-xs font-medium text-zinc-600";
  const input =
    "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Укажите название");
      return;
    }
    setSaving(true);
    setError("");

    const patch: Record<string, unknown> = {};
    if (title.trim() !== task.title) patch.title = title.trim();
    if (taskType !== task.taskType) patch.taskType = taskType;
    if (urgent !== task.urgent) patch.urgent = urgent;

    const oldAssigned = task.assignedTo?.id ?? "";
    if (assignedToId && assignedToId !== oldAssigned) {
      patch.assignedToId = assignedToId;
    }

    const newDuration = duration === "" ? null : Math.max(0, Number(duration));
    const oldDuration = task.durationMinutes ?? null;
    if (
      duration !== "" &&
      newDuration !== null &&
      !isNaN(newDuration) &&
      newDuration !== oldDuration
    ) {
      patch.durationMinutes = Math.round(newDuration);
    } else if (duration === "" && oldDuration !== null) {
      patch.durationMinutes = null;
    }

    const newFact = factDuration === "" ? null : Math.max(0, Number(factDuration));
    const oldFact = task.factDurationMinutes ?? null;
    if (
      factDuration !== "" &&
      newFact !== null &&
      !isNaN(newFact) &&
      newFact !== oldFact
    ) {
      patch.factDurationMinutes = Math.round(newFact);
    } else if (factDuration === "" && oldFact !== null) {
      patch.factDurationMinutes = null;
    }

    if (startTime.trim() !== (task.startTime ?? "")) {
      patch.startTime = startTime.trim() || null;
    }
    if (endTime.trim() !== (task.endTime ?? "")) {
      patch.endTime = endTime.trim() || null;
    }

    const newDeadline = deadline ? new Date(deadline).toISOString() : null;
    const oldDeadline = toDateInput(task.deadline);
    const sentDeadline = oldDeadline
      ? new Date(oldDeadline).toISOString()
      : null;
    // Перенос карточки в колонку выбранной даты: "крайний срок" становится
    // определяющей датой календаря. Если другие даты (уплата налога, зарплата,
    // расчёт зарплаты) оказались раньше нового срока — подтягиваем их к нему,
    // иначе карточка останется в старой колонке.
    const dateFields: Array<"taxPaymentDate" | "salaryPaymentDate" | "salaryCalcDate"> = [
      "taxPaymentDate",
      "salaryPaymentDate",
      "salaryCalcDate",
    ];
    const movedDate = new Date(`${deadline}T00:00:00`);
    for (const f of dateFields) {
      const raw = task[f];
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      if (movedDate.getTime() > d.getTime()) {
        patch[f] = new Date(`${deadline}T00:00:00`).toISOString();
      }
    }
    if (newDeadline !== sentDeadline) patch.deadline = newDeadline;

    if (canEditTax) {
      const newTax = taxAmount === "" ? null : Number(taxAmount);
      const oldTax = task.taxAmount ?? null;
      if (newTax !== oldTax) patch.taxAmount = newTax;

      const newTaxDate = taxPaymentDate
        ? new Date(taxPaymentDate).toISOString()
        : null;
      const oldTaxDate = task.taxPaymentDate ?? null;
      if (newTaxDate !== oldTaxDate) patch.taxPaymentDate = newTaxDate;
    }

    try {
      await onSave(task.id, patch);
      onClose();
    } catch {
      setError("Не удалось сохранить");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-xs text-zinc-500">{clientName}</div>
            <h3 className="text-lg font-semibold text-zinc-900">
              Редактирование задачи
            </h3>
            <div className="mt-1 text-xs text-zinc-500">
              {TASK_TYPE_LABELS[task.taskType] ?? task.taskType} ·{" "}
              {task.date ? formatShortDate(task.date) : "без даты"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Название *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={input}
            />
          </div>
          <div>
            <label className={label}>Тип задачи</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className={input}
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled
              className={`${input} bg-zinc-50 text-zinc-400`}
            >
              <option value={status}>
                {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
              </option>
            </select>
          </div>
          <div>
            <label className={label}>Крайний срок</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={input}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>План, мин</label>
                <input
                  type="number"
                  min="0"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Факт, мин</label>
                <input
                  type="number"
                  min="0"
                  value={factDuration}
                  onChange={(e) => setFactDuration(e.target.value)}
                  className={input}
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Начало</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Окончание</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={input}
                />
              </div>
            </div>
          </div>

          {executors.length > 0 && (
            <div className="sm:col-span-2">
              <label className={label}>Ответственный</label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className={input}
              >
                <option value="">—</option>
                {executors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.specialization
                      ? u.specialization === "SALARY"
                        ? " • ЗП"
                        : " • Налоги"
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canEditTax && (
            <>
              <div>
                <label className={label}>Сумма налога, ₽</label>
                <input
                  type="number"
                  min="0"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Дата уплаты</label>
                <input
                  type="date"
                  value={taxPaymentDate}
                  onChange={(e) => setTaxPaymentDate(e.target.value)}
                  className={input}
                />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => setUrgent(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            Срочная задача
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">
              {error}
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            <X className="h-4 w-4" />
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CalendarPlan({
  clients,
  canEditTax,
  executors,
  onSave,
}: {
  clients: CalendarClient[];
  canEditTax: boolean;
  executors: { id: string; name: string; specialization: string | null }[];
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState<{
    task: CalendarTask;
    clientName: string;
  } | null>(null);

  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [todayKey, setTodayKey] = useState("");

  // Неделя и «сегодня» считаются на клиенте после монтирования,
  // чтобы сервер и клиент не расходились при гидрации
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTodayKey(dayKey(new Date()));
    setWeekStart((prev) => prev ?? startOfWeek(new Date()));
  }, []);

  // Все 7 дней текущей недели: рабочие + выходные
  const days = useMemo(
    () =>
      weekStart
        ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
        : [],
    [weekStart]
  );

  function isWeekend(d: Date): boolean {
    return d.getDay() === 0 || d.getDay() === 6;
  }

  const weekLabel = (() => {
    const two = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    return days.length === 7
      ? `${two(days[0])} – ${two(days[6])}.${days[6].getFullYear()}`
      : "";
  })();

  // Итоговое время (мин) по всем клиентам для каждой даты недели (план и факт)
  const totalByDate = days.map((d) => {
    const k = dayKey(d);
    let plan = 0;
    let fact = 0;
    for (const c of clients) {
      for (const t of c.tasks) {
        if (t.date && dayKey(new Date(t.date)) === k) {
          plan += t.durationMinutes ?? 0;
          // факт — если не прописан, берём план
          fact += t.factDurationMinutes ?? t.durationMinutes ?? 0;
        }
      }
    }
    return { plan, fact };
  });

  const hasAnyTime = totalByDate.some((s) => s.plan > 0 || s.fact > 0);

  // Размещение задач по слотам дня: с указанным временем — в свой слот,
  // без времени — в ближайший свободный слот начиная с 10:00
  const buildDaySlots = useCallback(
    (key: string) => {
      const slots: { task: CalendarTask; clientName: string }[][] = Array.from(
        { length: TIME_SLOTS.length },
        () => []
      );
      const all: { task: CalendarTask; clientName: string }[] = [];
      for (const c of clients) {
        for (const t of c.tasks) {
          if (t.date && dayKey(new Date(t.date)) === key) {
            all.push({ task: t, clientName: c.name });
          }
        }
      }
      const withTime = all
        .filter((x) => x.task.startTime)
        .sort((a, b) =>
          (a.task.startTime ?? "").localeCompare(b.task.startTime ?? "")
        );
      const withoutTime = all.filter((x) => !x.task.startTime);
      for (const item of withTime) {
        slots[toSlotIndex(item.task.startTime)].push(item);
      }
      for (const item of withoutTime) {
        const free = slots.findIndex((s) => s.length === 0);
        if (free === -1) slots[slots.length - 1].push(item);
        else slots[free].push(item);
      }
      return slots;
    },
    [clients]
  );

  // Предвычисленные слоты для каждого дня недели
  const slotsByDay = useMemo(() => {
    const map: Record<
      string,
      { task: CalendarTask; clientName: string }[][]
    > = {};
    for (const d of days) {
      const k = dayKey(d);
      map[k] = buildDaySlots(k);
    }
    return map;
  }, [days, buildDaySlots]);

  // --- Drag-and-drop карточек между днями ---
  // Мышь — сразу (дистанция 6px), тач — с задержкой 250мс, чтобы вертикальный
  // скролл таблицы не превращался в перетаскивание карточки.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );
  const [activeDrag, setActiveDrag] = useState<{
    task: CalendarTask;
    clientName: string;
  } | null>(null);
  const [moveError, setMoveError] = useState("");
  // Клик после реального перетаскивания гасим, чтобы не открывалась модалка
  const dragActiveRef = useRef(false);
  const moveErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (moveErrorTimer.current) clearTimeout(moveErrorTimer.current);
    },
    []
  );

  function showMoveError(text: string) {
    setMoveError(text);
    if (moveErrorTimer.current) clearTimeout(moveErrorTimer.current);
    moveErrorTimer.current = setTimeout(() => setMoveError(""), 4000);
  }

  function handleDragStart(event: DragStartEvent) {
    dragActiveRef.current = true;
    const data = event.active.data.current as
      | { task: CalendarTask; clientName: string }
      | undefined;
    if (data) setActiveDrag({ task: data.task, clientName: data.clientName });
  }

  function clearDrag() {
    setActiveDrag(null);
    window.setTimeout(() => {
      dragActiveRef.current = false;
    }, 100);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const targetKey = over?.data.current?.dayKey as string | undefined;
    const src = active.data.current as
      | { task: CalendarTask; clientName: string }
      | undefined;
    clearDrag();
    if (!targetKey || !src) return;
    const curKey = src.task.date ? dayKey(new Date(src.task.date)) : "";
    if (curKey === targetKey) return; // бросили в тот же день
    const targetDay = days.find((d) => dayKey(d) === targetKey);
    if (!targetDay) return;
    try {
      await onSave(src.task.id, {
        deadline: deadlineForDayIso(src.task.date, targetDay),
      });
    } catch {
      showMoveError("Не удалось перенести карточку");
    }
  }

  function handleDragCancel() {
    clearDrag();
  }

  function handleCardOpen(task: CalendarTask, clientName: string) {
    if (dragActiveRef.current) return;
    setEditing({ task, clientName });
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() =>
              setWeekStart(
                addDays(weekStart ?? startOfWeek(new Date()), -7)
              )
            }
            title="Предыдущая неделя"
            className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Сегодня
          </button>
          <button
            onClick={() =>
              setWeekStart(addDays(weekStart ?? startOfWeek(new Date()), 7))
            }
            title="Следующая неделя"
            className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-2 text-sm font-semibold text-zinc-700">
            {weekLabel}
          </span>
        </div>
      </div>

      {moveError && (
        <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {moveError}
        </div>
      )}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
      <div className="h-full overflow-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full border-collapse">
          <colgroup>
            <col className="w-[44px] min-w-[44px]" />
            {days.map((d, i) => (
              <col
                key={i}
                className={isWeekend(d) ? "w-[44px] min-w-[44px]" : "min-w-[132px]"}
              />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="sticky left-0 z-20 w-[44px] min-w-[44px] border-b border-r border-zinc-200 bg-zinc-50 px-1 py-2 text-left text-xs font-semibold text-zinc-600">
                Время
              </th>
              {days.map((d, i) => {
                const current = dayKey(d) === todayKey;
                const we = isWeekend(d);
                return (
                  <th
                    key={i}
                    className={`border-b border-zinc-200 px-1 py-2 text-center ${
                      we ? "bg-zinc-100/70" : "bg-zinc-50"
                    }`}
                  >
                    <div
                      className={`text-xs font-semibold ${
                        current ? "text-blue-700" : "text-zinc-600"
                      }`}
                    >
                      {WEEKDAYS_SHORT[i % 7]}
                    </div>
                    <div className="text-[11px] font-normal text-zinc-500">
                      {formatDdMm(d)}
                    </div>
                  </th>
                );
              })}
            </tr>
            {hasAnyTime && (
              <tr>
                <th className="sticky left-0 z-20 border-b border-r border-zinc-200 bg-zinc-50 px-3 py-1 text-left text-[11px] font-medium text-zinc-500">
                  Общее время
                </th>
                {totalByDate.map((s, i) => (
                  <td
                    key={i}
                    className="border-b border-zinc-200 bg-zinc-50 px-1 py-1 text-center text-[11px] font-semibold text-zinc-600"
                  >
                    {s.plan > 0 || s.fact > 0
                      ? `План: ${s.plan} · Факт: ${s.fact}`
                      : ""}
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {TIME_SLOTS.map((time, si) => (
              <tr key={time} className="align-top">
                <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-1 py-2 text-xs font-medium text-zinc-600">
                  {time}
                </td>
                {days.map((d, i) => {
                  const k = dayKey(d);
                  const we = isWeekend(d);
                  const items = slotsByDay[k][si];
                  return (
                    <DaySlot
                      key={i}
                      id={`cell:${k}:${si}`}
                      dayKey={k}
                      weekend={we}
                    >
                      {items.map(({ task: t, clientName }) => (
                        <DraggableCard
                          key={t.id}
                          task={t}
                          clientName={clientName}
                          dimmed={activeDrag?.task.id === t.id}
                          onOpen={() => handleCardOpen(t, clientName)}
                        />
                      ))}
                    </DaySlot>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DragOverlay>
        {activeDrag ? (
          <div className="w-40 rounded bg-white px-2 py-1 text-[11px] shadow-xl ring-2 ring-blue-400">
            <div className="truncate font-medium">
              {TASK_TYPE_LABELS[activeDrag.task.taskType] ??
                activeDrag.task.taskType}
            </div>
            <div className="truncate text-zinc-600">
              {activeDrag.clientName}
            </div>
            <div className="line-clamp-2 text-zinc-800">
              {activeDrag.task.title}
            </div>
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>

      {editing && (
        <EditModal
          task={editing.task}
          clientName={editing.clientName}
          canEditTax={canEditTax}
          executors={executors}
          onClose={() => setEditing(null)}
          onSave={onSave}
        />
      )}
    </>
  );
}

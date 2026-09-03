"use client";

import { useMemo, useState } from "react";
import { Pencil, X, Check, CircleDot, Loader, RefreshCw, CheckCircle2, Send, AlertTriangle } from "lucide-react";
import { TASK_TYPE_LABELS, STATUS_LABELS } from "@/lib/task-meta";

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
  taxAmount: number | null;
  durationMinutes: number | null;
  factDurationMinutes: number | null;
  urgent: boolean;
  createdBy: { id: string; name: string } | null;
  assignedTo: { id: string; name: string; specialization: string | null } | null;
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
  "OTHER",
];

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
  IN_PROGRESS: { icon: Loader, label: "В работе", cls: "text-blue-500" },
  REWORK: { icon: RefreshCw, label: "На доработке", cls: "text-amber-500" },
  DONE: { icon: CheckCircle2, label: "Выполнено", cls: "text-green-600" },
  SENT_TO_CLIENT: { icon: Send, label: "Отправлено клиенту", cls: "text-violet-500" },
  OVERDUE: { icon: AlertTriangle, label: "Просрочено", cls: "text-red-500" },
};

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
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

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

    const newDeadline = deadline ? new Date(deadline).toISOString() : null;
    const oldDeadline = toDateInput(task.deadline);
    const sentDeadline = oldDeadline
      ? new Date(oldDeadline).toISOString()
      : null;
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

  const dates = useMemo(() => {
    const set = new Set<string>();
    const all: Date[] = [];
    for (const c of clients) {
      for (const t of c.tasks) {
        if (!t.date) continue;
        const d = new Date(t.date);
        const k = dayKey(d);
        if (!set.has(k)) {
          set.add(k);
          all.push(d);
        }
      }
    }
    all.sort((a, b) => a.getTime() - b.getTime());
    return all;
  }, [clients]);

  if (dates.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Пока нет задач с датами для календарного плана
      </div>
    );
  }

  const dateHeaders = dates.map((d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).toLocaleDateString(
      "ru-RU",
      { day: "2-digit", month: "2-digit" }
    )
  );

  // Итоговое время (мин) по всем клиентам для каждой даты
  const totalByDate = dates.map((d) => {
    const k = dayKey(d);
    let sum = 0;
    for (const c of clients) {
      for (const t of c.tasks) {
        if (t.date && dayKey(new Date(t.date)) === k) {
          sum += t.durationMinutes ?? 0;
        }
      }
    }
    return sum;
  });

  const hasAnyTime = totalByDate.some((s) => s > 0);

  return (
    <>
      <div className="h-full overflow-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="sticky left-0 z-20 min-w-[180px] border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-600">
                Клиент
              </th>
              {dateHeaders.map((h, i) => (
                <th
                  key={i}
                  className="min-w-[90px] border-b border-zinc-200 bg-zinc-50 px-2 py-2 text-center text-xs font-medium text-zinc-600"
                >
                  {h}
                </th>
              ))}
            </tr>
            {hasAnyTime && (
              <tr>
                <th className="sticky left-0 z-20 border-b border-r border-zinc-200 bg-zinc-50 px-3 py-1 text-left text-[11px] font-medium text-zinc-500">
                  Общее время
                </th>
                {totalByDate.map((sum, i) => (
                  <td
                    key={i}
                    className="border-b border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-[11px] font-semibold text-zinc-600"
                  >
                    {sum > 0 ? `${sum} мин` : ""}
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="align-top">
                <td className="sticky left-0 z-10 border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2">
                  <div className="text-sm font-medium text-zinc-800">
                    {client.name}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {client.taxSystem}
                  </div>
                </td>
                {dates.map((d, i) => {
                  const k = dayKey(d);
                  const dayTasks = client.tasks.filter(
                    (t) => t.date && dayKey(new Date(t.date)) === k
                  );
                  return (
                    <td
                      key={i}
                      className="border-b border-zinc-100 px-1.5 py-1.5 align-top"
                    >
                      {dayTasks.map((t) => {
                        const col = cardColor(t);
                        return (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() =>
                              setEditing({ task: t, clientName: client.name })
                            }
                            title={`${t.title}\nНажмите, чтобы редактировать`}
                            className={`mb-1 block w-full rounded text-left ${col.bg} px-1.5 py-1 text-[11px] leading-tight transition ${col.text} hover:ring-2 hover:ring-blue-300`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="flex min-w-0 items-center gap-1">
                                {STATUS_SYMBOL[t.status] &&
                                  (() => {
                                    const s = STATUS_SYMBOL[t.status];
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
                                  {TASK_TYPE_LABELS[t.taskType] ?? t.taskType}
                                </span>
                              </span>
                              <Pencil className="h-3 w-3 shrink-0 opacity-40" />
                            </div>
                            <div className="line-clamp-2">{t.title}</div>
                            {(t.taxAmount != null || t.durationMinutes != null || t.factDurationMinutes != null) && (
                              <div className={`font-semibold ${col.amount}`}>
                                {t.taxAmount != null && (
                                  <span>
                                    {t.taxAmount.toLocaleString("ru-RU")} ₽
                                  </span>
                                )}
                                {(t.taxAmount != null && (t.durationMinutes != null || t.factDurationMinutes != null)) && <span> · </span>}
                                {t.durationMinutes != null && (
                                  <span>План: {t.durationMinutes} мин</span>
                                )}
                                {t.durationMinutes != null && t.factDurationMinutes != null && <span> · </span>}
                                {t.factDurationMinutes != null && (
                                  <span>Факт: {t.factDurationMinutes} мин</span>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

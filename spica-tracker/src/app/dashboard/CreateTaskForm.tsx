"use client";

import { useState } from "react";
import { Plus, X, Flame } from "lucide-react";
import { TASK_TYPE_LABELS } from "@/lib/task-meta";

export type DashboardClient = {
  id: string;
  name: string;
  taxSystem: string;
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

export default function CreateTaskForm({
  clients,
  canEditTax,
  isClient,
  executors,
  onCreated,
}: {
  clients: DashboardClient[];
  canEditTax: boolean;
  isClient: boolean;
  executors: { id: string; name: string; specialization: string | null }[];
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [taskType, setTaskType] = useState("CLIENT_REQUEST");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
  });
  const [urgent, setUrgent] = useState(false);
  const [taxAmount, setTaxAmount] = useState("");
  const [taxPaymentDate, setTaxPaymentDate] = useState("");
  const [assignedToId, setAssignedToId] = useState(
    executors[0]?.id ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Новая задача
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const body: Record<string, unknown> = {
      title,
      clientId,
      taskType,
      urgent,
    };
    if (deadline) body.deadline = new Date(deadline).toISOString();
    if (assignedToId) body.assignedToId = assignedToId;
    if (canEditTax && taxAmount) body.taxAmount = Number(taxAmount);
    if (canEditTax && taxPaymentDate)
      body.taxPaymentDate = new Date(taxPaymentDate).toISOString();

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка создания");
        setSaving(false);
        return;
      }
      // сброс состояния и закрытие формы
      setTitle("");
      setDeadline("");
      setTaxAmount("");
      setTaxPaymentDate("");
      setUrgent(false);
      setDone(true);
      setSaving(false);
      setOpen(false);
      // обновим данные на странице без полной перезагрузки
      onCreated?.();
    } catch {
      setError("Не удалось создать задачу");
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(false)}
        className="flex items-center gap-1.5 rounded-lg bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-300"
      >
        <X className="h-4 w-4" />
        Отменить
      </button>

      <form
        onSubmit={handleSubmit}
        className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg"
      >
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">
          Новая задача
        </h3>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Клиент
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.taxSystem})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Что нужно сделать
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Введите задачу..."
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Тип
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TASK_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Срок
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {!isClient && executors.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Ответственный
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              >
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

          {!isClient && (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-50 px-2 py-1.5 text-xs font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="h-3.5 w-3.5 accent-red-600"
              />
              <Flame className="h-3.5 w-3.5 text-red-500" />
              Срочно
            </label>
          )}

          {canEditTax && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Сумма налога, ₽
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Дата уплаты
                </label>
                <input
                  type="date"
                  value={taxPaymentDate}
                  onChange={(e) => setTaxPaymentDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {done && (
            <p className="rounded-lg bg-green-50 px-2 py-1.5 text-xs text-green-600">
              Задача создана
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Создание..." : "Создать задачу"}
          </button>
        </div>
      </form>
    </div>
  );
}

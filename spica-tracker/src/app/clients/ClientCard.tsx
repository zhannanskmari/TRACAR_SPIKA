"use client";

import { useState } from "react";
import { X, Pencil, Save, LogOut } from "lucide-react";
import {
  LEGAL_FORMS,
  TAX_SYSTEMS,
  taxLabel,
  type Client,
  type Executor,
} from "./client-meta";
import { specSuffix } from "@/lib/specialization";

type EditValues = {
  legalForm: string;
  name: string;
  shortName: string;
  taxSystem: string;
  features: string;
  salaryPaymentDay: string;
  advanceDay: string;
  employeeCount: string;
  invoiceDay: string;
  invoiceAmount: string;
  paymentPeriod: string;
  accountNote: string;
  hasCashRegister: boolean;
  salaryViaCash: boolean;
  primaryExecutorId: string;
  secondaryExecutorId: string;
};

function toValues(c: Client, executors: Executor[]): EditValues {
  return {
    legalForm: c.legalForm ?? "ООО",
    name: c.name.replace(/^(\S+\s)?/, "").trim(),
    shortName: c.shortName ?? "",
    taxSystem: c.taxSystem,
    features: c.features ?? "",
    salaryPaymentDay:
      c.salaryPaymentDay != null ? String(c.salaryPaymentDay) : "",
    advanceDay: c.advanceDay != null ? String(c.advanceDay) : "",
    employeeCount: c.employeeCount != null ? String(c.employeeCount) : "",
    invoiceDay: c.invoiceDay != null ? String(c.invoiceDay) : "",
    invoiceAmount: c.invoiceAmount != null ? String(c.invoiceAmount) : "",
    paymentPeriod: c.paymentPeriod === "QUARTER" ? "QUARTER" : "MONTH",
    accountNote: c.accountNote ?? "",
    hasCashRegister: c.hasCashRegister,
    salaryViaCash: c.salaryViaCash,
    primaryExecutorId: c.primaryExecutorId || executors[0]?.id || "",
    secondaryExecutorId: c.secondaryExecutorId ?? "",
  };
}

function toNumberOrNull(value: string): number | null {
  const t = value.trim();
  if (t === "") return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}

// PATCH на /api/clients/[id] перезаписывает числовые поля значениями из
// body (null очищает), поэтому отправляем все поля целиком.
function toBody(v: EditValues): Record<string, unknown> {
  return {
    name: `${v.legalForm} ${v.name.trim()}`.trim(),
    legalForm: v.legalForm,
    shortName: v.shortName,
    taxSystem: v.taxSystem,
    features: v.features,
    accountNote: v.accountNote,
    hasCashRegister: v.hasCashRegister,
    salaryViaCash: v.salaryViaCash,
    primaryExecutorId: v.primaryExecutorId,
    secondaryExecutorId: v.secondaryExecutorId,
    paymentPeriod: v.paymentPeriod,
    salaryPaymentDay: toNumberOrNull(v.salaryPaymentDay),
    advanceDay: toNumberOrNull(v.advanceDay),
    invoiceDay: toNumberOrNull(v.invoiceDay),
    invoiceAmount: toNumberOrNull(v.invoiceAmount),
    employeeCount: toNumberOrNull(v.employeeCount),
  };
}

export default function ClientCard({
  client,
  executors,
  onClose,
  onSaved,
}: {
  client: Client;
  executors: Executor[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<EditValues>(() =>
    toValues(client, executors)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showFeatures, setShowFeatures] = useState(false);

  const input =
    "w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-blue-500";

  function set<K extends keyof EditValues>(key: K, value: EditValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError("");
    if (!values.name.trim()) {
      setError("Название не может быть пустым");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(values)),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
        setSaving(false);
        return;
      }
      setEditing(false);
      await onSaved();
    } catch {
      setError("Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  }

  type Row = { label: string; view: React.ReactNode; edit: React.ReactNode };

  const dayInput = (key: "salaryPaymentDay" | "advanceDay" | "invoiceDay") => (
    <input
      type="number"
      min="1"
      max="31"
      value={values[key]}
      onChange={(e) => set(key, e.target.value)}
      placeholder="1–31"
      className={input}
    />
  );

  const rows: Row[] = [
    {
      label: "Форма собственности",
      view: client.legalForm ?? "—",
      edit: (
        <select
          value={values.legalForm}
          onChange={(e) => set("legalForm", e.target.value)}
          className={input}
        >
          {LEGAL_FORMS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      ),
    },
    {
      label: "Название",
      view: client.name,
      edit: (
        <input
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Полное название"
          className={input}
        />
      ),
    },
    {
      label: "Краткое название",
      view: client.shortName || "—",
      edit: (
        <input
          value={values.shortName}
          onChange={(e) => set("shortName", e.target.value)}
          placeholder="Краткое название"
          className={input}
        />
      ),
    },
    {
      label: "Вид налогообложения",
      view: taxLabel(client.taxSystem),
      edit: (
        <select
          value={values.taxSystem}
          onChange={(e) => set("taxSystem", e.target.value)}
          className={input}
        >
          {TAX_SYSTEMS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      label: "Особенности",
      view: client.features || "—",
      edit: (
        <textarea
          value={values.features}
          onChange={(e) => set("features", e.target.value)}
          rows={5}
          placeholder="Текстовая информация о клиенте: нюансы работы, договорённости, ограничения..."
          className="w-full resize-y rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
        />
      ),
    },
    {
      label: "Дата выплаты зарплаты (день)",
      view: client.salaryPaymentDay ?? "—",
      edit: dayInput("salaryPaymentDay"),
    },
    {
      label: "Дата аванса (день)",
      view: client.advanceDay ?? "—",
      edit: dayInput("advanceDay"),
    },
    {
      label: "Кол-во сотрудников",
      view: client.employeeCount ?? "—",
      edit: (
        <input
          type="number"
          min="0"
          value={values.employeeCount}
          onChange={(e) => set("employeeCount", e.target.value)}
          placeholder="0"
          className={input}
        />
      ),
    },
    {
      label: "Дата выписки счёта (день)",
      view: client.invoiceDay ?? "—",
      edit: dayInput("invoiceDay"),
    },
    {
      label: "Сумма счёта, ₽",
      view:
        client.invoiceAmount != null
          ? `${client.invoiceAmount.toLocaleString("ru-RU")} ₽`
          : "—",
      edit: (
        <input
          type="number"
          min="0"
          step="0.01"
          value={values.invoiceAmount}
          onChange={(e) => set("invoiceAmount", e.target.value)}
          placeholder="0.00"
          className={input}
        />
      ),
    },
    {
      label: "Оплата за месяц или за квартал",
      view: client.paymentPeriod === "QUARTER" ? "За квартал" : "За месяц",
      edit: (
        <select
          value={values.paymentPeriod}
          onChange={(e) => set("paymentPeriod", e.target.value)}
          className={input}
        >
          <option value="MONTH">За месяц</option>
          <option value="QUARTER">За квартал</option>
        </select>
      ),
    },
    {
      label: "Расч. счёт (присылает или авто)",
      view: client.accountNote || "—",
      edit: (
        <input
          value={values.accountNote}
          onChange={(e) => set("accountNote", e.target.value)}
          placeholder="Например: присылает клиент / авто"
          className={input}
        />
      ),
    },
    {
      label: "Касса есть",
      view: client.hasCashRegister ? "Да" : "Нет",
      edit: (
        <input
          type="checkbox"
          checked={values.hasCashRegister}
          onChange={(e) => set("hasCashRegister", e.target.checked)}
          className="h-4 w-4 accent-blue-600"
        />
      ),
    },
    {
      label: "ЗП через кассу",
      view: client.salaryViaCash ? "Да" : "Нет",
      edit: (
        <input
          type="checkbox"
          checked={values.salaryViaCash}
          onChange={(e) => set("salaryViaCash", e.target.checked)}
          className="h-4 w-4 accent-blue-600"
        />
      ),
    },
    {
      label: "Глав. исполнитель",
      view: client.primaryExecutor?.name ?? "—",
      edit: (
        <select
          value={values.primaryExecutorId}
          onChange={(e) => set("primaryExecutorId", e.target.value)}
          className={input}
        >
          {executors.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {specSuffix(u.specialization)}
            </option>
          ))}
        </select>
      ),
    },
    {
      label: "Второй исполнитель",
      view: client.secondaryExecutor?.name ?? "—",
      edit: (
        <select
          value={values.secondaryExecutorId}
          onChange={(e) => set("secondaryExecutorId", e.target.value)}
          className={input}
        >
          <option value="">—</option>
          {executors.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {specSuffix(u.specialization)}
            </option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative my-8 w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Карточка клиента
              </div>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setShowFeatures(!showFeatures)}
                  className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
                >
                  Особенности
                </button>
              )}
            </div>
            <div className="text-lg font-semibold text-zinc-900">
              {client.name}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {showFeatures && (
            <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="mb-1 text-xs font-semibold text-zinc-600">
                Особенности клиента
              </div>
              <div className="whitespace-pre-wrap text-sm text-zinc-800">
                {client.features || "—"}
              </div>
            </div>
          )}
          <table className="w-full border-collapse text-sm">
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    {row.label}
                  </td>
                  <td className="border-b border-zinc-100 py-2 text-zinc-900">
                    {editing ? row.edit : row.view}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-5 py-4">
          <button
            type="button"
            disabled={editing}
            onClick={() => {
              setError("");
              setShowFeatures(false);
              // значения формы берем из актуальных данных клиента
              setValues(toValues(client, executors));
              setEditing(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40"
          >
            <Pencil className="h-4 w-4" />
            Внести изменения
          </button>
          <button
            type="button"
            disabled={!editing || saving}
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            {saving ? "Сохранение..." : "Сохранить изменения"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </footer>
      </div>
    </div>
  );
}

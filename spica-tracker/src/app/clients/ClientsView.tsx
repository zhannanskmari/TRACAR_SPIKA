"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  ArrowLeft,
  Plus,
  Building2,
  Pencil,
  X,
} from "lucide-react";

const TAX_SYSTEMS = [
  { value: "OSNO", label: "ОСНО" },
  { value: "USN", label: "УСН 6%" },
  { value: "USN15", label: "УСН 15%" },
  { value: "AUSN8", label: "АУСН 8%" },
  { value: "AUSN20", label: "АУСН 20%" },
  { value: "PSN", label: "ПСН" },
  { value: "ESHN", label: "ЕСХН" },
  { value: "PATENT", label: "Патент" },
];

const LEGAL_FORMS = ["ООО", "ИП", "АО", "ОАО", "ЗАО", "НКО"];

function taxLabel(value: string): string {
  const found = TAX_SYSTEMS.find((t) => t.value === value);
  return found ? found.label : value;
}

type Executor = {
  id: string;
  name: string;
  specialization: string | null;
};

type Client = {
  id: string;
  name: string;
  taxSystem: string;
  legalForm: string | null;
  shortName: string | null;
  salaryPaymentDay: number | null;
  advanceDay: number | null;
  employeeCount: number | null;
  invoiceDay: number | null;
  accountNote: string | null;
  hasCashRegister: boolean;
  salaryViaCash: boolean;
  primaryExecutorId: string;
  secondaryExecutorId: string | null;
  createdAt: string;
  primaryExecutor: { id: string; name: string };
  secondaryExecutor: { id: string; name: string } | null;
};

export default function ClientsView({
  adminName,
  clients: initialClients,
  executors,
}: {
  adminName: string;
  clients: Client[];
  executors: Executor[];
}) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [legalForm, setLegalForm] = useState("ООО");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [taxSystem, setTaxSystem] = useState("USN");
  const [salaryPaymentDay, setSalaryPaymentDay] = useState("");
  const [advanceDay, setAdvanceDay] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [invoiceDay, setInvoiceDay] = useState("");
  const [accountNote, setAccountNote] = useState("");
  const [hasCashRegister, setHasCashRegister] = useState(false);
  const [salaryViaCash, setSalaryViaCash] = useState(false);
  const [primaryExecutorId, setPrimaryExecutorId] = useState(
    executors[0]?.id ?? ""
  );
  const [secondaryExecutorId, setSecondaryExecutorId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function fillForm(c: Client) {
    setLegalForm(c.legalForm ?? "ООО");
    setName(c.name.replace(/^(\S+\s)?/, "").trim());
    setShortName(c.shortName ?? "");
    setTaxSystem(c.taxSystem);
    setSalaryPaymentDay(c.salaryPaymentDay != null ? String(c.salaryPaymentDay) : "");
    setAdvanceDay(c.advanceDay != null ? String(c.advanceDay) : "");
    setEmployeeCount(c.employeeCount != null ? String(c.employeeCount) : "");
    setInvoiceDay(c.invoiceDay != null ? String(c.invoiceDay) : "");
    setAccountNote(c.accountNote ?? "");
    setHasCashRegister(c.hasCashRegister);
    setSalaryViaCash(c.salaryViaCash);
    setPrimaryExecutorId(c.primaryExecutorId || executors[0]?.id || "");
    setSecondaryExecutorId(c.secondaryExecutorId ?? "");
  }

  function resetForm() {
    setLegalForm("ООО");
    setName("");
    setShortName("");
    setTaxSystem("USN");
    setSalaryPaymentDay("");
    setAdvanceDay("");
    setEmployeeCount("");
    setInvoiceDay("");
    setAccountNote("");
    setHasCashRegister(false);
    setSalaryViaCash(false);
    setPrimaryExecutorId(executors[0]?.id ?? "");
    setSecondaryExecutorId("");
  }

  async function refreshClients() {
    const res = await fetch("/api/clients");
    if (res.ok) {
      const data = await res.json();
      setClients(data.clients);
    } else {
      router.refresh();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const body: Record<string, unknown> = {
      name: `${legalForm} ${name.trim()}`.trim(),
      legalForm,
      shortName,
      taxSystem,
      accountNote,
      hasCashRegister,
      salaryViaCash,
      primaryExecutorId,
    };
    if (salaryPaymentDay) body.salaryPaymentDay = Number(salaryPaymentDay);
    if (advanceDay) body.advanceDay = Number(advanceDay);
    if (invoiceDay) body.invoiceDay = Number(invoiceDay);
    if (employeeCount) body.employeeCount = Number(employeeCount);
    if (secondaryExecutorId) body.secondaryExecutorId = secondaryExecutorId;

    const isEdit = !!editingId;

    try {
      const res = await fetch(
        isEdit ? `/api/clients/${editingId}` : "/api/clients",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
        setSaving(false);
        return;
      }
      await refreshClients();
      setSuccess(isEdit ? "Данные клиента обновлены" : "Клиент добавлен");
      setEditingId(null);
      setOpen(false);
      resetForm();
      setSaving(false);
    } catch {
      setError("Не удалось сохранить клиента");
      setSaving(false);
    }
  }

  function startEdit(c: Client) {
    setError("");
    setSuccess("");
    setEditingId(c.id);
    fillForm(c);
    setOpen(true);
  }

  function startCreate() {
    setError("");
    setSuccess("");
    setEditingId(null);
    resetForm();
    setOpen(true);
  }

  const label = "mb-1 block text-xs font-medium text-zinc-600";
  const input =
    "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500";

  return (
    <div className="flex min-h-full flex-col bg-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-bold text-zinc-900">Спика</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            Клиенты
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="font-medium text-zinc-900">{adminName}</div>
            <div className="text-xs text-zinc-500">Руководитель</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-base font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <ArrowLeft className="h-5 w-5" />
              На доску
            </button>
            <h1 className="text-xl font-semibold text-zinc-900">
              Клиенты ({clients.length})
            </h1>
          </div>
          <button
            onClick={() => (open && !editingId ? setOpen(false) : startCreate())}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {open && !editingId ? "Скрыть форму" : "Новый клиент"}
          </button>
        </div>

        {open && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 grid grid-cols-1 gap-x-4 gap-y-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="sm:col-span-2 lg:col-span-4 -mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-800">
                {editingId ? "Редактирование клиента" : "Новый клиент"}
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setOpen(false);
                    resetForm();
                  }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                >
                  <X className="h-3.5 w-3.5" />
                  Отмена
                </button>
              )}
            </div>
            <div>
              <label className={label}>Форма собственности</label>
              <select
                value={legalForm}
                onChange={(e) => setLegalForm(e.target.value)}
                className={input}
              >
                {LEGAL_FORMS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Название *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Полное название"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Краткое название</label>
              <input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="Краткое название"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Вид налогообложения *</label>
              <select
                value={taxSystem}
                onChange={(e) => setTaxSystem(e.target.value)}
                className={input}
              >
                {TAX_SYSTEMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Дата выплаты зарплаты (день)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={salaryPaymentDay}
                onChange={(e) => setSalaryPaymentDay(e.target.value)}
                placeholder="1–31"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Дата аванса (день)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={advanceDay}
                onChange={(e) => setAdvanceDay(e.target.value)}
                placeholder="1–31"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Кол-во сотрудников</label>
              <input
                type="number"
                min="0"
                value={employeeCount}
                onChange={(e) => setEmployeeCount(e.target.value)}
                placeholder="0"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Дата выписки счёта (день)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={invoiceDay}
                onChange={(e) => setInvoiceDay(e.target.value)}
                placeholder="1–31"
                className={input}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Расч. счёт (присылает или авто)</label>
              <input
                value={accountNote}
                onChange={(e) => setAccountNote(e.target.value)}
                placeholder="Например: присылает клиент / авто"
                className={input}
              />
            </div>
            <div className="flex flex-col justify-end gap-1.5">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={hasCashRegister}
                  onChange={(e) => setHasCashRegister(e.target.checked)}
                  className="h-4 w-4 accent-blue-600"
                />
                Касса есть
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={salaryViaCash}
                  onChange={(e) => setSalaryViaCash(e.target.checked)}
                  className="h-4 w-4 accent-blue-600"
                />
                ЗП через кассу
              </label>
            </div>
            <div>
              <label className={label}>Глав. исполнитель</label>
              <select
                value={primaryExecutorId}
                onChange={(e) => setPrimaryExecutorId(e.target.value)}
                className={input}
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
            <div>
              <label className={label}>Второй исполнитель</label>
              <select
                value={secondaryExecutorId}
                onChange={(e) => setSecondaryExecutorId(e.target.value)}
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

            {error && (
              <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600 sm:col-span-2">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-lg bg-green-50 px-2 py-1.5 text-xs text-green-600 sm:col-span-2">
                {success}
              </p>
            )}

            <div className="sm:col-span-2 lg:col-span-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
              >
                {saving
                  ? "Сохранение..."
                  : editingId
                    ? "Сохранить изменения"
                    : "Добавить клиента"}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs font-semibold text-zinc-600">
                <th className="border-b border-r border-zinc-200 px-3 py-2">Клиент</th>
                <th className="border-b border-r border-zinc-200 px-3 py-2">Налогооб.</th>
                <th className="border-b border-r border-zinc-200 px-3 py-2">ЗП / аванс</th>
                <th className="border-b border-r border-zinc-200 px-3 py-2">Сотр.</th>
                <th className="border-b border-r border-zinc-200 px-3 py-2">Счёт / выписка</th>
                <th className="border-b border-r border-zinc-200 px-3 py-2">Касса</th>
                <th className="border-b border-r border-zinc-200 px-3 py-2">Исполнители</th>
                <th className="border-b px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-zinc-400"
                  >
                    Клиентов пока нет
                  </td>
                </tr>
              )}
              {clients.map((c) => (
                <tr key={c.id} className="align-top hover:bg-zinc-50">
                  <td className="border-b border-r border-zinc-100 px-3 py-2">
                    <div className="font-medium text-zinc-900">{c.name}</div>
                    {c.shortName && (
                      <div className="text-xs text-zinc-500">{c.shortName}</div>
                    )}
                  </td>
                  <td className="border-b border-r border-zinc-100 px-3 py-2">
                    {taxLabel(c.taxSystem)}
                  </td>
                  <td className="border-b border-r border-zinc-100 px-3 py-2 text-xs">
                    <div>ЗП: {c.salaryPaymentDay ?? "—"}-го</div>
                    <div>Аванс: {c.advanceDay ?? "—"}-го</div>
                  </td>
                  <td className="border-b border-r border-zinc-100 px-3 py-2">
                    {c.employeeCount ?? "—"}
                  </td>
                  <td className="border-b border-r border-zinc-100 px-3 py-2 text-xs">
                    <div>Счёт: {c.invoiceDay ? `${c.invoiceDay}-го` : "—"}</div>
                    {c.accountNote && (
                      <div className="text-zinc-500">{c.accountNote}</div>
                    )}
                  </td>
                  <td className="border-b border-r border-zinc-100 px-3 py-2 text-xs">
                    <div>{c.hasCashRegister ? "Есть" : "Нет"}</div>
                    {c.salaryViaCash && <div>ЗП через кассу</div>}
                  </td>
                  <td className="border-b border-r border-zinc-100 px-3 py-2 text-xs">
                    <div>{c.primaryExecutor.name}</div>
                    {c.secondaryExecutor && (
                      <div className="text-zinc-500">{c.secondaryExecutor.name}</div>
                    )}
                  </td>
                  <td className="border-b px-3 py-2 text-right">
                    <button
                      onClick={() => startEdit(c)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Изменить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

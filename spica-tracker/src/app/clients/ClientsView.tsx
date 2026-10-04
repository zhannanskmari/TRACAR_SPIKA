"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  ArrowLeft,
  Plus,
  Building2,
  X,
  Banknote,
  FileText,
  CalendarPlus,
} from "lucide-react";
import { specSuffix } from "@/lib/specialization";
import ClientCard from "./ClientCard";
import {
  LEGAL_FORMS,
  TAX_CATEGORIES,
  TAX_SYSTEMS,
  taxCategory,
  taxLabel,
  type Client,
  type Executor,
} from "./client-meta";

// Первые n слов текста — для превью особенностей в списке клиентов
function firstWords(text: string, n: number): string {
  return text.trim().split(/\s+/).slice(0, n).join(" ");
}

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
  const [viewingId, setViewingId] = useState<string | null>(null);

  const [legalForm, setLegalForm] = useState("ООО");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [taxSystem, setTaxSystem] = useState("USN");
  const [salaryPaymentDay, setSalaryPaymentDay] = useState("");
  const [advanceDay, setAdvanceDay] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [invoiceDay, setInvoiceDay] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [paymentPeriod, setPaymentPeriod] = useState("MONTH");
  const [accountNote, setAccountNote] = useState("");
  const [hasCashRegister, setHasCashRegister] = useState(false);
  const [salaryViaCash, setSalaryViaCash] = useState(false);
  const [primaryExecutorId, setPrimaryExecutorId] = useState(
    executors[0]?.id ?? ""
  );
  const [secondaryExecutorId, setSecondaryExecutorId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [creatingEntries, setCreatingEntries] = useState(false);

  // Создать карточки по всем клиентам по всем срокам таблицы отчётности
  async function handleCreateReportingEntries() {
    if (creatingEntries) return;
    if (
      !window.confirm(
        "Создать карточки по таблице отчётности для всех клиентов?\n" +
          "Ответственный — Анастасия, план — 30 мин. Уже созданные сроки не дублируются."
      )
    ) {
      return;
    }
    setCreatingEntries(true);
    try {
      const res = await fetch("/api/reporting/create-entries", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Не удалось создать карточки");
        return;
      }
      alert(
        `Создано карточек: ${data.created}\n` +
          `Пропущено (уже есть): ${data.skipped}\n` +
          `Всего сроков по клиентам: ${data.total}`
      );
    } catch {
      alert("Ошибка сети при создании карточек");
    } finally {
      setCreatingEntries(false);
    }
  }
  const [success, setSuccess] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // При открытии формы подтягиваем её в зону видимости
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  }, [open, editingId]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
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
    setInvoiceAmount("");
    setPaymentPeriod("MONTH");
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
    if (invoiceAmount) body.invoiceAmount = Number(invoiceAmount);
    body.paymentPeriod = paymentPeriod;
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

  function startCreate() {
    setError("");
    setSuccess("");
    setEditingId(null);
    resetForm();
    setOpen(true);
  }

  const input =
    "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500";

  const categories = TAX_CATEGORIES.map((cat) => ({
    ...cat,
    clients: clients.filter((c) => taxCategory(c.taxSystem) === cat.label),
  })).filter((cat) => cat.clients.length > 0);
  const otherClients = clients.filter((c) => taxCategory(c.taxSystem) === "Другие");
  const viewingClient = clients.find((c) => c.id === viewingId) ?? null;

  const renderClientRow = (c: Client) => (
    <tr
      key={c.id}
      onClick={() => setViewingId(c.id)}
      className="align-top cursor-pointer hover:bg-zinc-50"
    >
      <td className="border-b border-r border-zinc-100 px-3 py-2">
        <div className="font-medium text-zinc-900">{c.name}</div>
        {c.shortName && (
          <div className="text-xs text-zinc-500">{c.shortName}</div>
        )}
        {c.features && (
          <div className="mt-0.5 line-clamp-2 text-xs italic text-zinc-500">
            {firstWords(c.features, 10)}
          </div>
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
        <div className="text-zinc-500">
          {c.paymentPeriod === "QUARTER" ? "за квартал" : "за месяц"}
        </div>
        {c.invoiceAmount != null && (
          <div className="font-medium text-zinc-700">
            {c.invoiceAmount.toLocaleString("ru-RU")} ₽
          </div>
        )}
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
    </tr>
  );

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/reporting")}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <FileText className="h-4 w-4" />
              Отчётность
            </button>
            <button
              onClick={handleCreateReportingEntries}
              disabled={creatingEntries}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-100 disabled:opacity-60"
            >
              <CalendarPlus className="h-4 w-4" />
              {creatingEntries
                ? "Создание…"
                : "Создать записи по таблице отчётности"}
            </button>
            <button
              onClick={() => router.push("/dashboard?tab=payments")}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <Banknote className="h-4 w-4" />
              Оплаты
            </button>
            <button
              onClick={() => (open && !editingId ? setOpen(false) : startCreate())}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              {open && !editingId ? "Скрыть форму" : "Новый клиент"}
            </button>
          </div>
        </div>

        {open && (
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="mb-6 rounded-xl border border-zinc-200 bg-white p-4"
          >
            <div className="mb-2 flex items-center justify-between">
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
            {/* Вертикальная таблица «поле» — как в карточке просмотра */}
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Форма собственности
                  </td>
                  <td className="border-b border-zinc-100 py-2">
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
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Название *
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Полное название"
                      className={input}
                    />
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Краткое название
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <input
                      value={shortName}
                      onChange={(e) => setShortName(e.target.value)}
                      placeholder="Краткое название"
                      className={input}
                    />
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Вид налогообложения *
                  </td>
                  <td className="border-b border-zinc-100 py-2">
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
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Дата выплаты зарплаты (день)
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={salaryPaymentDay}
                      onChange={(e) => setSalaryPaymentDay(e.target.value)}
                      placeholder="1–31"
                      className={input}
                    />
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Дата аванса (день)
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={advanceDay}
                      onChange={(e) => setAdvanceDay(e.target.value)}
                      placeholder="1–31"
                      className={input}
                    />
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Кол-во сотрудников
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <input
                      type="number"
                      min="0"
                      value={employeeCount}
                      onChange={(e) => setEmployeeCount(e.target.value)}
                      placeholder="0"
                      className={input}
                    />
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Дата выписки счёта (день)
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={invoiceDay}
                      onChange={(e) => setInvoiceDay(e.target.value)}
                      placeholder="1–31"
                      className={input}
                    />
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Сумма счёта, ₽
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(e.target.value)}
                      placeholder="0.00"
                      className={input}
                    />
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Оплата за месяц или за квартал
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <select
                      value={paymentPeriod}
                      onChange={(e) => setPaymentPeriod(e.target.value)}
                      className={input}
                    >
                      <option value="MONTH">За месяц</option>
                      <option value="QUARTER">За квартал</option>
                    </select>
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Расч. счёт (присылает или авто)
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <input
                      value={accountNote}
                      onChange={(e) => setAccountNote(e.target.value)}
                      placeholder="Например: присылает клиент / авто"
                      className={input}
                    />
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Касса есть
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <input
                      type="checkbox"
                      checked={hasCashRegister}
                      onChange={(e) => setHasCashRegister(e.target.checked)}
                      className="h-4 w-4 accent-blue-600"
                    />
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    ЗП через кассу
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <input
                      type="checkbox"
                      checked={salaryViaCash}
                      onChange={(e) => setSalaryViaCash(e.target.checked)}
                      className="h-4 w-4 accent-blue-600"
                    />
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Глав. исполнитель
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <select
                      value={primaryExecutorId}
                      onChange={(e) => setPrimaryExecutorId(e.target.value)}
                      className={input}
                    >
                      {executors.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                          {specSuffix(u.specialization)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                <tr className="align-middle">
                  <td className="w-1/2 border-b border-zinc-100 py-2 pr-4 text-zinc-500">
                    Второй исполнитель
                  </td>
                  <td className="border-b border-zinc-100 py-2">
                    <select
                      value={secondaryExecutorId}
                      onChange={(e) => setSecondaryExecutorId(e.target.value)}
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
                  </td>
                </tr>
              </tbody>
            </table>

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
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center text-zinc-400"
                  >
                    Клиентов пока нет
                  </td>
                </tr>
              )}
              {categories.map((cat) => (
                <Fragment key={cat.label}>
                  <tr className="bg-blue-50">
                    <td
                      colSpan={7}
                      className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-700"
                    >
                      {cat.label} ({cat.clients.length})
                    </td>
                  </tr>
                  {cat.clients.map(renderClientRow)}
                </Fragment>
              ))}
              {otherClients.length > 0 && (
                <Fragment>
                  <tr className="bg-blue-50">
                    <td
                      colSpan={7}
                      className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-700"
                    >
                      Другие ({otherClients.length})
                    </td>
                  </tr>
                  {otherClients.map(renderClientRow)}
                </Fragment>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {viewingClient && (
        <ClientCard
          client={viewingClient}
          executors={executors}
          onClose={() => setViewingId(null)}
          onSaved={refreshClients}
        />
      )}
    </div>
  );
}

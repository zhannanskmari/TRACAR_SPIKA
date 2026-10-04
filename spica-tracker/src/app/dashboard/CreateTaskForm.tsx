"use client";

import { useEffect, useState } from "react";
import { Plus, X, Flame } from "lucide-react";
import { addBusinessDays } from "@/lib/dates";
import { specSuffix } from "@/lib/specialization";
import TaskTypeSelect from "@/app/dashboard/TaskTypeSelect";

export type DashboardClient = {
  id: string;
  name: string;
  shortName: string | null;
  taxSystem: string;
};

const TASK_TYPES = [
  "SALARY_CALC",
  "SALARY_PAYMENT",
  "SALARY_ADVANCE",
  "SALARY_SICK_LEAVE",
  "SALARY_VACATION",
  "SALARY_BONUS",
  "REPORT",
  "REPORT_VAT_DECL",
  "REPORT_VAT_PAY",
  "REPORT_PROFIT_DECL",
  "REPORT_PROFIT_PAY",
  "REPORT_NDFL_6",
  "REPORT_NDFL_PAY",
  "REPORT_NDFL_NOTICE",
  "REPORT_USN_NOTICE",
  "REPORT_USN_PAY",
  "REPORT_TRANSPORT_NOTICE",
  "REPORT_TRANSPORT_PAY",
  "REPORT_PROPERTY_PAY",
  "REPORT_INSURANCE_PAY",
  "REPORT_RSV",
  "REPORT_EFS1",
  "REPORT_PSF",
  "REPORT_SZV_TD",
  "REPORT_AUSN_PAY",
  "REPORT_NDFL_AUSN",
  "IFNS_DEMAND",
  "DEMAND_RECEIPT",
  "CLIENT_REQUEST",
  "PAYMENT_ORDER",
  "DIADOK",
  "ECP",
  "NOTIFICATION",
  "BANK_REGISTRY",
  "INVOICE",
  "INVOICE_PAYMENT",
  "CURRENT_ACCOUNT",
  "CASH_DESK",
  "SUPPLIERS",
  "CUSTOMERS",
  "OTHER",
];

export default function CreateTaskForm({
  clients,
  canEditTax,
  isClient,
  executors,
  currentUserId,
  onCreated,
}: {
  clients: DashboardClient[];
  canEditTax: boolean;
  isClient: boolean;
  executors: { id: string; name: string; specialization: string | null }[];
  currentUserId?: string;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [taskType, setTaskType] = useState("CLIENT_REQUEST");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    // РЎРµРіРѕРґРЅСЏС€РЅСЏСЏ РґР°С‚Р° РІС‹С‡РёСЃР»СЏРµС‚СЃСЏ РЅР° РєР»РёРµРЅС‚Рµ, С‡С‚РѕР±С‹ SSR Рё РіРёРґСЂР°С†РёСЏ РЅРµ СЂР°СЃС…РѕРґРёР»РёСЃСЊ
    const d = new Date();
    const offset = d.getTimezoneOffset();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeadline(
      (prev) => prev || new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10)
    );
  }, []);
  const [receiptDeadline, setReceiptDeadline] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [taxAmount, setTaxAmount] = useState("");
  const [taxPaymentDate, setTaxPaymentDate] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [assignedToId, setAssignedToId] = useState(defaultAssignee());
  const [executorId, setExecutorId] = useState("");
  const [duration, setDuration] = useState("");
  const [factDuration, setFactDuration] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // РћС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Р№ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ вЂ” СЃР°Рј СЃРѕР·РґР°С‚РµР»СЊ (РµСЃР»Рё РѕРЅ РІ СЃРїРёСЃРєРµ РёСЃРїРѕР»РЅРёС‚РµР»РµР№),
  // РёРЅР°С‡Рµ РїРµСЂРІС‹Р№ РёСЃРїРѕР»РЅРёС‚РµР»СЊ. РРЅР°С‡Рµ РєР°СЂС‚РѕС‡РєР°, СЃРѕР·РґР°РЅРЅР°СЏ РёСЃРїРѕР»РЅРёС‚РµР»РµРј, СѓС…РѕРґРёС‚
  // С‡СѓР¶РѕРјСѓ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕРјСѓ Рё СЃРѕР·РґР°С‚РµР»СЊ РµС‘ РЅРµ РІРёРґРёС‚.
  function defaultAssignee(): string {
    if (currentUserId && executors.some((e) => e.id === currentUserId)) {
      return currentUserId;
    }
    return executors[0]?.id ?? "";
  }

  const isInvoiceType = taskType === "INVOICE" || taskType === "INVOICE_PAYMENT";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        РќРѕРІР°СЏ Р·Р°РґР°С‡Р°
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
    if (receiptDeadline)
      body.receiptDeadline = new Date(receiptDeadline).toISOString();
    if (assignedToId) body.assignedToId = assignedToId;
    if (executorId) body.executorId = executorId;
    if (duration !== "" && !isNaN(Number(duration)))
      body.durationMinutes = Math.max(0, Math.round(Number(duration)));
    if (factDuration !== "" && !isNaN(Number(factDuration)))
      body.factDurationMinutes = Math.max(0, Math.round(Number(factDuration)));
    if (canEditTax && taxAmount) body.taxAmount = Number(taxAmount);
    if (canEditTax && taxPaymentDate)
      body.taxPaymentDate = new Date(taxPaymentDate).toISOString();
    if (isInvoiceType && invoiceAmount) body.amount = Number(invoiceAmount);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ");
        setSaving(false);
        return;
      }
      // СЃР±СЂРѕСЃ СЃРѕСЃС‚РѕСЏРЅРёСЏ Рё Р·Р°РєСЂС‹С‚РёРµ С„РѕСЂРјС‹
      resetForm();
      // РѕР±РЅРѕРІРёРј РґР°РЅРЅС‹Рµ РЅР° СЃС‚СЂР°РЅРёС†Рµ Р±РµР· РїРѕР»РЅРѕР№ РїРµСЂРµР·Р°РіСЂСѓР·РєРё
      onCreated?.();
    } catch {
      setError("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ Р·Р°РґР°С‡Сѓ");
      setSaving(false);
    }
  }

  function resetForm() {
    setTitle("");
    setClientId(clients[0]?.id ?? "");
    setTaskType("CLIENT_REQUEST");
    setDeadline(() => {
      const d = new Date();
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - offset * 60000);
      return local.toISOString().slice(0, 10);
    });
    setReceiptDeadline("");
    setUrgent(false);
    setTaxAmount("");
    setTaxPaymentDate("");
    setInvoiceAmount("");
    setAssignedToId(defaultAssignee());
    setExecutorId("");
    setDuration("");
    setFactDuration("");
    setError("");
    setDone(false);
    setSaving(false);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={resetForm}
        className="flex items-center gap-1.5 rounded-lg bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-300"
      >
        <X className="h-4 w-4" />
        РћС‚РјРµРЅРёС‚СЊ
      </button>

      <form
        onSubmit={handleSubmit}
        className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg"
      >
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">
          РќРѕРІР°СЏ Р·Р°РґР°С‡Р°
        </h3>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              РљР»РёРµРЅС‚
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
              Р§С‚Рѕ РЅСѓР¶РЅРѕ СЃРґРµР»Р°С‚СЊ
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Р’РІРµРґРёС‚Рµ Р·Р°РґР°С‡Сѓ..."
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                РўРёРї
              </label>
              <TaskTypeSelect
                value={taskType}
                types={TASK_TYPES}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                onChange={(next) => {
                  setTaskType(next);
                  if (next === "IFNS_DEMAND") {
                    const toInput = (d: Date) =>
                      new Date(
                        d.getTime() - d.getTimezoneOffset() * 60000
                      )
                        .toISOString()
                        .slice(0, 10);
                    setDeadline(toInput(addBusinessDays(new Date(), 5)));
                    setReceiptDeadline(toInput(addBusinessDays(new Date(), 10)));
                    // РїСѓСЃС‚РѕРµ РїРѕР»Рµ вЂ” РїРѕРґСЃС‚Р°РІР»СЏРµРј Р·Р°РіРѕР»РѕРІРѕРє С‚СЂРµР±РѕРІР°РЅРёСЏ
                    if (!title.trim()) setTitle("РџРѕР»СѓС‡РµРЅРѕ С‚СЂРµР±РѕРІР°РЅРёРµ");
                  }
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                {taskType === "IFNS_DEMAND" ? "РЎСЂРѕРє РєРІРёС‚Р°РЅС†РёРё" : "РЎСЂРѕРє"}
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {taskType === "IFNS_DEMAND" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                РЎСЂРѕРє С‚СЂРµР±РѕРІР°РЅРёСЏ
              </label>
              <input
                type="date"
                value={receiptDeadline}
                onChange={(e) => setReceiptDeadline(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Р’СЂРµРјСЏ РїРѕ РїР»Р°РЅСѓ, РјРёРЅ
              </label>
              <input
                type="number"
                min="0"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Р¤Р°РєС‚РёС‡РµСЃРєРѕРµ РІСЂРµРјСЏ, РјРёРЅ
              </label>
              <input
                type="number"
                min="0"
                value={factDuration}
                onChange={(e) => setFactDuration(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {!isClient && executors.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                РћС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Р№
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              >
                {executors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {specSuffix(u.specialization)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isClient && executors.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                РСЃРїРѕР»РЅРёС‚РµР»СЊ
              </label>
              <select
                value={executorId}
                onChange={(e) => setExecutorId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="">РќРµ РІС‹Р±СЂР°РЅ</option>
                {executors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {specSuffix(u.specialization)}
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
              РЎСЂРѕС‡РЅРѕ
            </label>
          )}

          {isInvoiceType && (
            <div className="rounded-lg bg-zinc-50 p-2">
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                РЎСѓРјРјР°, в‚Ѕ
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
          )}

          {canEditTax && taskType === "TAX_PAYMENT" && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  РЎСѓРјРјР° РЅР°Р»РѕРіР°, в‚Ѕ
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
                  Р”Р°С‚Р° СѓРїР»Р°С‚С‹
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
              Р—Р°РґР°С‡Р° СЃРѕР·РґР°РЅР°
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
onClick={resetForm}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-300"
            >
              РћС‚РјРµРЅР° РІРІРѕРґР°
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "РЎРѕР·РґР°РЅРёРµ..." : "РЎРѕР·РґР°С‚СЊ Р·Р°РґР°С‡Сѓ"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

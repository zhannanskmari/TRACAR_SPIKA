"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type PaymentRow = {
  clientId: string;
  name: string;
  shortName: string | null;
  taxSystem: string;
  invoiceAmount: number | null;
  invoiceDay: number | null;
  startBalance: number;
  invoiceSum: number;
  paymentAmount: number;
  endBalance: number;
};

function currentMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function num(v: number): string {
  return v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function ClientCell({ row }: { row: PaymentRow }) {
  const display = row.shortName || row.name;
  const taxLabel =
    row.taxSystem === "USN_6"
      ? "УСН 6%"
      : row.taxSystem === "USN_15"
        ? "УСН 15%"
        : row.taxSystem === "OSNO"
          ? "ОСНО"
          : "";
  return (
    <div>
      <div className="font-medium text-zinc-900">{display}</div>
      <div className="text-xs text-zinc-500">
        {taxLabel}
        {row.invoiceAmount != null && (
          <> · счёт {row.invoiceDay ?? "?"}-го · {num(row.invoiceAmount)} ₽</>
        )}
      </div>
    </div>
  );
}

function CellInput({
  value,
  onSave,
}: {
  value: number;
  onSave: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(String(value ?? ""));
    setDirty(false);
  }, [value]);

  return (
    <input
      type="number"
      step="0.01"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        setDirty(true);
      }}
      onBlur={() => {
        const n = Number(draft);
        if (dirty && !isNaN(n)) {
          onSave(Math.round(n * 100) / 100);
        }
        setDirty(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={`w-full rounded-lg border px-2 py-1 text-right text-sm tabular-nums outline-none transition focus:border-blue-500 ${
        dirty ? "border-amber-400 bg-amber-50" : "border-zinc-200 bg-white"
      }`}
    />
  );
}

export default function PaymentsView() {
  const [month, setMonth] = useState(currentMonth);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments?month=${encodeURIComponent(m)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rows)) setRows(data.rows);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  async function generateInvoices() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generateInvoices", month }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Ошибка формирования счетов");
      }
      const data = await res.json();
      const count = typeof data.count === "number" ? data.count : 0;
      setMsg(
        count > 0
          ? `Сформировано счетов: ${count}`
          : "Все счета за этот месяц уже сформированы"
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
    window.setTimeout(() => setMsg(""), 6000);
  }

  async function saveValue(
    action: "setStart" | "setPayment",
    clientId: string,
    value: number
  ) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          clientId,
          month,
          [action === "setStart" ? "startBalance" : "amount"]: value,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Ошибка сохранения");
      }
      setMsg(action === "setStart" ? "Остаток сохранён" : "Оплата сохранена");
      await load(month);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
    window.setTimeout(() => setMsg(""), 4000);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={generateInvoices}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            Сформировать счета
          </button>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-zinc-500">{msg}</span>}
          <button
            onClick={() => load(month)}
            disabled={loading || busy}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-50 text-xs font-medium text-zinc-500">
            <tr className="border-b border-zinc-200">
              <th className="px-4 py-2 text-left">Фирма</th>
              <th className="px-3 py-2 text-right">Остаток на начало</th>
              <th className="px-3 py-2 text-right">Счёт</th>
              <th className="px-3 py-2 text-right">Оплата</th>
              <th className="px-3 py-2 text-right">Остаток на конец</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.clientId}
                className="border-b border-zinc-100 hover:bg-zinc-50/50"
              >
                <td className="px-4 py-2.5">
                  <ClientCell row={row} />
                </td>
                <td className="px-3 py-2.5">
                  <CellInput
                    value={row.startBalance}
                    onSave={(v) => saveValue("setStart", row.clientId, v)}
                  />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">
                  {row.invoiceSum > 0 ? num(row.invoiceSum) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <CellInput
                    value={row.paymentAmount}
                    onSave={(v) => saveValue("setPayment", row.clientId, v)}
                  />
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-medium tabular-nums ${
                    row.endBalance >= 0 ? "text-zinc-900" : "text-red-600"
                  }`}
                >
                  {num(row.endBalance)}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
              <tr>
                <td className="px-4 py-2">Итого ({rows.length})</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {num(rows.reduce((s, r) => s + r.startBalance, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {num(rows.reduce((s, r) => s + r.invoiceSum, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {num(rows.reduce((s, r) => s + r.paymentAmount, 0))}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    rows.reduce((s, r) => s + r.endBalance, 0) >= 0
                      ? "text-zinc-900"
                      : "text-red-600"
                  }`}
                >
                  {num(rows.reduce((s, r) => s + r.endBalance, 0))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {rows.length === 0 && !loading && (
          <div className="flex flex-1 items-center justify-center py-16 text-sm text-zinc-400">
            Нет данных за этот месяц
          </div>
        )}
        {loading && (
          <div className="flex flex-1 items-center justify-center py-16 text-sm text-zinc-400">
            Загрузка...
          </div>
        )}
      </div>
    </div>
  );
}
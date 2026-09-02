"use client";

import { useMemo } from "react";
import { TASK_TYPE_LABELS } from "@/lib/task-meta";

export type CalendarClient = {
  id: string;
  name: string;
  taxSystem: string;
  tasks: {
    id: string;
    title: string;
    taskType: string;
    status: string;
    date: string | null;
    taxAmount: number | null;
    durationMinutes: number | null;
    assignedTo: { id: string; name: string } | null;
  }[];
};

const CAL_COLORS: Record<string, { bg: string; text: string; amount: string }> = {
  blue:   { bg: "bg-sky-100",   text: "text-sky-900",   amount: "text-sky-700" },
  green:  { bg: "bg-emerald-100", text: "text-emerald-900", amount: "text-emerald-700" },
  beige:  { bg: "bg-amber-50",  text: "text-amber-900",  amount: "text-amber-700" },
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

export default function CalendarPlan({ clients }: { clients: CalendarClient[] }) {
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
                      <div
                        key={t.id}
                        className={`mb-1 rounded ${col.bg} px-1.5 py-1 text-[11px] leading-tight ${col.text}`}
                        title={t.title}
                      >
                        <div className="font-medium">
                          {TASK_TYPE_LABELS[t.taskType] ?? t.taskType}
                        </div>
                        <div className="line-clamp-2">{t.title}</div>
                        {(t.taxAmount != null || t.durationMinutes != null) && (
                          <div className={`font-semibold ${col.amount}`}>
                            {t.taxAmount != null && (
                              <span>{t.taxAmount.toLocaleString("ru-RU")} ₽</span>
                            )}
                            {t.taxAmount != null && t.durationMinutes != null && (
                              <span> · </span>
                            )}
                            {t.durationMinutes != null && (
                              <span>{t.durationMinutes} мин</span>
                            )}
                          </div>
                        )}
                      </div>
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
  );
}

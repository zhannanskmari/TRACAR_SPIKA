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
  }[];
};

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
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        className="mb-1 rounded bg-blue-50 px-1.5 py-1 text-[11px] leading-tight text-blue-900"
                        title={t.title}
                      >
                        <div className="font-medium">
                          {TASK_TYPE_LABELS[t.taskType] ?? t.taskType}
                        </div>
                        <div className="line-clamp-2">{t.title}</div>
                        {t.taxAmount != null && (
                          <div className="font-semibold text-blue-700">
                            {t.taxAmount.toLocaleString("ru-RU")} ₽
                          </div>
                        )}
                      </div>
                    ))}
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

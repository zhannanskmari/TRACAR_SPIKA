"use client";

import { Fragment } from "react";
import { ArrowLeft, Building2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  CALENDAR_FROM,
  CALENDAR_TO,
  DEADLINE_EVENTS,
  SYSTEM_GROUPS,
  eventAppliesToClient,
} from "./deadline-calendar";

type ClientRow = {
  id: string;
  name: string;
  taxSystem: string;
  advanceDay: number | null;
  salaryPaymentDay: number | null;
};

type DoneTask = {
  clientId: string;
  title: string;
  /** ISO-дата выполнения (перевод в статус DONE) */
  completedAt: string | null;
};

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

// Дата выполнения (локальная зона): «дд.мм»
function fmtDone(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

function weekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return WEEKDAYS[d.getDay()];
}

export default function ReportingView({
  adminName,
  clients,
  doneTasks,
}: {
  adminName: string;
  clients: ClientRow[];
  doneTasks: DoneTask[];
}) {
  const router = useRouter();

  // Ключ «клиент|срок» → дата выполнения
  const doneMap = new Map(
    doneTasks.map((t) => [`${t.clientId}|${t.title}`, t.completedAt])
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const groups = SYSTEM_GROUPS.map((g) => ({
    ...g,
    clients: clients.filter((c) => g.match(c.taxSystem)),
  })).filter((g) => g.clients.length > 0);

  const otherClients = clients.filter(
    (c) => !SYSTEM_GROUPS.some((g) => g.match(c.taxSystem))
  );

  const colCount = 1 + DEADLINE_EVENTS.length;

  const renderClient = (c: ClientRow) => (
    <tr key={c.id} className="align-top">
      <td className="sticky left-0 z-10 border-b border-r border-zinc-200 bg-white px-3 py-2 font-medium text-zinc-900">
        {c.name}
      </td>
      {DEADLINE_EVENTS.map((ev, i) => {
        const active = eventAppliesToClient(ev, c);
        const doneAt = active
          ? doneMap.get(`${c.id}|${ev.label}`)
          : undefined;
        return (
          <td
            key={`${ev.date}-${i}`}
            className={`border-b border-r border-zinc-100 px-2 py-2 text-center ${
              active ? "bg-yellow-300" : ""
            }`}
          >
            {active ? (
              doneAt ? (
                <span className="text-[11px] font-semibold text-zinc-800">
                  {fmtDone(doneAt)}
                </span>
              ) : (
                "✓"
              )
            ) : (
              ""
            )}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className="flex min-h-full flex-col bg-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-bold text-zinc-900">Спика</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            Отчётность
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
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/clients")}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-base font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <ArrowLeft className="h-5 w-5" />
            К клиентам
          </button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">
              Календарь отчётности
            </h1>
            <p className="text-sm text-zinc-500">
              Сроки налогов, деклараций и уведомлений:{" "}
              {fmtDate(CALENDAR_FROM)}.2026 — {fmtDate(CALENDAR_TO)}.2026;
              сроки в выходные перенесены на следующий рабочий день
            </p>
          </div>
        </div>

        {/* Без overflow-обёртки: вертикальный скролл у main — иначе
            sticky-шапка таблицы не прилипает при прокрутке страницы */}
        <div className="rounded-xl border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs text-zinc-600">
                <th className="sticky left-0 top-0 z-30 min-w-[220px] border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 font-semibold">
                  Вид налогообложения / клиент
                </th>
                {DEADLINE_EVENTS.map((ev, i) => (
                  <th
                    key={`${ev.date}-${i}`}
                    className="sticky top-0 z-20 min-w-[130px] border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 align-top font-semibold"
                  >
                    <div className="text-sm font-bold text-zinc-900">
                      {fmtDate(ev.date)}.{ev.date.slice(0, 4)}{" "}
                      <span className="font-normal text-zinc-500">
                        ({weekday(ev.date)})
                      </span>
                    </div>
                    {ev.sourceDate !== ev.date && (
                      <div className="text-[10px] font-normal text-orange-600">
                        перенос с {fmtDate(ev.sourceDate)} (
                        {weekday(ev.sourceDate)})
                      </div>
                    )}
                    <div className="mt-0.5 text-[11px] font-normal text-zinc-600">
                      {ev.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.key}>
                  <tr className="bg-blue-50">
                    <td
                      colSpan={colCount}
                      className="border-b border-zinc-200 px-3 py-1.5 text-xs uppercase tracking-wide text-blue-700"
                    >
                      {/* текст группы остаётся на месте при горизонтальном скролле */}
                      <span className="sticky left-3 inline-block font-bold">
                        {g.label} ({g.clients.length})
                      </span>
                    </td>
                  </tr>
                  {g.clients.map(renderClient)}
                </Fragment>
              ))}
              {otherClients.length > 0 && (
                <Fragment key="other">
                  <tr className="bg-blue-50">
                    <td
                      colSpan={colCount}
                      className="border-b border-zinc-200 px-3 py-1.5 text-xs uppercase tracking-wide text-blue-700"
                    >
                      <span className="sticky left-3 inline-block font-bold">
                        Другие ({otherClients.length})
                      </span>
                    </td>
                  </tr>
                  {otherClients.map(renderClient)}
                </Fragment>
              )}
              {clients.length === 0 && (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-3 py-6 text-center text-zinc-400"
                  >
                    Клиентов пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-block h-4 w-6 rounded border border-zinc-200 bg-yellow-300" />
          — срок (налог, декларация или уведомление) для этого клиента
        </div>
      </main>
    </div>
  );
}

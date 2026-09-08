"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, LayoutGrid, CalendarDays, KanbanSquare, Building2, Users, FilterX, Archive, ArchiveRestore, Banknote } from "lucide-react";
import { TASK_TYPE_LABELS } from "@/lib/task-meta";
import KanbanBoard from "./KanbanBoard";
import CalendarPlan, { type CalendarClient } from "./CalendarPlan";
import CreateTaskForm, { type DashboardClient } from "./CreateTaskForm";
import ArchiveView from "./ArchiveView";
import PaymentsView from "./PaymentsView";

export type DashboardTask = {
  id: string;
  title: string;
  taskType: string;
  status: string;
  deadline: string | null;
  taxAmount: number | null;
  taxPaymentDate: string | null;
  amount: number | null;
  salaryPaymentDate: string | null;
  salaryCalcDate: string | null;
  isClientNotified: boolean;
  urgent: boolean;
  durationMinutes: number | null;
  factDurationMinutes: number | null;
  createdAt: string;
  client: {
    id: string;
    name: string;
    shortName: string | null;
    taxSystem: string;
  };
  assignedTo: { id: string; name: string; specialization: string | null };
  executor: { id: string; name: string; specialization: string | null } | null;
  createdBy: { id: string; name: string };
  comments: {
    id: string;
    text: string;
    createdAt: string;
    user: { id: string; name: string; role: string };
  }[];
  _count: { documents: number };
  archivedAt: string | null;
};

export type DashboardUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  specialization: string | null;
};

type Tab = "kanban" | "calendar" | "archive" | "payments";

type RawComment = {
  id: string;
  text: string;
  createdAt: string | null;
  user: { id: string; name: string; role: string };
};

type RawTask = {
  id: string;
  title: string;
  taskType: string;
  status: string;
  deadline: string | null;
  taxAmount: number | null;
  taxPaymentDate: string | null;
  amount: number | null;
  salaryPaymentDate: string | null;
  salaryCalcDate: string | null;
  isClientNotified: boolean;
  urgent: boolean;
  durationMinutes: number | null;
  factDurationMinutes: number | null;
  createdAt: string | null;
  client: {
    id: string;
    name: string;
    shortName: string | null;
    taxSystem: string;
  };
  assignedTo: { id: string; name: string; specialization: string | null };
  executor: { id: string; name: string; specialization: string | null } | null;
  createdBy: { id: string; name: string };
  comments: RawComment[];
  _count: { documents: number };
  archivedAt: string | null;
};
function serialize(raw: RawTask): DashboardTask {
  return {
    ...raw,
    deadline: raw.deadline ? new Date(raw.deadline).toISOString() : null,
    createdAt: raw.createdAt
      ? new Date(raw.createdAt).toISOString()
      : new Date().toISOString(),
    comments: raw.comments.map((c) => ({
      ...c,
      createdAt: c.createdAt
        ? new Date(c.createdAt).toISOString()
        : new Date().toISOString(),
    })),
  };
}

function toDateKey(d: Date | null | undefined): string {
  if (!d || isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

const TAX_GROUPS = ["АУСН", "УСН", "Патент", "ОСНО", "Другие"];

function taxGroupLabel(value: string): string {
  if (value === "AUSN8" || value === "AUSN20") return "АУСН";
  if (value === "USN" || value === "USN15") return "УСН";
  if (value === "PATENT" || value === "PSN") return "Патент";
  if (value === "OSNO" || value === "ESHN") return "ОСНО";
  return "Другие";
}

function taxLabel(value: string): string {
  const found = TAX_SYSTEMS.find((t) => t.value === value);
  return found ? found.label : value;
}

export default function DashboardView({
  user,
  tasks: initialTasks,
  clients,
  executors,
}: {
  user: DashboardUser;
  tasks: DashboardTask[];
  clients: DashboardClient[];
  executors: { id: string; name: string; specialization: string | null }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("kanban");
  const [tasks, setTasks] = useState<DashboardTask[]>(initialTasks);
  const [archived, setArchived] = useState<DashboardTask[] | null>(null);
  const [calendar, setCalendar] = useState<CalendarClient[] | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [archiveMsg, setArchiveMsg] = useState("");
  const [accrueBusy, setAccrueBusy] = useState(false);
  const [accrueMsg, setAccrueMsg] = useState("");

  const [filterClientId, setFilterClientId] = useState("");
  const [filterTaskType, setFilterTaskType] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterExecutorId, setFilterExecutorId] = useState("");

  const canEditTax = user.role === "ADMIN" || user.role === "EXECUTOR";
  const isClient = user.role === "CLIENT";
  const canAccrueSalary =
    user.role === "ADMIN" ||
    (user.role === "EXECUTOR" && user.specialization === "SALARY");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tasks)) {
          setTasks(data.tasks.map(serialize));
        }
      }
    } catch {
      // игнорируем сетевые сбои
    }
  }, []);

  const refreshCalendar = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.clients)) setCalendar(data.clients);
      }
    } catch {
      // игнорируем
    }
  }, []);

  const refreshArchived = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/archive", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tasks)) {
          setArchived(data.tasks.map(serialize));
        }
      }
    } catch {
      // игнорируем
    }
  }, []);

  async function handleArchive() {
    if (archiveBusy) return;
    if (
      !window.confirm(
        "Перенести в архив все активные карточки со сроком до сегодняшнего дня?"
      )
    ) {
      return;
    }
    setArchiveBusy(true);
    setArchiveMsg("");
    try {
      const res = await fetch("/api/tasks/archive", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Ошибка архивации");
      }
      const data = await res.json();
      const count = typeof data.count === "number" ? data.count : 0;
      setArchiveMsg(
        count > 0
          ? `В архив перенесено: ${count}`
          : "Карточек со сроком до сегодня нет"
      );
      await refreshTasks();
      await refreshCalendar();
      await refreshArchived();
      setTab("archive");
    } catch (e) {
      setArchiveMsg(e instanceof Error ? e.message : "Ошибка архивации");
    } finally {
      setArchiveBusy(false);
    }
    window.setTimeout(() => setArchiveMsg(""), 6000);
  }

  async function handleRestore(id: string) {
    setRestoringId(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivedAt: null }),
      });
      if (!res.ok) throw new Error("Ошибка восстановления");
      await refreshArchived();
      await refreshTasks();
    } finally {
      setRestoringId(null);
    }
  }

  async function handleTaskCreated() {
    await refreshTasks();
    if (tab !== "kanban") setTab("kanban");
  }

  async function accrueSalary(action: "salary" | "advance") {
    if (accrueBusy) return;
    setAccrueBusy(true);
    setAccrueMsg("");
    try {
      const res = await fetch("/api/tasks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Ошибка начисления");
      }
      const data = await res.json();
      const count = typeof data.count === "number" ? data.count : 0;
      setAccrueMsg(
        count > 0
          ? `Создано задач: ${count}`
          : data.message || "Задачи уже созданы"
      );
      await refreshTasks();
      if (tab !== "kanban") setTab("kanban");
    } catch (e) {
      setAccrueMsg(e instanceof Error ? e.message : "Ошибка начисления");
    } finally {
      setAccrueBusy(false);
    }
    window.setTimeout(() => setAccrueMsg(""), 6000);
  }

  // Авто-обновление каждые 10 секунд
  useEffect(() => {
    const id = setInterval(() => {
      if (tab === "kanban") refreshTasks();
      else if (tab === "calendar") refreshCalendar();
      else refreshArchived();
    }, 10000);

    return () => clearInterval(id);
  }, [tab, refreshTasks, refreshCalendar, refreshArchived]);

  const patchTask = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Ошибка обновления");
      }
      // сразу подтягиваем свежие данные, чтобы изменения были видны мгновенно
      await refreshTasks();
      return (await res.json()).task;
    },
    [refreshTasks]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Ошибка удаления");
      }
      await refreshTasks();
    },
    [refreshTasks]
  );

  async function openCalendar() {
    setLoadingCalendar(true);
    try {
      const res = await fetch("/api/calendar", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.clients)) setCalendar(data.clients);
      }
    } finally {
      setLoadingCalendar(false);
    }
  }

  const roleLabel =
    user.role === "ADMIN"
      ? "Руководитель"
      : user.role === "CLIENT"
        ? "Клиент"
        : "Исполнитель";

  const filterHasValue =
    filterClientId || filterTaskType || filterDate || filterExecutorId;

  const filterClients = useMemo(() => {
    const map = new Map<
      string,
      { name: string; shortName: string | null; taxSystem: string }
    >();
    for (const c of clients) {
      if (c.id && c.name)
        map.set(c.id, {
          name: c.name,
          shortName: c.shortName ?? null,
          taxSystem: c.taxSystem,
        });
    }
    // гарантируем, что клиенты из календаря тоже доступны в фильтре
    for (const c of calendar ?? []) {
      if (!map.has(c.id))
        map.set(c.id, {
          name: c.name,
          shortName: null,
          taxSystem: c.taxSystem,
        });
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [clients, calendar]);

  function taskMatchesDate(t: DashboardTask): boolean {
    if (!filterDate) return true;
    const keys = [t.deadline, t.taxPaymentDate].filter(Boolean) as string[];
    return keys.some((k) => toDateKey(new Date(k)) === filterDate);
  }

  const filteredTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (filterClientId && t.client.id !== filterClientId) return false;
        if (
          filterExecutorId &&
          t.assignedTo?.id !== filterExecutorId &&
          t.executor?.id !== filterExecutorId
        )
          return false;
        if (filterTaskType && t.taskType !== filterTaskType) return false;
        if (!taskMatchesDate(t)) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, filterClientId, filterExecutorId, filterTaskType, filterDate]
  );

  const filteredArchived = useMemo(
    () =>
      (archived ?? []).filter((t) => {
        if (filterClientId && t.client.id !== filterClientId) return false;
        if (
          filterExecutorId &&
          t.assignedTo?.id !== filterExecutorId &&
          t.executor?.id !== filterExecutorId
        )
          return false;
        if (filterTaskType && t.taskType !== filterTaskType) return false;
        if (!taskMatchesDate(t)) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [archived, filterClientId, filterExecutorId, filterTaskType, filterDate]
  );

  const filteredCalendar = useMemo(() => {
    if (!calendar) return null;
    return calendar
      .map((c) => {
        const ts = c.tasks.filter((t) => {
          if (filterClientId && c.id !== filterClientId) return false;
          if (
            filterExecutorId &&
            t.assignedTo?.id !== filterExecutorId &&
            t.executor?.id !== filterExecutorId
          )
            return false;
          if (filterTaskType && t.taskType !== filterTaskType) return false;
          if (filterDate && (!t.date || toDateKey(new Date(t.date)) !== filterDate))
            return false;
          return true;
        });
        return { ...c, tasks: ts };
      })
      .filter((c) => (filterHasValue ? c.tasks.length > 0 : true));
  }, [
    calendar,
    filterClientId,
    filterExecutorId,
    filterTaskType,
    filterDate,
    filterHasValue,
  ]);

  function resetFilters() {
    setFilterClientId("");
    setFilterTaskType("");
    setFilterDate("");
    setFilterExecutorId("");
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-bold text-zinc-900">Спика</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            Кабинет сотрудника
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-zinc-900">{user.name}</div>
            <div className="text-xs text-zinc-500">
              {roleLabel}{" "}
              {user.specialization
                ? user.specialization === "SALARY"
                  ? "• ЗП"
                  : "• Налоги"
                : ""}
            </div>
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

      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-6 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("kanban")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === "kanban"
                ? "bg-blue-100 text-blue-700"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <KanbanSquare className="h-4 w-4" />
            Доска задач
          </button>
          <button
            onClick={() => {
              setTab("calendar");
              openCalendar();
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === "calendar"
                ? "bg-blue-100 text-blue-700"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            Календарь
          </button>
          {user.role !== "CLIENT" && (
            <button
              onClick={() => {
                setTab("archive");
                if (archived === null) refreshArchived();
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === "archive"
                  ? "bg-blue-100 text-blue-700"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <Archive className="h-4 w-4" />
              Архив
              {archived && archived.length > 0 && (
                <span className="rounded-full bg-zinc-200/70 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                  {archived.length}
                </span>
              )}
            </button>
          )}
          {user.role === "ADMIN" && (
            <button
              onClick={() => router.push("/clients")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100"
            >
              <Building2 className="h-4 w-4" />
              Клиенты
            </button>
          )}
          {user.role !== "CLIENT" && (
            <button
              onClick={() => {
                setTab("payments");
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === "payments"
                  ? "bg-blue-100 text-blue-700"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <Banknote className="h-4 w-4" />
              Оплаты
            </button>
          )}
          {user.role === "ADMIN" && (
            <button
              onClick={() => router.push("/employees")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100"
            >
              <Users className="h-4 w-4" />
              Сотрудники
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user.role !== "CLIENT" && (
            <>
              <button
                onClick={handleArchive}
                disabled={archiveBusy}
                title="Перенести в архив карточки со сроком до сегодняшнего дня"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                <ArchiveRestore className="h-4 w-4" />
                Архивация
              </button>
              {archiveMsg && (
                <span className="max-w-[240px] truncate text-xs text-zinc-500">
                  {archiveMsg}
                </span>
              )}
              {accrueMsg && (
                <span className="max-w-[240px] truncate text-xs text-zinc-500">
                  {accrueMsg}
                </span>
              )}
            </>
          )}
          {canAccrueSalary && user.role !== "CLIENT" && (
            <>
              <button
                onClick={() => accrueSalary("salary")}
                disabled={accrueBusy}
                title="Создать задачи «Расчёт ЗП» для клиентов с датой выплаты зарплаты"
                className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
              >
                <Banknote className="h-4 w-4" />
                Начислить зарплату
              </button>
              <button
                onClick={() => accrueSalary("advance")}
                disabled={accrueBusy}
                title="Создать задачи «Аванс» для клиентов с датой аванса"
                className="flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-60"
              >
                <Banknote className="h-4 w-4" />
                Начислить аванс
              </button>
            </>
          )}
          {clients.length > 0 && (
            <CreateTaskForm
              clients={clients}
              canEditTax={canEditTax}
              isClient={isClient}
              executors={executors}
              onCreated={handleTaskCreated}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-6 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <LayoutGrid className="h-3.5 w-3.5" />
          Фильтры
        </div>
        <select
          value={filterClientId}
          onChange={(e) => setFilterClientId(e.target.value)}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-blue-500"
        >
          <option value="">Все клиенты</option>
          {TAX_GROUPS.map((label) => {
            const items = filterClients.filter(
              (c) => taxGroupLabel(c.taxSystem) === label
            );
            if (items.length === 0) return null;
            return (
              <optgroup key={label} label={label}>
                {items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortName || c.name}
                    {c.taxSystem ? `(${taxLabel(c.taxSystem)})` : ""}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {user.role === "ADMIN" && (
          <select
            value={filterExecutorId}
            onChange={(e) => setFilterExecutorId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-blue-500"
          >
            <option value="">Все сотрудники</option>
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
        )}
        <select
          value={filterTaskType}
          onChange={(e) => setFilterTaskType(e.target.value)}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-blue-500"
        >
          <option value="">Все типы</option>
          {Object.entries(TASK_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-blue-500"
        />
        {filterHasValue && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            <FilterX className="h-4 w-4" />
            Сбросить
          </button>
        )}
      </div>

      <main className="flex-1 overflow-hidden p-6">
        {tab === "kanban" ? (
          <KanbanBoard
            tasks={filteredTasks}
            patchTask={patchTask}
            deleteTask={deleteTask}
            user={user}
            canEditTax={canEditTax}
            executors={executors}
          />
        ) : tab === "archive" ? (
          <ArchiveView
            tasks={filteredArchived}
            onRestore={handleRestore}
            restoringId={restoringId}
          />
        ) : tab === "payments" ? (
          <PaymentsView />
        ) : loadingCalendar ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Загрузка календаря...
          </div>
        ) : (
          <CalendarPlan
            clients={filteredCalendar ?? []}
            canEditTax={canEditTax}
            executors={executors}
            onSave={async (id, data) => {
              await patchTask(id, data);
              await refreshCalendar();
            }}
          />
        )}
      </main>
    </div>
  );
}

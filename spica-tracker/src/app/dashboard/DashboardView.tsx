"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, LayoutGrid, CalendarDays, KanbanSquare, Building2, Users, FilterX } from "lucide-react";
import { TASK_TYPE_LABELS } from "@/lib/task-meta";
import KanbanBoard from "./KanbanBoard";
import CalendarPlan, { type CalendarClient } from "./CalendarPlan";
import CreateTaskForm, { type DashboardClient } from "./CreateTaskForm";

export type DashboardTask = {
  id: string;
  title: string;
  taskType: string;
  status: string;
  deadline: string | null;
  taxAmount: number | null;
  taxPaymentDate: string | null;
  isClientNotified: boolean;
  urgent: boolean;
  durationMinutes: number | null;
  factDurationMinutes: number | null;
  createdAt: string;
  client: { id: string; name: string; taxSystem: string };
  assignedTo: { id: string; name: string; specialization: string | null };
  createdBy: { id: string; name: string };
  comments: {
    id: string;
    text: string;
    createdAt: string;
    user: { id: string; name: string; role: string };
  }[];
  _count: { documents: number };
};

export type DashboardUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  specialization: string | null;
};

type Tab = "kanban" | "calendar";

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
  isClientNotified: boolean;
  urgent: boolean;
  durationMinutes: number | null;
  factDurationMinutes: number | null;
  createdAt: string | null;
  client: { id: string; name: string; taxSystem: string };
  assignedTo: { id: string; name: string; specialization: string | null };
  createdBy: { id: string; name: string };
  comments: RawComment[];
  _count: { documents: number };
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
  const [calendar, setCalendar] = useState<CalendarClient[] | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  const [filterClientId, setFilterClientId] = useState("");
  const [filterTaskType, setFilterTaskType] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const canEditTax = user.role === "ADMIN" || user.role === "EXECUTOR";
  const isClient = user.role === "CLIENT";

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

  async function handleTaskCreated() {
    await refreshTasks();
    if (tab !== "kanban") setTab("kanban");
  }

  // Авто-обновление каждые 10 секунд
  useEffect(() => {
    const id = setInterval(() => {
      if (tab === "kanban") refreshTasks();
      else refreshCalendar();
    }, 10000);

    return () => clearInterval(id);
  }, [tab, refreshTasks, refreshCalendar]);

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

  const filterHasValue = filterClientId || filterTaskType || filterDate;

  const filterClients = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) {
      if (c.id && c.name) map.set(c.id, c.name);
    }
    // гарантируем, что клиенты из календаря тоже доступны в фильтре
    for (const c of calendar ?? []) {
      if (!map.has(c.id)) map.set(c.id, c.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
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
        if (filterTaskType && t.taskType !== filterTaskType) return false;
        if (!taskMatchesDate(t)) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, filterClientId, filterTaskType, filterDate]
  );

  const filteredCalendar = useMemo(() => {
    if (!calendar) return null;
    return calendar
      .map((c) => {
        const ts = c.tasks.filter((t) => {
          if (filterClientId && c.id !== filterClientId) return false;
          if (filterTaskType && t.taskType !== filterTaskType) return false;
          if (filterDate && (!t.date || toDateKey(new Date(t.date)) !== filterDate))
            return false;
          return true;
        });
        return { ...c, tasks: ts };
      })
      .filter((c) => (filterHasValue ? c.tasks.length > 0 : true));
  }, [calendar, filterClientId, filterTaskType, filterDate, filterHasValue]);

  function resetFilters() {
    setFilterClientId("");
    setFilterTaskType("");
    setFilterDate("");
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
            Календарный план
          </button>
          {user.role === "ADMIN" && (
            <button
              onClick={() => router.push("/clients")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100"
            >
              <Building2 className="h-4 w-4" />
              Клиенты
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
          {filterClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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

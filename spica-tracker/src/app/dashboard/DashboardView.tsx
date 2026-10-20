"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, LayoutGrid, CalendarDays, KanbanSquare, Building2, Users, FilterX, Archive, ArchiveRestore, Banknote, ScrollText, BookOpen } from "lucide-react";
import { TASK_TYPE_LABELS } from "@/lib/task-meta";
import { toIso } from "@/lib/dates";
import { hasSimplePanel } from "@/lib/panel-access";
import { specShort, specSuffix } from "@/lib/specialization";
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
  receiptDeadline: string | null;
  demandNumber: string | null;
  demandDate: string | null;
  taxAmount: number | null;
  taxPaymentDate: string | null;
  amount: number | null;
  salaryPaymentDate: string | null;
  salaryCalcDate: string | null;
  isClientNotified: boolean;
  urgent: boolean;
  durationMinutes: number | null;
  factDurationMinutes: number | null;
  docCount: number | null;
  startTime: string | null;
  endTime: string | null;
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
  knowledgeArticle: { id: string; title: string; type: string } | null;
  knowledgeUrl: string | null;
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
  receiptDeadline: string | null;
  demandNumber: string | null;
  demandDate: string | null;
  taxAmount: number | null;
  taxPaymentDate: string | null;
  amount: number | null;
  salaryPaymentDate: string | null;
  salaryCalcDate: string | null;
  isClientNotified: boolean;
  urgent: boolean;
  durationMinutes: number | null;
  factDurationMinutes: number | null;
  docCount: number | null;
  startTime: string | null;
  endTime: string | null;
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
  knowledgeArticle: { id: string; title: string; type: string } | null;
  knowledgeUrl: string | null;
  comments: RawComment[];
  _count: { documents: number };
  archivedAt: string | null;
};
function serialize(raw: RawTask): DashboardTask {
  return {
    ...raw,
    deadline: toIso(raw.deadline),
    createdAt: toIso(raw.createdAt) ?? new Date().toISOString(),
    comments: raw.comments.map((c) => ({
      ...c,
      createdAt: toIso(c.createdAt) ?? new Date().toISOString(),
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
  initialTab,
}: {
  user: DashboardUser;
  tasks: DashboardTask[];
  clients: DashboardClient[];
  executors: { id: string; name: string; specialization: string | null }[];
  initialTab?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(() =>
    initialTab === "calendar" ||
    initialTab === "archive" ||
    initialTab === "payments"
      ? initialTab
      : "kanban"
  );
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
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesText, setChangesText] = useState<string | null>(null);
  const [changesSeen, setChangesSeen] = useState(true);
  const [latestChange, setLatestChange] = useState("");

  const canEditTax = user.role === "ADMIN" || user.role === "EXECUTOR";
  const isClient = user.role === "CLIENT";
  // Упрощённая панель: только «Доска задач» и «Календарь» —
  // без оплат, архива и начислений (см. lib/panel-access.ts).
  const simplePanel = hasSimplePanel(user);
  const canAccrueSalary =
    !simplePanel &&
    (user.role === "ADMIN" ||
      (user.role === "EXECUTOR" && user.specialization === "SALARY"));
  const effectiveTab: Tab =
    simplePanel && (tab === "archive" || tab === "payments") ? "kanban" : tab;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  // Метка «версии» файла изменений: последний блок (заголовок + первый пункт).
  // Хранится в localStorage, чтобы показать бейдж «есть изменения».
  function extractLatest(text: string): { key: string; line: string } {
    const lines = text.split(/\r?\n/);
    let headerIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^ИЗМЕНЕНИЯ В ТРЕКЕРЕ ЗАДАЧ/i.test(lines[i].trim())) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      const first = lines.find((l) => l.trim());
      return { key: first?.trim() ?? "", line: first?.trim() ?? "" };
    }
    const header = lines[headerIdx].trim();
    // первый непустой пункт после заголовка (пропускаем разделитель ===)
    let item = "";
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t || /^=+$/.test(t)) continue;
      item = t;
      break;
    }
    return { key: `${header}|${item}`, line: item || header };
  }

  // Проверяем наличие новых изменений при загрузке страницы
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/changes.txt", { cache: "no-store" });
        if (!res.ok) return;
        const text = await res.text();
        const { key, line } = extractLatest(text);
        if (cancelled || !key) return;
        setLatestChange(line);
        const seen = window.localStorage.getItem("spica_changes_seen");
        setChangesSeen(seen === key);
      } catch {
        // игнорируем
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Кнопка «Изменения в трекере задач»: показывает текст файла изменений
  async function openChanges() {
    setChangesOpen(true);
    if (changesText == null) {
      try {
        const res = await fetch("/changes.txt", { cache: "no-store" });
        const text = await res.text();
        setChangesText(text);
        const { key, line } = extractLatest(text);
        setLatestChange(line);
        window.localStorage.setItem("spica_changes_seen", key);
        setChangesSeen(true);
      } catch {
        setChangesText("Не удалось загрузить файл изменений");
      }
    } else {
      const { key } = extractLatest(changesText);
      window.localStorage.setItem("spica_changes_seen", key);
      setChangesSeen(true);
    }
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

  // Локальное обновление карточки календаря после переноса/сохранения —
  // без повторной загрузки всего списка (это и была задержка при перетаскивании)
  const applyCalendarPatch = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setCalendar((prev) => {
        if (!prev) return prev;
        return prev.map((c) => ({
          ...c,
          tasks: c.tasks.map((t) => {
            if (t.id !== id) return t;
            const next = { ...t } as typeof t & Record<string, unknown>;
            if (patch.deadline !== undefined) next.deadline = patch.deadline as string | null;
            if (patch.receiptDeadline !== undefined)
              next.receiptDeadline = patch.receiptDeadline as string | null;
            if (patch.startTime !== undefined)
              next.startTime = patch.startTime as string | null;
            if (patch.title !== undefined) next.title = patch.title as string;
            if (patch.taskType !== undefined) next.taskType = patch.taskType as string;
            if (patch.status !== undefined) next.status = patch.status as string;
            if (patch.durationMinutes !== undefined)
              next.durationMinutes = patch.durationMinutes as number | null;
            if (patch.factDurationMinutes !== undefined)
              next.factDurationMinutes = patch.factDurationMinutes as number | null;
            if (patch.docCount !== undefined)
              next.docCount = patch.docCount as number | null;
            if (patch.taxAmount !== undefined)
              next.taxAmount = patch.taxAmount as number | null;
            if (patch.taxPaymentDate !== undefined)
              next.taxPaymentDate = patch.taxPaymentDate as string | null;
            // Дата в колонке календаря: «Требование ИФНС» — по сроку требования,
            // иначе — по сроку карточки
            const rec = next.receiptDeadline as string | null;
            next.date =
              next.taskType === "IFNS_DEMAND" && rec
                ? rec
                : ((next.deadline as string | null) ?? null);
            return next;
          }),
        }));
      });
    },
    []
  );

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
        "Выполненные карточки со сроком до сегодня уйдут в архив, невыполненные будут перенесены на следующий рабочий день. Продолжить?"
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
      const moved = typeof data.moved === "number" ? data.moved : 0;
      if (count > 0 || moved > 0) {
        const parts: string[] = [];
        if (count > 0) parts.push(`в архив: ${count}`);
        if (moved > 0) parts.push(`на следующий рабочий день: ${moved}`);
        setArchiveMsg(`Готово — ${parts.join(", ")}`);
      } else {
        setArchiveMsg("Карточек со сроком до сегодня нет");
      }
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
    async (
      id: string,
      data: Record<string, unknown>,
      opts?: { refresh?: boolean }
    ) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Ошибка обновления");
      }
      // для канбана подтягиваем свежие данные сразу; календарь обновляет
      // своё состояние локально и лишний запрос ему не нужен
      if (opts?.refresh !== false) await refreshTasks();
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
          <button
            onClick={openChanges}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              changesSeen
                ? "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                : "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            <ScrollText className="h-4 w-4" />
            Изменения в трекере задач
            {!changesSeen && (
              <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                есть изменения
              </span>
            )}
          </button>
          {user.role !== "CLIENT" && (
            <Link
              href="/knowledge"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <BookOpen className="h-4 w-4" />
              Общая база знаний
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-zinc-900">{user.name}</div>
            <div className="text-xs text-zinc-500">
              {roleLabel}{" "}
              {user.specialization ? `• ${specShort(user.specialization)}` : ""}
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

      {changesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900">
                  Изменения в трекере задач
                </div>
                {latestChange && (
                  <div className="truncate text-xs font-medium text-amber-700">
                    Последнее: {latestChange}
                  </div>
                )}
              </div>
              <button
                onClick={() => setChangesOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Закрыть
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700">
                {changesText ?? "Загрузка…"}
              </pre>
            </div>
          </div>
        </div>
      )}

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
          {!simplePanel && user.role !== "CLIENT" && (
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
          {(user.role === "ADMIN" ||
            (user.role === "EXECUTOR" && user.name.includes("Анастасия"))) && (
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
        <div className="flex items-center gap-2">
          {!simplePanel && user.role !== "CLIENT" && (
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
              currentUserId={user.id}
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
                    {c.taxSystem ? ` (${taxLabel(c.taxSystem)})` : ""}
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
                {specSuffix(u.specialization)}
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
        {effectiveTab === "kanban" ? (
          <KanbanBoard
            tasks={filteredTasks}
            patchTask={patchTask}
            deleteTask={deleteTask}
            user={user}
            canEditTax={canEditTax}
            executors={executors}
          />
        ) : effectiveTab === "archive" ? (
          <ArchiveView
            tasks={filteredArchived}
            onRestore={handleRestore}
            restoringId={restoringId}
          />
        ) : effectiveTab === "payments" ? (
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
              await patchTask(id, data, { refresh: false });
              applyCalendarPatch(id, data);
              // список задач обновляем в фоне, чтобы не тормозить перенос
              refreshTasks();
            }}
          />
        )}
      </main>
    </div>
  );
}

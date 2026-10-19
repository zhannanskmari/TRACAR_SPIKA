"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  ArrowLeft,
  Plus,
  Users,
  Pencil,
  X,
  Trash2,
  UserRound,
  Wallet,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { isSpecialization, specLabel } from "@/lib/specialization";
import { TASK_TYPE_LABELS } from "@/lib/task-meta";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  specialization: string | null;
  createdAt: string;
};

type EmployeeTask = {
  id: string;
  title: string;
  taskType: string;
  deadline: string | null;
  archivedAt: string | null;
  factDurationMinutes: number | null;
  assignedToId: string;
  executorId: string | null;
  client: { id: string; name: string };
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU");
}

function formatHours(min: number): string {
  return (min / 60).toLocaleString("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export default function EmployeesView({
  adminName,
  employees: initialEmployees,
  tasks,
}: {
  adminName: string;
  employees: Employee[];
  tasks: EmployeeTask[];
}) {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Инлайн-редактирование факт-времени архивной карточки
  const [taskList, setTaskList] = useState<EmployeeTask[]>(tasks);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editFactValue, setEditFactValue] = useState("");
  const [editTypeValue, setEditTypeValue] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [taskError, setTaskError] = useState("");

  async function saveTask(id: string) {
    const raw = editFactValue.trim();
    const value = raw === "" ? null : Math.max(0, Math.round(Number(raw)));
    if (raw !== "" && (value === null || isNaN(value))) {
      setTaskError("Некорректное значение");
      return;
    }
    const patch: Record<string, unknown> = { factDurationMinutes: value };
    const current = taskList.find((t) => t.id === id);
    if (current && editTypeValue && editTypeValue !== current.taskType) {
      patch.taskType = editTypeValue;
    }
    setSavingTask(true);
    setTaskError("");
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setTaskError(body.error || "Не удалось сохранить");
        return;
      }
      setTaskList((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                factDurationMinutes: value,
                taskType: (patch.taskType as string) ?? t.taskType,
              }
            : t
        )
      );
      setEditingTaskId(null);
    } catch {
      setTaskError("Ошибка сети");
    } finally {
      setSavingTask(false);
    }
  }

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [specialization, setSpecialization] = useState("SALARY");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function fillForm(e: Employee) {
    setName(e.name);
    setEmail(e.email);
    setPassword("");
    setSpecialization(
      e.specialization && isSpecialization(e.specialization)
        ? e.specialization
        : "SALARY"
    );
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setSpecialization("SALARY");
  }

  async function refreshEmployees() {
    const res = await fetch("/api/employees");
    if (res.ok) {
      const data = await res.json();
      setEmployees(data.employees);
    } else {
      router.refresh();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const isEdit = !!editingId;
    const body: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      specialization,
    };
    if (password) body.password = password;

    try {
      const res = await fetch(
        isEdit ? `/api/employees/${editingId}` : "/api/employees",
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
      await refreshEmployees();
      setSuccess(
        isEdit ? "Данные сотрудника обновлены" : "Сотрудник добавлен"
      );
      setEditingId(null);
      setOpen(false);
      resetForm();
      setSaving(false);
    } catch {
      setError("Не удалось сохранить сотрудника");
      setSaving(false);
    }
  }

  function startEdit(e: Employee) {
    setError("");
    setSuccess("");
    setEditingId(e.id);
    fillForm(e);
    setOpen(true);
  }

  function startCreate() {
    setError("");
    setSuccess("");
    setEditingId(null);
    resetForm();
    setOpen(true);
  }

  async function handleDelete(e: Employee) {
    if (!window.confirm(`Удалить сотрудника «${e.name}»?`)) return;
    setError("");
    setSuccess("");
    setDeletingId(e.id);
    try {
      const res = await fetch(`/api/employees/${e.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка удаления");
        setDeletingId(null);
        return;
      }
      await refreshEmployees();
      setSuccess(`Сотрудник «${e.name}» удалён`);
      setDeletingId(null);
    } catch {
      setError("Не удалось удалить сотрудника");
      setDeletingId(null);
    }
  }

  const label = "mb-1 block text-xs font-medium text-zinc-600";
  const input =
    "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500";

  // «Зарплата сотрудников»: архивные задачи и факт-время за текущий месяц
  const now = new Date();
  const monthName = now.toLocaleDateString("ru-RU", { month: "long" });
  function tasksForEmployee(id: string): EmployeeTask[] {
    return taskList.filter((t) => t.assignedToId === id || t.executorId === id);
  }
  function factForMonth(id: string): number {
    return tasksForEmployee(id).reduce((sum, t) => {
      if (!t.deadline) return sum;
      const d = new Date(t.deadline);
      if (isNaN(d.getTime())) return sum;
      if (
        d.getMonth() !== now.getMonth() ||
        d.getFullYear() !== now.getFullYear()
      ) {
        return sum;
      }
      return sum + (t.factDurationMinutes ?? 0);
    }, 0);
  }
  function toggleEmployee(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Раскрытые фирмы внутри сотрудника: ключ `${employeeId}:${clientId}`
  const [expandedClient, setExpandedClient] = useState<Set<string>>(new Set());
  function toggleClient(key: string) {
    setExpandedClient((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Раскрытые типы внутри фирмы: ключ `${employeeId}:${clientId}:${taskType}`
  const [expandedType, setExpandedType] = useState<Set<string>>(new Set());
  function toggleType(key: string) {
    setExpandedType((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Группировка задач внутри фирмы по типу карточки — по убыванию времени
  type TypeGroup = { taskType: string; tasks: EmployeeTask[]; minutes: number };
  function typesForClient(clientGroup: ClientGroup): TypeGroup[] {
    const map = new Map<string, TypeGroup>();
    for (const t of clientGroup.tasks) {
      const g = map.get(t.taskType);
      if (g) {
        g.tasks.push(t);
        g.minutes += t.factDurationMinutes ?? 0;
      } else {
        map.set(t.taskType, {
          taskType: t.taskType,
          tasks: [t],
          minutes: t.factDurationMinutes ?? 0,
        });
      }
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        tasks: [...g.tasks].sort(
          (a, b) => (b.factDurationMinutes ?? 0) - (a.factDurationMinutes ?? 0)
        ),
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  // Группировка задач сотрудника по фирмам — по убыванию времени
  type ClientGroup = {
    id: string;
    name: string;
    tasks: EmployeeTask[];
    minutes: number;
  };
  function clientsForEmployee(id: string): ClientGroup[] {
    const map = new Map<string, ClientGroup>();
    for (const t of tasksForEmployee(id)) {
      const g = map.get(t.client.id);
      if (g) {
        g.tasks.push(t);
        g.minutes += t.factDurationMinutes ?? 0;
      } else {
        map.set(t.client.id, {
          id: t.client.id,
          name: t.client.name,
          tasks: [t],
          minutes: t.factDurationMinutes ?? 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-bold text-zinc-900">Спика</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            Сотрудники
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
              Сотрудники ({employees.length})
            </h1>
          </div>
          <button
            onClick={() => (open && !editingId ? setOpen(false) : startCreate())}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {open && !editingId ? "Скрыть форму" : "Новый сотрудник"}
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Чтобы выдать доступ сотруднику, создайте учётную запись и передайте ему
          email и пароль. Вход в систему выполняется на странице входа.
        </div>

        {open && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 grid grid-cols-1 gap-x-4 gap-y-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="sm:col-span-2 lg:col-span-4 -mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-800">
                {editingId ? "Редактирование сотрудника" : "Новый сотрудник"}
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
              <label className={label}>Имя *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Фамилия И."
                className={input}
              />
            </div>
            <div>
              <label className={label}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Сотрудник@spica.ru"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Специализация</label>
              <select
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className={input}
              >
                <option value="SALARY">Зарплата</option>
                <option value="TAX">Налоги</option>
                <option value="DOCS">Ввод док-тов</option>
                <option value="">Общая</option>
              </select>
            </div>
            <div>
              <label className={label}>
                Пароль {editingId ? "(оставьте пустым, чтобы не менять)" : "*"}
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!editingId}
                minLength={6}
                placeholder="Минимум 6 символов"
                className={input}
              />
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
                    : "Добавить сотрудника"}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs font-semibold text-zinc-600">
                <th className="border-b border-r border-zinc-200 px-3 py-2 w-[18ch]">Имя</th>
                <th className="border-b border-r border-zinc-200 px-3 py-2 w-[24ch]">Email</th>
                <th className="border-b border-r border-zinc-200 px-3 py-2 w-[12ch]">Специализация</th>
                <th className="border-b px-3 py-2 w-[16ch]"></th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-400">
                    Сотрудников пока нет
                  </td>
                </tr>
              )}
              {employees.map((e) => (
                <tr key={e.id} className="align-top hover:bg-zinc-50">
                  <td className="border-b border-r border-zinc-100 px-3 py-2">
                    <div className="flex items-center gap-1.5 font-medium text-zinc-900">
                      <UserRound className="h-3.5 w-3.5 text-zinc-400" />
                      {e.name}
                    </div>
                  </td>
                  <td className="border-b border-r border-zinc-100 px-3 py-2">
                    <div className="truncate" title={e.email}>
                      {e.email}
                    </div>
                  </td>
                  <td className="border-b border-r border-zinc-100 px-3 py-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      {specLabel(e.specialization)}
                    </span>
                  </td>
                  <td className="border-b px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => startEdit(e)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Изменить
                      </button>
                      <button
                        onClick={() => handleDelete(e)}
                        disabled={deletingId === e.id}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === e.id ? "Удаление..." : "Удалить"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-zinc-900">
              Зарплата сотрудников
            </h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {monthName} {now.getFullYear()}
            </span>
          </div>
          {taskError && (
            <p className="mb-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">
              {taskError}
            </p>
          )}

          <div className="overflow-auto rounded-xl border border-zinc-200 bg-white">
            <table className="border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-50 text-left text-xs font-semibold text-zinc-600">
                  <th className="border-b border-r border-zinc-200 px-3 py-2">
                    Сотрудник / Фирма / Запись
                  </th>
                  <th className="border-b border-r border-zinc-200 px-3 py-2">
                    Специализация
                  </th>
                  <th className="border-b border-r border-zinc-200 px-3 py-2">
                    Срок
                  </th>
                  <th className="border-b border-r border-zinc-200 px-3 py-2">
                    Дата архива
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-right">
                    Факт
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-sm text-zinc-400"
                    >
                      Сотрудников пока нет
                    </td>
                  </tr>
                )}
                {employees.map((e) => {
                  const empTasks = tasksForEmployee(e.id);
                  const isExpanded = expanded.has(e.id);
                  return (
                    <Fragment key={e.id}>
                      <tr
                        onClick={() => toggleEmployee(e.id)}
                        className="cursor-pointer bg-white transition hover:bg-zinc-50"
                      >
                        <td className="border-b border-r border-zinc-100 px-3 py-2">
                          <span className="flex items-center gap-2 font-semibold text-zinc-900">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-zinc-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-zinc-400" />
                            )}
                            <UserRound className="h-4 w-4 text-zinc-400" />
                            {e.name}
                          </span>
                        </td>
                        <td className="border-b border-r border-zinc-100 px-3 py-2">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                            {specLabel(e.specialization)}
                          </span>
                        </td>
                        <td className="border-b border-r border-zinc-100 px-3 py-2 text-xs text-zinc-400">
                          —
                        </td>
                        <td className="border-b border-r border-zinc-100 px-3 py-2 text-xs text-zinc-400">
                          {empTasks.length} записей
                        </td>
                        <td className="border-b px-3 py-2 text-right">
                          <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            {formatHours(factForMonth(e.id))} ч за {monthName}
                          </span>
                        </td>
                      </tr>

                      {isExpanded &&
                        (empTasks.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="border-b border-zinc-100 bg-zinc-50/40 px-3 py-3 pl-10 text-sm text-zinc-400"
                            >
                              Архивных записей нет
                            </td>
                          </tr>
                        ) : (
                          clientsForEmployee(e.id).map((cg) => {
                            const key = `${e.id}:${cg.id}`;
                            const clientOpen = expandedClient.has(key);
                            return (
                              <Fragment key={key}>
                                <tr
                                  onClick={() => toggleClient(key)}
                                  className="cursor-pointer bg-zinc-50/60 transition hover:bg-zinc-100"
                                >
                                  <td className="border-b border-r border-zinc-100 px-3 py-2 pl-10">
                                    <span className="flex items-center gap-2 font-medium text-zinc-800">
                                      {clientOpen ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                                      )}
                                      {cg.name}
                                    </span>
                                  </td>
                                  <td
                                    colSpan={3}
                                    className="border-b border-r border-zinc-100 px-3 py-2 text-xs text-zinc-400"
                                  >
                                    {cg.tasks.length} записей
                                  </td>
                                  <td className="border-b px-3 py-2 text-right">
                                    <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                      {formatHours(cg.minutes)} ч
                                    </span>
                                  </td>
                                </tr>

                                {clientOpen &&
                                  typesForClient(cg).map((tg) => {
                                    const typeKey = `${key}:${tg.taskType}`;
                                    const typeOpen = expandedType.has(typeKey);
                                    return (
                                      <Fragment key={typeKey}>
                                        <tr
                                          onClick={() => toggleType(typeKey)}
                                          className="cursor-pointer bg-zinc-100/50 transition hover:bg-zinc-100"
                                        >
                                          <td className="border-b border-r border-zinc-100 px-3 py-2 pl-16">
                                            <span className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                                              {typeOpen ? (
                                                <ChevronDown className="h-3 w-3 text-zinc-400" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3 text-zinc-400" />
                                              )}
                                              {TASK_TYPE_LABELS[tg.taskType] ??
                                                tg.taskType}
                                            </span>
                                          </td>
                                          <td
                                            colSpan={3}
                                            className="border-b border-r border-zinc-100 px-3 py-2 text-xs text-zinc-400"
                                          >
                                            {tg.tasks.length} записей
                                          </td>
                                          <td className="border-b px-3 py-2 text-right">
                                            <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                              {formatHours(tg.minutes)} ч
                                            </span>
                                          </td>
                                        </tr>

                                        {typeOpen &&
                                          tg.tasks.map((t) => (
                                            <tr
                                              key={t.id}
                                              className="bg-white hover:bg-zinc-50"
                                            >
                                              <td className="border-b border-r border-zinc-100 px-3 py-2 text-sm text-zinc-900">
                                                <div className="flex flex-col gap-1">
                                                  <span>{t.title}</span>
                                                  {editingTaskId === t.id && (
                                                    <select
                                                      value={editTypeValue}
                                                      onChange={(e) =>
                                                        setEditTypeValue(
                                                          e.target.value
                                                        )
                                                      }
                                                      className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs outline-none focus:border-blue-500"
                                                    >
                                                      {Object.entries(
                                                        TASK_TYPE_LABELS
                                                      ).map(([val, lbl]) => (
                                                        <option
                                                          key={val}
                                                          value={val}
                                                        >
                                                          {lbl}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="border-b border-r border-zinc-100 px-3 py-2 text-xs text-zinc-500">
                                                —
                                              </td>
                                              <td className="border-b border-r border-zinc-100 px-3 py-2 text-xs text-zinc-600">
                                                {fmtDate(t.deadline)}
                                              </td>
                                              <td className="border-b border-r border-zinc-100 px-3 py-2 text-xs text-zinc-600">
                                                {fmtDate(t.archivedAt)}
                                              </td>
                                              <td className="border-b px-3 py-2 text-right">
                                                {editingTaskId === t.id ? (
                                                  <span className="flex items-center justify-end gap-1">
                                                    <input
                                                      type="number"
                                                      min={0}
                                                      value={editFactValue}
                                                      onChange={(e) =>
                                                        setEditFactValue(
                                                          e.target.value
                                                        )
                                                      }
                                                      autoFocus
                                                      className="w-16 rounded border border-zinc-300 px-1.5 py-0.5 text-xs outline-none focus:border-blue-500"
                                                    />
                                                    <button
                                                      onClick={() =>
                                                        saveTask(t.id)
                                                      }
                                                      disabled={savingTask}
                                                      className="rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                                    >
                                                      {savingTask ? "..." : "ОК"}
                                                    </button>
                                                    <button
                                                      onClick={() =>
                                                        setEditingTaskId(null)
                                                      }
                                                      className="rounded border border-zinc-300 px-1.5 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-50"
                                                    >
                                                      Отмена
                                                    </button>
                                                  </span>
                                                ) : (
                                                  <button
                                                    onClick={() => {
                                                      setEditingTaskId(t.id);
                                                      setEditFactValue(
                                                        t.factDurationMinutes !=
                                                          null
                                                          ? String(
                                                              t.factDurationMinutes
                                                            )
                                                          : ""
                                                      );
                                                      setEditTypeValue(
                                                        t.taskType
                                                      );
                                                      setTaskError("");
                                                    }}
                                                    title="Изменить тип и факт-время"
                                                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                                                      t.factDurationMinutes !=
                                                      null
                                                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                                                    }`}
                                                  >
                                                    {t.factDurationMinutes != null
                                                      ? `${t.factDurationMinutes} мин = ${formatHours(t.factDurationMinutes)} ч`
                                                      : "задать факт"}
                                                  </button>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                      </Fragment>
                                    );
                                  })}
                              </Fragment>
                            );
                          })
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

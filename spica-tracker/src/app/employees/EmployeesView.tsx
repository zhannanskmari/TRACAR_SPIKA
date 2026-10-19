"use client";

import { useState } from "react";
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
  CalendarDays,
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
    return tasks.filter((t) => t.assignedToId === id || t.executorId === id);
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

  // Группировка задач сотрудника по фирмам (по алфавиту)
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
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ru")
    );
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

          <div className="flex flex-col gap-2">
            {employees.length === 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white px-3 py-6 text-center text-sm text-zinc-400">
                Сотрудников пока нет
              </div>
            )}
            {employees.map((e) => {
              const empTasks = tasksForEmployee(e.id);
              const isExpanded = expanded.has(e.id);
              return (
                <div
                  key={e.id}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                >
                  <button
                    onClick={() => toggleEmployee(e.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-zinc-50"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                      )}
                      <UserRound className="h-4 w-4 text-zinc-400" />
                      {e.name}
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                        {specLabel(e.specialization)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {formatHours(factForMonth(e.id))} ч за {monthName}
                      </span>
                      <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
                        {empTasks.length}
                      </span>
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-100">
                      {empTasks.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-zinc-400">
                          Архивных записей нет
                        </div>
                      ) : (
                        <div className="flex flex-col divide-y divide-zinc-100">
                          {clientsForEmployee(e.id).map((cg) => {
                            const key = `${e.id}:${cg.id}`;
                            const clientOpen = expandedClient.has(key);
                            return (
                              <div key={cg.id}>
                                <button
                                  onClick={() => toggleClient(key)}
                                  className="flex w-full items-center justify-between gap-2 bg-zinc-50/50 px-3 py-2 text-left transition hover:bg-zinc-100"
                                >
                                  <span className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                                    {clientOpen ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                                    )}
                                    {cg.name}
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                      {formatHours(cg.minutes)} ч
                                    </span>
                                    <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                                      {cg.tasks.length}
                                    </span>
                                  </span>
                                </button>

                                {clientOpen && (
                                  <div className="flex flex-col divide-y divide-zinc-100 border-t border-zinc-100">
                                    {cg.tasks.map((t) => (
                                      <div
                                        key={t.id}
                                        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 pl-8"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-sm font-medium text-zinc-900">
                                            {t.title}
                                          </div>
                                          <div className="text-xs text-zinc-500">
                                            {TASK_TYPE_LABELS[t.taskType] ??
                                              t.taskType}
                                            {t.deadline
                                              ? ` · срок: ${fmtDate(t.deadline)}`
                                              : ""}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-zinc-400">
                                          <CalendarDays className="h-3 w-3" />
                                          {fmtDate(t.archivedAt)}
                                        </div>
                                        <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                          {t.factDurationMinutes != null
                                            ? `${t.factDurationMinutes} мин = ${formatHours(t.factDurationMinutes)} ч`
                                            : "факт не указан"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ArchiveRestore,
  CalendarDays,
  Eye,
  X,
  MessageSquare,
  Paperclip,
  Flame,
} from "lucide-react";
import type { DashboardTask } from "./DashboardView";
import {
  STATUS_LABELS,
  TASK_TYPE_LABELS,
  TASK_TYPE_BADGES,
} from "@/lib/task-meta";

const STATUS_BADGE: Record<string, string> = {
  NEW: "border-zinc-300 text-zinc-700",
  IN_PROGRESS: "border-blue-300 text-blue-700",
  DONE: "border-green-300 text-green-700",
  SENT_TO_CLIENT: "border-violet-300 text-violet-700",
  REWORK: "border-amber-300 text-amber-700",
  OVERDUE: "border-red-300 text-red-700",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU");
}

function fmtDateTime(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("ru-RU")} ${date.toLocaleTimeString(
    "ru-RU",
    { hour: "2-digit", minute: "2-digit" }
  )}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const label = "mb-1 block text-xs font-medium text-zinc-500";
const value = "text-sm text-zinc-900";

function Field({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div>
      <div className={label}>{title}</div>
      <div className={value}>{children || "—"}</div>
    </div>
  );
}

export default function ArchiveView({
  tasks,
  onRestore,
  restoringId,
}: {
  tasks: DashboardTask[];
  onRestore: (id: string) => Promise<void>;
  restoringId: string | null;
}) {
  const [viewing, setViewing] = useState<DashboardTask | null>(null);

  return (
    <div className="flex h-full flex-col overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-800">
          Архив задач
          <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {tasks.length}
          </span>
        </h2>
      </div>
      {tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
          В архиве пока пусто
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-zinc-200 px-3 py-2"
            >
              <span
                className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                  STATUS_BADGE[task.status] ?? "border-zinc-300 text-zinc-700"
                }`}
              >
                {STATUS_LABELS[task.status as keyof typeof STATUS_LABELS] ??
                  task.status}
              </span>
              <span
                className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${TASK_TYPE_BADGES[task.taskType] ?? TASK_TYPE_BADGES.OTHER}`}
              >
                {TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900">
                  {task.title}
                </div>
                <div className="text-xs text-zinc-500">
                  {task.client.name}
                  {task.deadline ? ` • срок: ${fmtDate(task.deadline)}` : ""}
                  {task.amount != null
                    ? ` • ${task.amount.toLocaleString("ru-RU")} ₽`
                    : ""}
                </div>
              </div>
              <div className="hidden text-xs text-zinc-500 sm:block">
                Отв: {initials(task.assignedTo.name)}
              </div>
              <div className="flex items-center gap-1 text-xs text-zinc-400">
                <CalendarDays className="h-3 w-3" />
                {fmtDateTime(task.archivedAt)}
              </div>
              <button
                onClick={() => setViewing(task)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                <Eye className="h-3.5 w-3.5" />
                Просмотр
              </button>
              <button
                onClick={() => onRestore(task.id)}
                disabled={restoringId === task.id}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
                Вернуть
              </button>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setViewing(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-xs text-zinc-500">
                  {viewing.client.name} · {viewing.client.taxSystem}
                </div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  {viewing.title}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                      STATUS_BADGE[viewing.status] ??
                      "border-zinc-300 text-zinc-700"
                    }`}
                  >
                    {STATUS_LABELS[
                      viewing.status as keyof typeof STATUS_LABELS
                    ] ?? viewing.status}
                  </span>
                  <span
                    className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${TASK_TYPE_BADGES[viewing.taskType] ?? TASK_TYPE_BADGES.OTHER}`}
                  >
                    {TASK_TYPE_LABELS[viewing.taskType] ?? viewing.taskType}
                  </span>
                  {viewing.urgent && (
                    <span className="flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-600">
                      <Flame className="h-3 w-3" />
                      Срочно
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field title="Крайний срок">{fmtDate(viewing.deadline)}</Field>
              <Field title="Сумма к оплате">
                {viewing.amount != null
                  ? `${viewing.amount.toLocaleString("ru-RU")} ₽`
                  : null}
              </Field>
              <Field title="Сумма налога">
                {viewing.taxAmount != null
                  ? `${viewing.taxAmount.toLocaleString("ru-RU")} ₽`
                  : null}
              </Field>
              <Field title="Дата уплаты налога">
                {fmtDate(viewing.taxPaymentDate)}
              </Field>
              <Field title="План, мин">{viewing.durationMinutes}</Field>
              <Field title="Факт, мин">{viewing.factDurationMinutes}</Field>
              <Field title="Ответственный">
                {viewing.assignedTo?.name}
              </Field>
              <Field title="Создал(а)">{viewing.createdBy?.name}</Field>
              <Field title="Архивирована">
                {fmtDateTime(viewing.archivedAt)}
              </Field>
              <Field title="Документы">
                {viewing._count?.documents != null &&
                viewing._count.documents > 0 ? (
                  <span className="flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5" />
                    {viewing._count.documents}
                  </span>
                ) : null}
              </Field>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                <MessageSquare className="h-4 w-4 text-zinc-400" />
                Комментарии ({viewing.comments.length})
              </div>
              {viewing.comments.length === 0 ? (
                <div className="text-sm text-zinc-400">
                  Комментариев нет
                </div>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {viewing.comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg bg-zinc-50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-700">
                          {c.user.name}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {fmtDateTime(c.createdAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-zinc-600">{c.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setViewing(null)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <X className="h-4 w-4" />
                Закрыть
              </button>
              <button
                onClick={() => {
                  const id = viewing.id;
                  setViewing(null);
                  onRestore(id);
                }}
                disabled={restoringId === viewing.id}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <ArchiveRestore className="h-4 w-4" />
                Вернуть на доску
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  MessageSquare,
  Bell,
  BellOff,
  Building2,
  Flame,
  Clock4,
  Pencil,
  Check,
  X,
} from "lucide-react";
import type { DashboardTask } from "./DashboardView";
import { TASK_TYPE_LABELS, TASK_TYPE_BADGES } from "@/lib/task-meta";

const TASK_TYPES = [
  "SALARY_CALC",
  "SALARY_PAYMENT",
  "TAX_PAYMENT",
  "REPORT",
  "IFNS_DEMAND",
  "CLIENT_REQUEST",
  "OTHER",
];

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join(".")
      .toUpperCase() + "."
  );
}

function isOverdue(task: DashboardTask): boolean {
  if (task.status === "DONE" || task.status === "SENT_TO_CLIENT") return false;
  if (task.deadline && new Date(task.deadline).getTime() < Date.now()) {
    return true;
  }
  return false;
}

export default function TaskCard({
  task,
  patchTask,
  canEditTax,
  executors,
}: {
  task: DashboardTask;
  patchTask: (
    id: string,
    data: Record<string, unknown>
  ) => Promise<unknown>;
  canEditTax: boolean;
  executors: { id: string; name: string; specialization: string | null }[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(task.comments);
  const [notified, setNotified] = useState(task.isClientNotified);

  const [editing, setEditing] = useState(false);
  const [edTitle, setEdTitle] = useState(task.title);
  const [edTaskType, setEdTaskType] = useState(task.taskType);
  const [edDeadline, setEdDeadline] = useState(toDateInput(task.deadline));
  const [edUrgent, setEdUrgent] = useState(task.urgent);
  const [edTaxAmount, setEdTaxAmount] = useState(
    task.taxAmount != null ? String(task.taxAmount) : ""
  );
  const [edTaxPaymentDate, setEdTaxPaymentDate] = useState(
    toDateInput(task.taxPaymentDate)
  );
  const [edAssignedToId, setEdAssignedToId] = useState(
    task.assignedTo?.id ?? ""
  );
  const [edDuration, setEdDuration] = useState(
    task.durationMinutes != null ? String(task.durationMinutes) : ""
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  async function addComment() {
    if (!commentText.trim()) return;
    const res = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentText }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
      setCommentText("");
    }
  }

  async function toggleNotify() {
    try {
      const updated = (await patchTask(task.id, {
        isClientNotified: !notified,
      })) as DashboardTask;
      setNotified(updated.isClientNotified);
    } catch (e) {
      console.error(e);
    }
  }

  function startEdit() {
    setEdTitle(task.title);
    setEdTaskType(task.taskType);
    setEdDeadline(toDateInput(task.deadline));
    setEdUrgent(task.urgent);
    setEdTaxAmount(task.taxAmount != null ? String(task.taxAmount) : "");
    setEdTaxPaymentDate(toDateInput(task.taxPaymentDate));
    setEdAssignedToId(task.assignedTo?.id ?? "");
    setEdDuration(task.durationMinutes != null ? String(task.durationMinutes) : "");
    setSaveError("");
    setEditing(true);
  }

  async function saveEdit() {
    if (!edTitle.trim()) {
      setSaveError("Укажите название");
      return;
    }
    setSaving(true);
    setSaveError("");

    const patch: Record<string, unknown> = {};
    if (edTitle.trim() !== task.title) patch.title = edTitle.trim();
    if (edTaskType !== task.taskType) patch.taskType = edTaskType;
    if (edUrgent !== task.urgent) patch.urgent = edUrgent;

    const oldAssigned = task.assignedTo?.id ?? "";
    if (edAssignedToId && edAssignedToId !== oldAssigned) {
      patch.assignedToId = edAssignedToId;
    }

    const newDuration = edDuration === "" ? null : Math.max(0, Number(edDuration));
    const oldDuration = task.durationMinutes ?? null;
    // если введено некорректное значение — не отправляем
    if (
      edDuration !== "" &&
      newDuration !== null &&
      !isNaN(newDuration) &&
      newDuration !== oldDuration
    ) {
      patch.durationMinutes = Math.round(newDuration);
    } else if (edDuration === "" && oldDuration !== null) {
      patch.durationMinutes = null;
    }

    const newDeadline = edDeadline
      ? new Date(edDeadline).toISOString()
      : null;
    const oldDeadline = task.deadline
      ? toDateInput(task.deadline)
      : "";
    if (newDeadline !== (oldDeadline ? new Date(oldDeadline).toISOString() : null)) {
      patch.deadline = newDeadline;
    }

    if (canEditTax) {
      const newTax = edTaxAmount === "" ? null : Number(edTaxAmount);
      const oldTax = task.taxAmount ?? null;
      if (newTax !== oldTax) patch.taxAmount = newTax;

      const newTaxDate = edTaxPaymentDate
        ? new Date(edTaxPaymentDate).toISOString()
        : null;
      const oldTaxDate = task.taxPaymentDate ?? null;
      if (newTaxDate !== oldTaxDate) patch.taxPaymentDate = newTaxDate;
    }

    try {
      await patchTask(task.id, patch);
      setEditing(false);
    } catch (e) {
      console.error(e);
      setSaveError("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group cursor-grab rounded-lg border border-zinc-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
      onClick={(e) => {
        // клик по пустому месту карточки не редактирует случайно
        void e;
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {(task.urgent || isOverdue(task)) && (
            <span
              title={task.urgent ? "Срочная задача" : "Просрочена"}
              className={`shrink-0 rounded px-1 py-0.5 ${task.urgent ? "bg-red-100" : "bg-amber-100"}`}
            >
              <Flame
                className={`h-3 w-3 ${task.urgent ? "text-red-600" : "text-amber-600"}`}
              />
            </span>
          )}
          <span
            className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${TASK_TYPE_BADGES[task.taskType] ?? TASK_TYPE_BADGES.OTHER}`}
          >
            {TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {task.taxAmount != null && (
            <span className="text-xs font-semibold text-zinc-700">
              {task.taxAmount.toLocaleString("ru-RU")} ₽
            </span>
          )}
          {!editing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                startEdit();
              }}
              title="Редактировать"
              className="rounded p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="space-y-2"
        >
          <textarea
            value={edTitle}
            onChange={(e) => setEdTitle(e.target.value)}
            rows={2}
            placeholder="Название задачи"
            className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">
                Тип
              </label>
              <select
                value={edTaskType}
                onChange={(e) => setEdTaskType(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-1.5 py-1 text-xs outline-none focus:border-blue-500"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TASK_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">
                Срок
              </label>
              <input
                type="date"
                value={edDeadline}
                onChange={(e) => setEdDeadline(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-1.5 py-1 text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">
              Время, мин
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={edDuration}
              onChange={(e) => setEdDuration(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-zinc-300 px-1.5 py-1 text-xs outline-none focus:border-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={edUrgent}
              onChange={(e) => setEdUrgent(e.target.checked)}
              className="h-3.5 w-3.5 accent-red-600"
            />
            <Flame className="h-3.5 w-3.5 text-red-500" />
            Срочно
          </label>
          {executors.length > 0 && (
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">
                Ответственный
              </label>
              <select
                value={edAssignedToId}
                onChange={(e) => setEdAssignedToId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-1.5 py-1 text-xs outline-none focus:border-blue-500"
              >
                <option value="">Не выбран</option>
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
            </div>
          )}
          {canEditTax && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">
                  Сумма налога, ₽
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={edTaxAmount}
                  onChange={(e) => setEdTaxAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-300 px-1.5 py-1 text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">
                  Дата уплаты
                </label>
                <input
                  type="date"
                  value={edTaxPaymentDate}
                  onChange={(e) => setEdTaxPaymentDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-1.5 py-1 text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
          {saveError && (
            <p className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-600">
              {saveError}
            </p>
          )}
          <div className="flex gap-1.5">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(false);
              }}
              className="flex items-center gap-1 rounded-lg bg-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm font-semibold leading-snug text-zinc-900">
            {task.title}
          </p>

          <div className="mb-2 flex items-center gap-1 text-xs text-zinc-500">
            <Building2 className="h-3.5 w-3.5" />
            {task.client.name}
            <span className="rounded bg-zinc-100 px-1 py-px text-[10px] text-zinc-500">
              {task.client.taxSystem}
            </span>
          </div>

          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
            {task.assignedTo && (
              <span className="flex min-w-0 items-center gap-1">
                <Clock4 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Отв. — {initials(task.assignedTo.name)}</span>
              </span>
            )}
            {task.deadline && (
              <span className="flex shrink-0 items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                до {formatDate(task.deadline)}
              </span>
            )}
          </div>

          {task.durationMinutes != null && (
            <div className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
              <Clock4 className="h-3.5 w-3.5 shrink-0" />
              <span>Время: {task.durationMinutes} мин</span>
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-between border-t border-zinc-100 pt-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleNotify();
          }}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition ${
            notified
              ? "bg-blue-100 text-blue-700"
              : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          }`}
        >
          {notified ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
          {notified ? "Клиент уведомлён" : "Уведомить клиента"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowComments((v) => !v);
          }}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100"
        >
          <MessageSquare className="h-3 w-3" />
          {comments.length}
        </button>
      </div>

      {showComments && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2 border-t border-zinc-100 pt-2"
        >
          <div className="mb-2 space-y-2">
            {comments.length === 0 && (
              <p className="text-xs text-zinc-400">Комментариев пока нет</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="text-xs">
                <div className="font-medium text-zinc-700">{c.user.name}</div>
                <div className="text-zinc-500">{c.text}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Добавить комментарий..."
              className="min-w-0 flex-1 rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
            />
            <button
              onClick={addComment}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              Отпр.
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

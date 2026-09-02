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
} from "lucide-react";
import type { DashboardTask } from "./DashboardView";
import { TASK_TYPE_LABELS, TASK_TYPE_BADGES } from "@/lib/task-meta";

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join(".")
    .toUpperCase() + ".";
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
}: {
  task: DashboardTask;
  patchTask: (
    id: string,
    data: Record<string, unknown>
  ) => Promise<unknown>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(task.comments);
  const [notified, setNotified] = useState(task.isClientNotified);

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group cursor-grab rounded-lg border border-zinc-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
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
        {task.taxAmount != null && (
          <span className="text-xs font-semibold text-zinc-700">
            {task.taxAmount.toLocaleString("ru-RU")} ₽
          </span>
        )}
      </div>

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

      {task.assignedTo && (
        <div className="mb-2 flex items-center gap-1 text-xs text-zinc-500">
          <Clock4 className="h-3.5 w-3.5" />
          Отв. — {initials(task.assignedTo.name)}
        </div>
      )}

      {task.deadline && (
        <div className="mb-2 flex items-center gap-1 text-xs text-zinc-500">
          <Calendar className="h-3.5 w-3.5" />
          до {formatDate(task.deadline)}
        </div>
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TaskCard from "./TaskCard";
import type { DashboardTask } from "./DashboardView";
import { STATUS_LABELS, STATUS_COLORS, type TaskStatus } from "@/lib/task-meta";

const COLUMN_ORDER: TaskStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "REWORK",
  "DONE",
  "SENT_TO_CLIENT",
  "OVERDUE",
];

function sameTask(a: DashboardTask, b: DashboardTask): boolean {
  return (
    a.title === b.title &&
    a.taskType === b.taskType &&
    a.status === b.status &&
    a.deadline === b.deadline &&
    a.taxAmount === b.taxAmount &&
    a.taxPaymentDate === b.taxPaymentDate &&
    a.urgent === b.urgent &&
    a.isClientNotified === b.isClientNotified &&
    a.assignedTo?.id === b.assignedTo?.id
  );
}

// Идентификатор невидимой «зоны сброса» в конце каждой колонки,
// чтобы карточку можно было бросить в пустой конец колонки
const PLACEHOLDER = (status: string) => `${status}-drop-zone`;

function ColumnDropZone({ status }: { status: string }) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({
    id: PLACEHOLDER(status),
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 0,
      }}
      className="min-h-8 flex-1 py-1"
    />
  );
}

export default function KanbanBoard({
  tasks,
  patchTask,
  deleteTask,
  user,
  canEditTax,
  executors,
}: {
  tasks: DashboardTask[];
  patchTask: (
    id: string,
    data: Record<string, unknown>
  ) => Promise<unknown>;
  deleteTask: (id: string) => Promise<unknown>;
  user: { id: string; role: string };
  canEditTax: boolean;
  executors: { id: string; name: string; specialization: string | null }[];
}) {
  const [columns, setColumns] = useState<Record<string, DashboardTask[]>>(
    () => {
      const init: Record<string, DashboardTask[]> = {};
      for (const s of COLUMN_ORDER) init[s] = [];
      for (const t of tasks) {
        (init[t.status] ??= []).push(t);
      }
      return init;
    }
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Запоминаем исходную колонку перетаскиваемой карточки (для сохранения в БД)
  const dragSourceRef = useRef<{ id: string; fromStatus: string } | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const task = findTask(event.active.id as string);
    dragSourceRef.current = task
      ? { id: task.id, fromStatus: task.status }
      : null;
  }

  // Синхронизация с приходящими задачами (новые появляются, изменённые обновляются, удалённые исчезают)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumns((prev) => {
      const incomingIds = new Set(tasks.map((t) => t.id));
      const prevCount = COLUMN_ORDER.reduce((n, s) => n + (prev[s]?.length ?? 0), 0);
      const next: Record<string, DashboardTask[]> = {};
      const remaining = new Map<string, DashboardTask>();
      for (const s of COLUMN_ORDER) {
        next[s] = (prev[s] ?? []).filter((t) => incomingIds.has(t.id));
      }
      for (const s of COLUMN_ORDER) {
        for (const t of next[s]) remaining.set(t.id, t);
      }

      let changed = false;
      const nextCount = COLUMN_ORDER.reduce((n, s) => n + (next[s]?.length ?? 0), 0);
      if (nextCount !== prevCount) changed = true;
      for (const t of tasks) {
        const existing = remaining.get(t.id);
        if (!existing) {
          (next[t.status] ??= []).unshift(t);
          changed = true;
        } else if (existing.status !== t.status) {
          // перемещение между колонками
          for (const s of COLUMN_ORDER) {
            next[s] = (next[s] ?? []).filter((x) => x.id !== t.id);
          }
          (next[t.status] ??= []).push({ ...t });
          changed = true;
        } else {
          // та же колонка — обновляем поля карточки на месте (сохраняя порядок),
          // чтобы отредактированные данные (название, налог и т.п.) отобразились сразу
          const list = next[t.status] ?? [];
          const idx = list.findIndex((x) => x.id === t.id);
          if (idx !== -1 && !sameTask(list[idx], t)) {
            list[idx] = t;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [tasks]);

  const taskIdsByColumn = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const s of COLUMN_ORDER) {
      // добавляем «зону сброса» в конец колонки, чтобы можно было бросать
      // в пустую/нижнюю часть колонки
      map[s] = [...columns[s].map((t) => t.id), PLACEHOLDER(s)];
    }
    return map;
  }, [columns]);

  function findContainer(id: string | number): string | undefined {
    if (typeof id === "string") {
      for (const s of COLUMN_ORDER) {
        if (PLACEHOLDER(s) === id) return s;
      }
    }
    for (const s of COLUMN_ORDER) {
      if (columns[s].some((t) => t.id === id)) return s;
    }
    return undefined;
  }

  function findTask(id: string): DashboardTask | undefined {
    for (const s of COLUMN_ORDER) {
      const found = columns[s].find((t) => t.id === id);
      if (found) return found;
    }
    return undefined;
  }

  async function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);
    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setColumns((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      const overIndex = overItems.findIndex((t) => t.id === over.id);

      const activeTask = activeItems[activeIndex];
      if (!activeTask) return prev;

      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter(
          (t) => t.id !== active.id
        ),
        [overContainer]: [
          ...overItems.slice(0, overIndex),
          overIndex === -1 ? activeTask : { ...activeTask, status: overContainer },
          ...(overIndex === -1 ? [] : overItems.slice(overIndex)),
        ],
      };
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const source = dragSourceRef.current;
    dragSourceRef.current = null;
    if (!over) return;

    // Куда карточка попала по факту (onDragOver уже переместил её между колонками)
    const endContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);
    if (!endContainer || !overContainer) return;

    const activeIndex = columns[endContainer].findIndex(
      (t) => t.id === active.id
    );
    const overIndex = columns[overContainer].findIndex(
      (t) => t.id === over.id
    );

    // Переупорядочивание внутри одной колонки
    if (endContainer === overContainer && activeIndex !== -1 && overIndex !== -1) {
      if (activeIndex !== overIndex) {
        setColumns((prev) => ({
          ...prev,
          [endContainer]: arrayMove(prev[endContainer], activeIndex, overIndex),
        }));
      }
    }

    // Сохраняем смену статуса, если исходная колонка отличается от конечной.
    // Это происходит и когда onDragOver уже визуально переместил карточку
    // (тогда endContainer === overContainer), и при прямом пересечении колонок.
    const fromStatus = source?.fromStatus;
    if (fromStatus && fromStatus !== endContainer) {
      const activeTask = columns[endContainer][activeIndex] ?? findTask(active.id as string);
      if (!activeTask) return;
      try {
        await patchTask(activeTask.id, { status: endContainer });
      } catch (e) {
        console.error(e);
        // откат — возвращаем карточку в исходную колонку
        setColumns((prev) => ({
          ...prev,
          [fromStatus]: [
            ...(prev[fromStatus] ?? []).filter((t) => t.id !== activeTask.id),
            { ...activeTask, status: fromStatus },
          ],
          [endContainer]: (prev[endContainer] ?? []).filter(
            (t) => t.id !== activeTask.id
          ),
        }));
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto pb-2">
        {COLUMN_ORDER.map((status) => (
          <div
            key={status}
            className={`flex w-72 min-w-72 flex-col rounded-xl border ${STATUS_COLORS[status]}`}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <h2 className="text-sm font-semibold text-zinc-800">
                {STATUS_LABELS[status]}
              </h2>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-zinc-600">
                {columns[status].length}
              </span>
            </div>
            <SortableContext
              items={taskIdsByColumn[status]}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                {columns[status].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    patchTask={patchTask}
                    deleteTask={deleteTask}
                    user={user}
                    canEditTax={canEditTax}
                    executors={executors}
                  />
                ))}
                <ColumnDropZone status={status} />
              </div>
            </SortableContext>
          </div>
        ))}
      </div>
    </DndContext>
  );
}

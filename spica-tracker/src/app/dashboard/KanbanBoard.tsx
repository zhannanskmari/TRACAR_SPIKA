"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import TaskCard from "./TaskCard";
import type { DashboardTask } from "./DashboardView";
import { STATUS_LABELS, STATUS_COLORS, type TaskStatus } from "@/lib/task-meta";

const COLUMN_ORDER: TaskStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "REWORK",
  "SENT_TO_CLIENT",
  "DONE",
  "OVERDUE",
];

export default function KanbanBoard({
  tasks,
  patchTask,
}: {
  tasks: DashboardTask[];
  patchTask: (
    id: string,
    data: Record<string, unknown>
  ) => Promise<unknown>;
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

  // Синхронизация с приходящими задачами (новые появляются, изменённые обновляются)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumns((prev) => {
      const next: Record<string, DashboardTask[]> = {};
      const remaining = new Map<string, DashboardTask>();
      for (const s of COLUMN_ORDER) next[s] = prev[s] ?? [];
      for (const s of COLUMN_ORDER) {
        for (const t of next[s]) remaining.set(t.id, t);
      }

      let changed = false;
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
        }
      }
      return changed ? next : prev;
    });
  }, [tasks]);

  const taskIdsByColumn = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const s of COLUMN_ORDER) {
      map[s] = columns[s].map((t) => t.id);
    }
    return map;
  }, [columns]);

  function findContainer(id: string): string | undefined {
    for (const s of COLUMN_ORDER) {
      if (columns[s].some((t) => t.id === id)) return s;
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
    if (!over) return;
    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (!activeContainer || !overContainer) return;

    const activeIndex = columns[activeContainer].findIndex(
      (t) => t.id === active.id
    );
    const overIndex = columns[overContainer].findIndex(
      (t) => t.id === over.id
    );

    if (activeContainer === overContainer) {
      if (activeIndex !== overIndex) {
        const next = arrayMove(columns[activeContainer], activeIndex, overIndex);
        setColumns((prev) => ({ ...prev, [activeContainer]: next }));
      }
      return;
    }

    if (overIndex === -1) return;

    const activeTask = columns[activeContainer][activeIndex];

    const newStatus = overContainer;
    setColumns((prev) => ({
      ...prev,
      [activeContainer]: prev[activeContainer].filter(
        (t) => t.id !== active.id
      ),
      [overContainer]: [
        ...prev[overContainer].slice(0, overIndex),
        { ...activeTask, status: newStatus },
        ...prev[overContainer].slice(overIndex),
      ],
    }));

    if (activeTask.status !== newStatus) {
      try {
        await patchTask(activeTask.id, { status: newStatus });
      } catch (e) {
        console.error(e);
        // откат при ошибке
        setColumns((prev) => ({
          ...prev,
          [activeContainer]: [
            ...prev[activeContainer].slice(0, activeIndex),
            activeTask,
            ...prev[activeContainer].slice(activeIndex),
          ],
          [overContainer]: prev[overContainer].filter(
            (t) => t.id !== active.id
          ),
        }));
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
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
                  <TaskCard key={task.id} task={task} patchTask={patchTask} />
                ))}
              </div>
            </SortableContext>
          </div>
        ))}
      </div>
    </DndContext>
  );
}

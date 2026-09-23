import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toIso } from "@/lib/dates";
import {
  clientsVisibilityWhere,
  tasksVisibilityWhere,
  type SessionLike,
} from "@/lib/task-scope";

export type { SessionLike };

// Единая include-спека списка задач (раньше была продублирована
// в api/tasks, api/tasks/archive и dashboard/page.tsx).
// `satisfies` (а не аннотация) — чтобы вывести точный тип payload
// со связями для сериализации и пропсов страниц.
export const TASK_LIST_INCLUDE = {
  client: {
    select: { id: true, name: true, shortName: true, taxSystem: true },
  },
  assignedTo: { select: { id: true, name: true, specialization: true } },
  executor: { select: { id: true, name: true, specialization: true } },
  createdBy: { select: { id: true, name: true } },
  comments: {
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  },
  _count: { select: { documents: true } },
} satisfies Prisma.TaskInclude;

export async function getVisibleTasks(
  session: SessionLike,
  opts?: { archived?: boolean }
) {
  return prisma.task.findMany({
    where: tasksVisibilityWhere(session, opts),
    include: TASK_LIST_INCLUDE,
    orderBy: opts?.archived ? { archivedAt: "desc" } : { createdAt: "desc" },
  });
}

export type TaskListRow = Awaited<ReturnType<typeof getVisibleTasks>>[number];

// Сериализация дат Prisma-строки в ISO для передачи в клиентские компоненты
// (раньше была продублирована в dashboard/page.tsx и DashboardView.tsx).
export function serializeTask(task: TaskListRow) {
  return {
    ...task,
    deadline: toIso(task.deadline),
    receiptDeadline: toIso(task.receiptDeadline),
    taxPaymentDate: toIso(task.taxPaymentDate),
    salaryPaymentDate: toIso(task.salaryPaymentDate),
    salaryCalcDate: toIso(task.salaryCalcDate),
    archivedAt: toIso(task.archivedAt),
    createdAt: task.createdAt.toISOString(),
    comments: task.comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export async function listExecutors(session: SessionLike) {
  // Клиентам список сотрудников недоступен.
  if (session.role === "CLIENT") return [];
  return prisma.user.findMany({
    where: { role: "EXECUTOR" },
    select: { id: true, name: true, specialization: true },
    orderBy: { name: "asc" },
  });
}

export async function getVisibleClients(
  session: SessionLike,
  opts?: { includeExecutorTasks?: boolean }
) {
  return prisma.client.findMany({
    where: clientsVisibilityWhere(session, opts),
    orderBy: { name: "asc" },
  });
}

// Авто-распределение ответственного (раньше было продублировано
// в POST /api/tasks и POST /api/tasks/generate):
// исполнитель создаёт задачу себе; иначе — по правилу AssignmentRule,
// иначе — на primary-исполнителя клиента.
export async function resolveAssignee(
  session: SessionLike,
  input: { clientId: string; taskType: string; primaryExecutorId: string }
): Promise<string> {
  if (session.role === "EXECUTOR") return session.id;
  const rule = await prisma.assignmentRule.findUnique({
    where: {
      clientId_taskType: { clientId: input.clientId, taskType: input.taskType },
    },
  });
  return rule?.executorId ?? input.primaryExecutorId;
}

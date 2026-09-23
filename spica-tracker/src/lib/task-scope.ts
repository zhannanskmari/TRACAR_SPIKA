import type { Prisma } from "@prisma/client";

// Минимальный контракт сессии, достаточный для RBAC-фильтров.
// Совместим и с SessionUser из lib/auth, и с моделью User из Prisma.
export type SessionLike = {
  id: string;
  role: string;
};

// Видимость задач по ролям — единый источник правды для
// GET /api/tasks, GET /api/tasks/archive и dashboard/page.tsx:
// ADMIN — все; EXECUTOR — назначенные ему или где он исполнитель;
// CLIENT — только своя компания, где он создатель ИЛИ статус SENT_TO_CLIENT.
export function tasksVisibilityWhere(
  session: SessionLike,
  opts?: { archived?: boolean }
): Prisma.TaskWhereInput {
  const archivedAt = opts?.archived ? { not: null } : null;
  if (session.role === "ADMIN") return { archivedAt };
  if (session.role === "EXECUTOR") {
    return {
      archivedAt,
      OR: [{ assignedToId: session.id }, { executorId: session.id }],
    };
  }
  return {
    archivedAt,
    AND: [
      { client: { clientUserId: session.id } },
      { OR: [{ createdById: session.id }, { status: "SENT_TO_CLIENT" }] },
    ],
  };
}

// Видимость клиентов по ролям — единый источник правды для
// dashboard/page.tsx, GET /api/calendar, GET /api/payments и генераторов.
// includeExecutorTasks=true — вариант календаря: EXECUTOR видит и клиентов,
// где он только исполнитель задачи (а не ответственный).
export function clientsVisibilityWhere(
  session: SessionLike,
  opts?: { includeExecutorTasks?: boolean }
): Prisma.ClientWhereInput {
  if (session.role === "ADMIN") return {};
  if (session.role === "CLIENT") return { clientUserId: session.id };
  return {
    OR: [
      { primaryExecutorId: session.id },
      { secondaryExecutorId: session.id },
      {
        tasks: {
          some: opts?.includeExecutorTasks
            ? {
                OR: [
                  { assignedToId: session.id },
                  { executorId: session.id },
                ],
              }
            : { assignedToId: session.id },
        },
      },
    ],
  };
}

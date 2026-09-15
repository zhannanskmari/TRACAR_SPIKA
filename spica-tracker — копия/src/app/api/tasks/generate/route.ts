import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Action = "salary" | "advance";

const TASK_TYPE: Record<Action, string> = {
  salary: "SALARY_CALC",
  advance: "SALARY_ADVANCE",
};

function daysInMonth(year: number, month: number): number {
  // month — 0-индексный
  return new Date(year, month + 1, 0).getDate();
}

// Ближайший день месяца (из карточки клиента): если день этого месяца уже прошёл — берём следующий месяц
function nextDayOfMonth(day: number): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const maxDay = daysInMonth(year, month);
  const targetDay = Math.min(day, maxDay);
  const candidate = new Date(year, month, targetDay);
  const today = new Date(year, month, now.getDate());
  if (candidate.getTime() < today.getTime()) {
    const next = new Date(year, month + 1, 1);
    return new Date(next.getFullYear(), next.getMonth(), Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
  }
  return candidate;
}

function monthLabel(d: Date): string {
  const label = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function clientsWhere(session: { id: string; role: string }) {
  if (session.role === "ADMIN") return {};
  return {
    OR: [
      { primaryExecutorId: session.id },
      { secondaryExecutorId: session.id },
      { tasks: { some: { assignedToId: session.id } } },
    ],
  };
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "ADMIN" && session.role !== "EXECUTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const action: Action = body.action === "advance" ? "advance" : "salary";
  const taskType = TASK_TYPE[action];
  const dayField = action === "advance" ? "advanceDay" : "salaryPaymentDay";

  const clients = await prisma.client.findMany({
    where: {
      ...clientsWhere(session),
      [dayField]: { not: null },
    },
    select: {
      id: true,
      shortName: true,
      name: true,
      salaryPaymentDay: true,
      advanceDay: true,
      primaryExecutorId: true,
      secondaryExecutorId: true,
    },
    orderBy: { name: "asc" },
  });
  if (clients.length === 0) {
    return NextResponse.json({
      ok: true,
      count: 0,
      month: null,
      message: "Нет клиентов с заданной датой",
    });
  }

  let created = 0;
  for (const c of clients) {
    const day = action === "advance" ? c.advanceDay : c.salaryPaymentDay;
    if (!day) continue;
    const deadline = nextDayOfMonth(day);

    // уже есть задача этого типа с датой в этом месяце — не дублируем
    const start = new Date(deadline.getFullYear(), deadline.getMonth(), 1);
    const end = new Date(deadline.getFullYear(), deadline.getMonth() + 1, 1);
    const existing = await prisma.task.findFirst({
      where: {
        clientId: c.id,
        taskType,
        deadline: { gte: start, lt: end },
        archivedAt: null,
      },
      select: { id: true },
    });
    if (existing) continue;

    // ответственный: исполнитель создаёт себе; руководитель — по правилу, иначе primary
    let assignedToId = c.primaryExecutorId;
    if (session.role === "EXECUTOR") {
      assignedToId = session.id;
    } else {
      const rule = await prisma.assignmentRule.findUnique({
        where: { clientId_taskType: { clientId: c.id, taskType } },
      });
      if (rule) assignedToId = rule.executorId;
    }

    await prisma.task.create({
      data: {
        title: `${action === "advance" ? "Начислить аванс" : "Начислить зарплату"} за ${monthLabel(deadline)}`,
        clientId: c.id,
        taskType,
        status: "NEW",
        deadline,
        assignedToId,
        createdById: session.id,
      },
    });
    created++;
  }

  const firstDeadline =
    created > 0
      ? await prisma.task.findFirst({
          where: { taskType, archivedAt: null },
          orderBy: { deadline: "asc" },
          select: { deadline: true },
        })
      : null;

  return NextResponse.json({
    ok: true,
    count: created,
    month: firstDeadline?.deadline
      ? `${firstDeadline.deadline.getFullYear()}-${String(firstDeadline.deadline.getMonth() + 1).padStart(2, "0")}`
      : null,
    message: created > 0 ? "Задачи созданы" : "Задачи уже созданы",
  });
}
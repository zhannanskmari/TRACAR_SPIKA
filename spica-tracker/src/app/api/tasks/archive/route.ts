import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleTasks } from "@/lib/tasks-service";
import { tasksVisibilityWhere } from "@/lib/task-scope";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await getVisibleTasks(session, { archived: true });

  return NextResponse.json({ tasks });
}

// Следующий рабочий день (пн–пт) с сохранением времени суток исходной даты
function nextBusinessDayKeepingTime(from: Date): Date {
  const d = new Date(from);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Архивацию выполняет только сотрудник/руководитель
  if (session.role !== "ADMIN" && session.role !== "EXECUTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // «Конец дня»: обработка карточек со сроком до сегодня
  const now = new Date();
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  // 1. Выполненные карточки со сроком до сегодня — в архив
  const archived = await prisma.task.updateMany({
    where: {
      archivedAt: null,
      deadline: { lte: endOfToday },
      status: { in: ["DONE", "SENT_TO_CLIENT"] },
      ...tasksVisibilityWhere(session),
    },
    data: { archivedAt: now },
  });

  // 2. Невыполненные со сроком до сегодня — на следующий рабочий день
  const unfinished = await prisma.task.findMany({
    where: {
      archivedAt: null,
      deadline: { lte: endOfToday },
      status: { in: ["NEW", "IN_PROGRESS", "REWORK", "OVERDUE"] },
      ...tasksVisibilityWhere(session),
    },
    select: { id: true, deadline: true },
  });

  for (const t of unfinished) {
    const newDeadline = nextBusinessDayKeepingTime(t.deadline ?? now);
    await prisma.task.update({
      where: { id: t.id },
      data: { deadline: newDeadline },
    });
  }

  return NextResponse.json({
    count: archived.count,
    moved: unfinished.length,
  });
}

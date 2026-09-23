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

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Архивацию выполняет только сотрудник/руководитель
  if (session.role !== "ADMIN" && session.role !== "EXECUTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // «Конец дня»: в архив попадают активные карточки со сроком до сегодня
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

  const result = await prisma.task.updateMany({
    where: {
      archivedAt: null,
      deadline: { lte: endOfToday },
      status: { notIn: ["NEW", "IN_PROGRESS", "REWORK"] },
      ...tasksVisibilityWhere(session),
    },
    data: { archivedAt: now },
  });

  return NextResponse.json({ count: result.count });
}
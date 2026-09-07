import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TASK_INCLUDE = {
  client: { select: { id: true, name: true, taxSystem: true } },
  assignedTo: { select: { id: true, name: true, specialization: true } },
  createdBy: { select: { id: true, name: true } },
  comments: {
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" } as const,
  },
  _count: { select: { documents: true } },
};

function archiveScope(session: { id: string; role: string }) {
  if (session.role === "EXECUTOR") {
    return { assignedToId: session.id };
  }
  return {};
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: { not: null },
      ...(session.role === "ADMIN"
        ? {}
        : session.role === "EXECUTOR"
          ? { assignedToId: session.id }
          : {
              AND: [
                { client: { clientUserId: session.id } },
                {
                  OR: [
                    { createdById: session.id },
                    { status: "SENT_TO_CLIENT" },
                  ],
                },
              ],
            }),
    },
    include: TASK_INCLUDE,
    orderBy: { archivedAt: "desc" },
  });

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
      ...archiveScope(session),
    },
    data: { archivedAt: now },
  });

  return NextResponse.json({ count: result.count });
}
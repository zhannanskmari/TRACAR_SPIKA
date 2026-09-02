import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "DONE",
  "SENT_TO_CLIENT",
  "REWORK",
  "OVERDUE",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (
    session.role !== "ADMIN" &&
    task.assignedToId !== session.id
  ) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const data: Record<string, unknown> = {};

  if (body.status) {
    if (!ALLOWED_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: "Недопустимый статус" },
        { status: 400 }
      );
    }
    data.status = body.status;
  }

  if (typeof body.isClientNotified === "boolean") {
    data.isClientNotified = body.isClientNotified;
  }

  const updated = await prisma.task.update({
    where: { id },
    data,
    include: {
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ task: updated });
}

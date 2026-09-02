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

  // Редактирование полей задачи
  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
  }

  if (typeof body.taskType === "string" && body.taskType) {
    data.taskType = body.taskType;
  }

  if (typeof body.urgent === "boolean") {
    data.urgent = body.urgent;
  }

  if (body.durationMinutes === null) {
    data.durationMinutes = null;
  } else if (
    typeof body.durationMinutes === "number" &&
    !isNaN(body.durationMinutes)
  ) {
    data.durationMinutes = Math.max(0, Math.round(body.durationMinutes));
  }

  // Смену ответственного может выполнять только сотрудник/руководитель
  if (
    body.assignedToId &&
    (session.role === "ADMIN" || session.role === "EXECUTOR")
  ) {
    const executor = await prisma.user.findUnique({
      where: { id: body.assignedToId },
      select: { id: true, role: true },
    });
    if (executor && executor.role === "EXECUTOR") {
      data.assignedToId = executor.id;
    }
  }

  if (body.deadline === null) {
    data.deadline = null;
  } else if (typeof body.deadline === "string" && body.deadline) {
    const d = new Date(body.deadline);
    if (!isNaN(d.getTime())) data.deadline = d;
  }

  // Сумму налога / дату уплаты может менять только сотрудник/руководитель
  const canEditTax = session.role === "ADMIN" || session.role === "EXECUTOR";
  if (canEditTax) {
    if (body.taxAmount === null) {
      data.taxAmount = null;
    } else if (typeof body.taxAmount === "number" && !isNaN(body.taxAmount)) {
      data.taxAmount = body.taxAmount;
    }

    if (body.taxPaymentDate === null) {
      data.taxPaymentDate = null;
    } else if (typeof body.taxPaymentDate === "string" && body.taxPaymentDate) {
      const d = new Date(body.taxPaymentDate);
      if (!isNaN(d.getTime())) data.taxPaymentDate = d;
    }
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

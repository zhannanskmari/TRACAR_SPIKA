import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.task.findMany({
    where:
      session.role === "ADMIN"
        ? {}
        : session.role === "EXECUTOR"
          ? {
              assignedToId: session.id,
            }
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
            },
    include: {
      client: {
        select: { id: true, name: true, taxSystem: true },
      },
      assignedTo: {
        select: { id: true, name: true, specialization: true },
      },
      createdBy: {
        select: { id: true, name: true },
      },
      comments: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { documents: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const taskType =
    typeof body.taskType === "string" ? body.taskType : "CLIENT_REQUEST";

  if (!title) {
    return NextResponse.json({ error: "Укажите название задачи" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "Укажите клиента" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
  }

  // Клиент может создавать задачи только для своей компании
  if (session.role === "CLIENT" && client.clientUserId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Исполнитель может создавать задачи только для клиентов, где он исполнитель
  if (
    session.role === "EXECUTOR" &&
    client.primaryExecutorId !== session.id &&
    client.secondaryExecutorId !== session.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Определяем исполнителя по правилам авто-распределения, иначе по primary executor
  let assignedToId = client.primaryExecutorId;
  if (session.role === "EXECUTOR") {
    assignedToId = session.id;
  } else {
    const rule = await prisma.assignmentRule.findUnique({
      where: { clientId_taskType: { clientId, taskType } },
    });
    if (rule) assignedToId = rule.executorId;
  }

  // Явно выбранный ответственный (только для сотрудников/руководителя)
  if (
    body.assignedToId &&
    (session.role === "ADMIN" || session.role === "EXECUTOR")
  ) {
    const executor = await prisma.user.findUnique({
      where: { id: body.assignedToId },
      select: { id: true, role: true },
    });
    if (executor && executor.role === "EXECUTOR") {
      assignedToId = executor.id;
    }
  }

  const data: Prisma.TaskUncheckedCreateInput = {
    title,
    clientId,
    taskType,
    status: "NEW",
    assignedToId,
    createdById: session.id,
    urgent: body.urgent === true,
  };

  if (typeof body.deadline === "string" && body.deadline) {
    const d = new Date(body.deadline);
    if (!isNaN(d.getTime())) data.deadline = d;
  }

  if (
    typeof body.durationMinutes === "number" &&
    !isNaN(body.durationMinutes)
  ) {
    data.durationMinutes = Math.max(0, Math.round(body.durationMinutes));
  }

  if (
    typeof body.factDurationMinutes === "number" &&
    !isNaN(body.factDurationMinutes)
  ) {
    data.factDurationMinutes = Math.max(0, Math.round(body.factDurationMinutes));
  }

  // Сумму налога и дату уплаты может вводить только сотрудник/руководитель
  const canEditTax = session.role === "ADMIN" || session.role === "EXECUTOR";
  if (canEditTax) {
    if (typeof body.taxAmount === "number" && !isNaN(body.taxAmount)) {
      data.taxAmount = body.taxAmount;
    }
    if (typeof body.taxPaymentDate === "string" && body.taxPaymentDate) {
      const d = new Date(body.taxPaymentDate);
      if (!isNaN(d.getTime())) data.taxPaymentDate = d;
    }
    if (taskType === "SALARY_CALC" && typeof body.salaryCalcDate === "string" && body.salaryCalcDate) {
      const d = new Date(body.salaryCalcDate);
      if (!isNaN(d.getTime())) data.salaryCalcDate = d;
    }
    if (taskType === "SALARY_PAYMENT" && typeof body.salaryPaymentDate === "string" && body.salaryPaymentDate) {
      const d = new Date(body.salaryPaymentDate);
      if (!isNaN(d.getTime())) data.salaryPaymentDate = d;
    }
  }

  const task = await prisma.task.create({
    data,
    include: {
      client: { select: { id: true, name: true, taxSystem: true } },
      assignedTo: { select: { id: true, name: true, specialization: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}

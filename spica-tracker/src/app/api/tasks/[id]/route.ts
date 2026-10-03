import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureMonthBalanceSchema } from "@/lib/payments-schema";

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
    task.assignedToId !== session.id &&
    // исполнитель задачи двигает свою карточку, как и ответственный
    task.executorId !== session.id &&
    // клиент может редактировать только те задачи, которые создал сам
    !(session.role === "CLIENT" && task.createdById === session.id)
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
    // Дата выполнения: день перехода в DONE (показывается в таблице
    // отчётности); при возврате из DONE — сбрасывается
    if (body.status === "DONE" && task.status !== "DONE") {
      data.completedAt = new Date();
    } else if (body.status !== "DONE" && task.status === "DONE") {
      data.completedAt = null;
    }
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

  if (body.factDurationMinutes === null) {
    data.factDurationMinutes = null;
  } else if (
    typeof body.factDurationMinutes === "number" &&
    !isNaN(body.factDurationMinutes)
  ) {
    data.factDurationMinutes = Math.max(0, Math.round(body.factDurationMinutes));
  }

  // Количество первичных документов (ввод в бухгалтерскую программу)
  if (body.docCount === null) {
    data.docCount = null;
  } else if (
    typeof body.docCount === "number" &&
    !isNaN(body.docCount) &&
    Number.isFinite(body.docCount)
  ) {
    data.docCount = Math.max(0, Math.round(body.docCount));
  }

  // «Начало»/«Окончание» — время переноса в формате ЧЧ:ММ
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;  if (body.startTime === null || body.startTime === "") {
    data.startTime = null;
  } else if (typeof body.startTime === "string" && TIME_RE.test(body.startTime)) {
    data.startTime = body.startTime;
  }

  if (body.endTime === null || body.endTime === "") {
    data.endTime = null;
  } else if (typeof body.endTime === "string" && TIME_RE.test(body.endTime)) {
    data.endTime = body.endTime;
  }

  // Факт = разница «Окончание» − «Начало» (в минутах), но только когда
  // в этом запросе меняются сами времена. Явно введённый в карточке
  // «Факт» сервер не затирает — иначе вручную введённые минуты
  // перетирались нулём (start и end в одну минуту).
  const timesChanged =
    data.startTime !== undefined || data.endTime !== undefined;
  const factProvided = data.factDurationMinutes !== undefined;
  if (timesChanged && !factProvided) {
    const startRaw = data.startTime !== undefined ? data.startTime : task.startTime;
    const endRaw = data.endTime !== undefined ? data.endTime : task.endTime;
    const start = typeof startRaw === "string" && TIME_RE.test(startRaw) ? startRaw : null;
    const end = typeof endRaw === "string" && TIME_RE.test(endRaw) ? endRaw : null;
    if (start && end) {
      const toMin = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };
      const diff = toMin(end) - toMin(start);
      if (diff >= 0) {
        data.factDurationMinutes = diff;
      }
    }
  }

  // Сумма для задач «Счёт» / «Оплата счёта»
  if (body.amount === null) {
    data.amount = null;
  } else if (typeof body.amount === "number" && !isNaN(body.amount)) {
    data.amount = Math.max(0, body.amount);
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

  if (
    body.executorId !== undefined &&
    (session.role === "ADMIN" || session.role === "EXECUTOR")
  ) {
    if (body.executorId === null || body.executorId === "") {
      data.executorId = null;
    } else if (typeof body.executorId === "string") {
      const executor = await prisma.user.findUnique({
        where: { id: body.executorId },
        select: { id: true, role: true },
      });
      if (executor && executor.role === "EXECUTOR") {
        data.executorId = executor.id;
      }
    }
  }

  if (body.deadline === null) {
    data.deadline = null;
  } else if (typeof body.deadline === "string" && body.deadline) {
    const d = new Date(body.deadline);
    if (!isNaN(d.getTime())) data.deadline = d;
  }

  if (body.receiptDeadline === null) {
    data.receiptDeadline = null;
  } else if (typeof body.receiptDeadline === "string" && body.receiptDeadline) {
    const d = new Date(body.receiptDeadline);
    if (!isNaN(d.getTime())) data.receiptDeadline = d;
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

    if (body.salaryPaymentDate === null) {
      data.salaryPaymentDate = null;
    } else if (typeof body.salaryPaymentDate === "string" && body.salaryPaymentDate) {
      const d = new Date(body.salaryPaymentDate);
      if (!isNaN(d.getTime())) data.salaryPaymentDate = d;
    }

    if (body.salaryCalcDate === null) {
      data.salaryCalcDate = null;
    } else if (typeof body.salaryCalcDate === "string" && body.salaryCalcDate) {
      const d = new Date(body.salaryCalcDate);
      if (!isNaN(d.getTime())) data.salaryCalcDate = d;
    }
  }

  // Восстановление из архива (только сотрудник/руководитель)
  if (
    body.archivedAt === null &&
    (session.role === "ADMIN" || session.role === "EXECUTOR")
  ) {
    data.archivedAt = null;
  } else if (body.archivedAt !== undefined) {
    return NextResponse.json(
      { error: "Недопустимое поле archivedAt" },
      { status: 400 }
    );
  }

  const updated = await prisma.task.update({
    where: { id },
    data,
    include: {
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  // «Оплата счёта»: сумма учитывается во вкладке «Оплаты» за тот месяц,
  // который указан в дате карточки («Срок»), а не за месяц перевода
  // в «Выполнено». При смене даты, суммы или статуса прошлый вклад
  // вычитается из старого месяца, новый — добавляется в новый.
  if (task.taskType === "INVOICE_PAYMENT") {
    await ensureMonthBalanceSchema();
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const monthOf = (d: Date | null) =>
      d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : null;
    const deltas = new Map<string, number>();
    const add = (m: string | null, v: number) => {
      if (!m || v === 0) return;
      deltas.set(m, round2((deltas.get(m) ?? 0) + v));
    };
    if (task.status === "DONE" && task.amount != null && task.amount > 0) {
      add(monthOf(task.deadline), -round2(task.amount));
    }
    if (updated.status === "DONE" && updated.amount != null && updated.amount > 0) {
      add(monthOf(updated.deadline), round2(updated.amount));
    }
    for (const [m, delta] of deltas) {
      if (delta === 0) continue;
      const existing = await prisma.monthBalance.findUnique({
        where: { clientId_month: { clientId: task.clientId, month: m } },
      });
      if (existing) {
        await prisma.monthBalance.update({
          where: { id: existing.id },
          data: { paymentAmount: round2(Math.max(0, existing.paymentAmount + delta)) },
        });
      } else if (delta > 0) {
        await prisma.monthBalance.create({
          data: {
            clientId: task.clientId,
            month: m,
            paymentAmount: round2(delta),
          },
        });
      }
    }
  }

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Руководитель и сотрудники удаляют любую карточку.
  // Клиент удаляет только ту, которую создал сам.
  if (session.role !== "ADMIN" && session.role !== "EXECUTOR") {
    if (task.createdById !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Комментарии и документы удаляются каскадно через onDelete: Cascade
  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

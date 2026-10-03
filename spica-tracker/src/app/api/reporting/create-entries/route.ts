import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEADLINE_EVENTS,
  eventAppliesToClient,
} from "@/app/reporting/deadline-calendar";

// Массовое создание карточек «по таблице отчётности»:
// для каждого клиента по каждому сроку, подходящему под его систему
// налогообложения. Ответственный — Анастасия, план — 30 минут,
// в поле «Что нужно сделать» — название срока.
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assignee = await prisma.user.findFirst({
    where: { name: { contains: "Анастасия" }, role: "EXECUTOR" },
    select: { id: true },
  });
  if (!assignee) {
    return NextResponse.json(
      { error: "Не найден ответственный «Анастасия»" },
      { status: 400 }
    );
  }

  const clients = await prisma.client.findMany({
    select: { id: true, taxSystem: true, advanceDay: true, salaryPaymentDay: true },
  });

  // Существующие карточки по этим срокам — чтобы не создавать дубли
  const labels = Array.from(new Set(DEADLINE_EVENTS.map((e) => e.label)));
  const existing = await prisma.task.findMany({
    where: { title: { in: labels } },
    select: { clientId: true, title: true, deadline: true },
  });
  const existingSet = new Set(
    existing.map(
      (t) =>
        `${t.clientId}|${t.title}|${
          t.deadline ? t.deadline.toISOString().slice(0, 10) : ""
        }`
    )
  );

  type Row = {
    title: string;
    clientId: string;
    taskType: string;
    status: string;
    assignedToId: string;
    createdById: string;
    deadline: Date;
    durationMinutes: number;
  };

  const rows: Row[] = [];
  let total = 0;
  for (const client of clients) {
    for (const e of DEADLINE_EVENTS) {
      if (!eventAppliesToClient(e, client)) continue;
      total += 1;
      const key = `${client.id}|${e.label}|${e.date}`;
      if (existingSet.has(key)) continue;
      rows.push({
        title: e.label,
        clientId: client.id,
        taskType: e.taskType,
        status: "NEW",
        assignedToId: assignee.id,
        createdById: session.id,
        deadline: new Date(`${e.date}T12:00:00`),
        durationMinutes: 30,
      });
    }
  }

  if (rows.length > 0) {
    await prisma.task.createMany({ data: rows });
  }

  return NextResponse.json({
    created: rows.length,
    skipped: total - rows.length,
    total,
  });
}

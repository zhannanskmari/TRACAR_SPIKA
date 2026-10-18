import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleClients } from "@/lib/tasks-service";
import { DOC_ACCOUNT_KEYS } from "@/lib/doc-meta";

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : null;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Ввод документов доступен сотрудникам (не клиентам)
  if (session.role !== "ADMIN" && session.role !== "EXECUTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clients = await getVisibleClients(session, {
    includeExecutorTasks: true,
  });
  const clientIds = clients.map((c) => c.id);

  const entries = await prisma.docEntry.findMany({
    where: clientIds.length ? { clientId: { in: clientIds } } : { clientId: "" },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      clientId: e.clientId,
      account: e.account,
      date: toIso(e.date),
      text: e.text,
    })),
  });
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
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const account = typeof body.account === "string" ? body.account : "";
  const text =
    typeof body.text === "string" && body.text.trim() ? body.text.trim() : null;

  let date: Date | null = null;
  if (typeof body.date === "string" && body.date) {
    const d = new Date(body.date);
    if (!isNaN(d.getTime())) date = d;
  }

  if (!clientId) {
    return NextResponse.json({ error: "Укажите клиента" }, { status: 400 });
  }
  if (!(DOC_ACCOUNT_KEYS.includes(account))) {
    return NextResponse.json({ error: "Неверный счёт" }, { status: 400 });
  }

  // Клиент должен быть доступен текущему пользователю
  const clients = await getVisibleClients(session, {
    includeExecutorTasks: true,
  });
  if (!clients.some((c) => c.id === clientId)) {
    return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
  }

  // Пустая ячейка (нет ни даты, ни текста) — удаляем запись
  if (!date && !text) {
    await prisma.docEntry.deleteMany({ where: { clientId, account } });
    return NextResponse.json({ entry: null });
  }

  const entry = await prisma.docEntry.upsert({
    where: { clientId_account: { clientId, account } },
    create: { clientId, account, date, text },
    update: { date, text },
  });

  return NextResponse.json({
    entry: {
      clientId: entry.clientId,
      account: entry.account,
      date: toIso(entry.date),
      text: entry.text,
    },
  });
}

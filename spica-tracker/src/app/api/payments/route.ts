import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function toNum(value: unknown): number | null {
  return typeof value === "number" && !isNaN(value) ? value : null;
}

function monthLabel(year: number, mon: number): string {
  const label = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, mon - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function daysInMonth(year: number, mon: number): number {
  return new Date(year, mon, 0).getDate();
}

function clientsWhere(session: { id: string; role: string }) {
  if (session.role === "ADMIN") return {};
  if (session.role === "CLIENT") return { clientUserId: session.id };
  return {
    OR: [
      { primaryExecutorId: session.id },
      { secondaryExecutorId: session.id },
      { tasks: { some: { assignedToId: session.id } } },
    ],
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!MONTH_RE.test(month)) {
    return NextResponse.json({ error: "Укажите месяц (YYYY-MM)" }, { status: 400 });
  }

  const clients = await prisma.client.findMany({
    where: clientsWhere(session),
    select: {
      id: true,
      name: true,
      shortName: true,
      taxSystem: true,
      invoiceAmount: true,
      invoiceDay: true,
    },
    orderBy: { name: "asc" },
  });
  const clientIds = clients.map((c) => c.id);

  const balances = await prisma.monthBalance.findMany({
    where: { clientId: { in: clientIds }, month },
  });
  const balanceByClient = new Map(balances.map((b) => [b.clientId, b]));

  const rows = clients.map((c) => {
    const rec = balanceByClient.get(c.id);
    const startBalance = rec?.startBalance ?? 0;
    const paymentAmount = rec?.paymentAmount ?? 0;
    const invoiceSum = c.invoiceAmount ?? 0;
    return {
      clientId: c.id,
      name: c.name,
      shortName: c.shortName,
      taxSystem: c.taxSystem,
      invoiceAmount: c.invoiceAmount,
      invoiceDay: c.invoiceDay,
      startBalance,
      invoiceSum,
      paymentAmount,
      endBalance: startBalance + invoiceSum - paymentAmount,
    };
  });

  return NextResponse.json({ month, rows });
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
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "setStart" || action === "setPayment") {
    const clientId = typeof body.clientId === "string" ? body.clientId : "";
    const month = typeof body.month === "string" ? body.month : "";
    const value = toNum(body.startBalance ?? body.amount);
    if (!MONTH_RE.test(month)) {
      return NextResponse.json({ error: "Укажите месяц (YYYY-MM)" }, { status: 400 });
    }
    if (!clientId || value === null) {
      return NextResponse.json({ error: "Передайте clientId и значение" }, { status: 400 });
    }
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    }

    const data =
      action === "setStart"
        ? { startBalance: value }
        : { paymentAmount: value };

    await prisma.monthBalance.upsert({
      where: { clientId_month: { clientId, month } },
      update: data,
      create: { clientId, month, ...data },
    });
    return NextResponse.json({ ok: true, value });
  }

  if (action === "generateInvoices") {
    const month = typeof body.month === "string" ? body.month : "";
    const m = MONTH_RE.exec(month);
    if (!m) {
      return NextResponse.json({ error: "Укажите месяц (YYYY-MM)" }, { status: 400 });
    }
    const year = Number(m[1]);
    const mon = Number(m[2]);
    const fallbackDay =
      typeof body.day === "number" && body.day >= 1 && body.day <= 31
        ? Math.round(body.day)
        : 1;

    const clients = await prisma.client.findMany({
      where: { ...clientsWhere(session), invoiceAmount: { not: null } },
      select: {
        id: true,
        invoiceAmount: true,
        invoiceDay: true,
        primaryExecutorId: true,
      },
    });

    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);
    const existing = await prisma.task.findMany({
      where: {
        clientId: { in: clients.map((c) => c.id) },
        taskType: "INVOICE",
        deadline: { gte: start, lt: end },
      },
      select: { clientId: true },
    });
    const existingSet = new Set(existing.map((t) => t.clientId));

    const label = monthLabel(year, mon);
    let count = 0;
    for (const c of clients) {
      if (existingSet.has(c.id)) continue;
      const day = Math.min(c.invoiceDay ?? fallbackDay, daysInMonth(year, mon));
      await prisma.task.create({
        data: {
          title: `Счёт за ${label}`,
          clientId: c.id,
          taskType: "INVOICE",
          status: "NEW",
          assignedToId: c.primaryExecutorId,
          createdById: session.id,
          deadline: new Date(year, mon - 1, day),
          amount: c.invoiceAmount,
        },
      });
      count++;
    }
    return NextResponse.json({ ok: true, count });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
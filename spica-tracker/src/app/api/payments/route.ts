import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientsVisibilityWhere } from "@/lib/task-scope";
import { ensureMonthBalanceSchema } from "@/lib/payments-schema";

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

// Предыдущий месяц "YYYY-MM"
function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

// Месяцы, предшествующие месяцу month (ближайший первый)
function precedingMonths(month: string, count: number): string[] {
  const out: string[] = [];
  let m = month;
  for (let i = 0; i < count; i++) {
    m = prevMonth(m);
    out.push(m);
  }
  return out;
}

// Сколько месяцев назад уходим за остатком, если записи нет
const BALANCE_CARRY_DEPTH = 24;

// Все суммы — до второго десятичного знака (копейки)
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

type BalRec = { startBalance: number; startManual: boolean; paymentAmount: number };

// Остаток на конец месяца m: начало месяца + счёт − оплата.
// Начало — ручной старт (startManual) либо перенос с прошлого месяца.
function endBalanceAt(
  perClient: Map<string, BalRec>,
  m: string,
  invoice: number,
  depth: number
): number {
  const rec = perClient.get(m);
  const start =
    rec && rec.startManual
      ? rec.startBalance
      : depth < BALANCE_CARRY_DEPTH
        ? endBalanceAt(perClient, prevMonth(m), invoice, depth + 1)
        : 0;
  return round2(start + invoice - (rec?.paymentAmount ?? 0));
}

// Записи клиента за предшествующие месяцы (для переноса остатка)
async function precedingBalances(clientId: string, month: string) {
  const balances = await prisma.monthBalance.findMany({
    where: {
      clientId,
      month: { in: precedingMonths(month, BALANCE_CARRY_DEPTH) },
    },
  });
  return new Map(balances.map((b) => [b.month, b]));
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

  await ensureMonthBalanceSchema();

  const clients = await prisma.client.findMany({
    where: clientsVisibilityWhere(session),
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
    where: {
      clientId: { in: clientIds },
      month: { in: [month, ...precedingMonths(month, BALANCE_CARRY_DEPTH)] },
    },
  });
  const balanceByClient = new Map<string, Map<string, (typeof balances)[number]>>();
  for (const b of balances) {
    let perClient = balanceByClient.get(b.clientId);
    if (!perClient) {
      perClient = new Map();
      balanceByClient.set(b.clientId, perClient);
    }
    perClient.set(b.month, b);
  }

  const rows = clients.map((c) => {
    const perClient = balanceByClient.get(c.id) ?? new Map();
    const rec = perClient.get(month);
    const invoiceSum = round2(c.invoiceAmount ?? 0);
    // Начало месяца: ручной ввод (startManual) либо перенос остатка
    // с прошлого месяца — тогда «остаток на 01-е» всегда равен
    // «остатку на конец предыдущего месяца»
    const startBalance =
      rec && rec.startManual
        ? round2(rec.startBalance)
        : round2(endBalanceAt(perClient, prevMonth(month), invoiceSum, 1));
    const paymentAmount = round2(rec?.paymentAmount ?? 0);
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
      endBalance: round2(startBalance + invoiceSum - paymentAmount),
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

  await ensureMonthBalanceSchema();

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

    const existing = await prisma.monthBalance.findUnique({
      where: { clientId_month: { clientId, month } },
    });

    if (action === "setStart") {
      // Ручной ввод стартового остатка закрепляет его за месяцем
      await prisma.monthBalance.upsert({
        where: { clientId_month: { clientId, month } },
        update: { startBalance: value, startManual: true },
        create: { clientId, month, startBalance: value, startManual: true },
      });
      return NextResponse.json({ ok: true, value });
    }

    // setPayment: если записи за месяц ещё нет — создаём её с начальным
    // остатком, перенесённым с прошлого месяца (а не с нулём)
    if (existing) {
      await prisma.monthBalance.update({
        where: { clientId_month: { clientId, month } },
        data: { paymentAmount: value },
      });
    } else {
      const perClient = await precedingBalances(clientId, month);
      const startBalance = endBalanceAt(
        perClient,
        prevMonth(month),
        client.invoiceAmount ?? 0,
        1
      );
      await prisma.monthBalance.create({
        data: { clientId, month, startBalance, paymentAmount: value },
      });
    }
    return NextResponse.json({ ok: true, value: round2(value) });
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
      where: { ...clientsVisibilityWhere(session), invoiceAmount: { not: null } },
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

    // Назначение счёта — месяц после текущего (независимо от выбранного в пикере)
    const now = new Date();
    let tY = now.getFullYear();
    let tM = now.getMonth() + 2; // индекс месяца+1 (0-based + 2)
    if (tM > 12) {
      tM = 1;
      tY += 1;
    }
    const label = monthLabel(tY, tM);
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
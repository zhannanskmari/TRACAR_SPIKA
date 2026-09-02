import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ clients });
}

function toDay(value: unknown): number | null {
  if (typeof value !== "number" || isNaN(value)) return null;
  const n = Math.round(value);
  if (n < 1 || n > 31) return null;
  return n;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Вводить клиентов может только админ
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const taxSystem = typeof body.taxSystem === "string" ? body.taxSystem : "";
  const legalForm = typeof body.legalForm === "string" ? body.legalForm.trim() : "";
  const shortName = typeof body.shortName === "string" ? body.shortName.trim() : "";
  const accountNote = typeof body.accountNote === "string" ? body.accountNote.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Укажите название клиента" }, { status: 400 });
  }
  if (!taxSystem) {
    return NextResponse.json({ error: "Укажите вид налогообложения" }, { status: 400 });
  }

  const data = {
    name,
    taxSystem,
    legalForm: legalForm || null,
    shortName: shortName || null,
    salaryPaymentDay: toDay(body.salaryPaymentDay),
    advanceDay: toDay(body.advanceDay),
    invoiceDay: toDay(body.invoiceDay),
    employeeCount:
      typeof body.employeeCount === "number" && !isNaN(body.employeeCount)
        ? Math.max(0, Math.round(body.employeeCount))
        : null,
    accountNote: accountNote || null,
    hasCashRegister: body.hasCashRegister === true,
    salaryViaCash: body.salaryViaCash === true,
    primaryExecutorId:
      typeof body.primaryExecutorId === "string" && body.primaryExecutorId
        ? body.primaryExecutorId
        : (await prisma.user.findFirst({
            where: { role: "EXECUTOR" },
            orderBy: { name: "asc" },
            select: { id: true },
          }))?.id ?? "",
    secondaryExecutorId:
      typeof body.secondaryExecutorId === "string" && body.secondaryExecutorId
        ? body.secondaryExecutorId
        : null,
  };

  const client = await prisma.client.create({ data });

  return NextResponse.json({ client }, { status: 201 });
}

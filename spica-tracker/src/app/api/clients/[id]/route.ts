import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function toDay(value: unknown): number | null {
  if (typeof value !== "number" || isNaN(value)) return null;
  const n = Math.round(value);
  if (n < 1 || n > 31) return null;
  return n;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Редактировать клиентов может только админ
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const taxSystem = typeof body.taxSystem === "string" ? body.taxSystem : "";
  const legalForm = typeof body.legalForm === "string" ? body.legalForm.trim() : "";
  const shortName = typeof body.shortName === "string" ? body.shortName.trim() : "";
  const accountNote = typeof body.accountNote === "string" ? body.accountNote.trim() : "";

  const data: Record<string, unknown> = {
    name: name || existing.name,
    taxSystem: taxSystem || existing.taxSystem,
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
  };

  if (typeof body.primaryExecutorId === "string" && body.primaryExecutorId) {
    data.primaryExecutorId = body.primaryExecutorId;
  }
  if (typeof body.secondaryExecutorId === "string") {
    data.secondaryExecutorId = body.secondaryExecutorId || null;
  }

  const client = await prisma.client.update({
    where: { id },
    data,
  });

  return NextResponse.json({ client });
}

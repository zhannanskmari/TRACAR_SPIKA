import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function taskDate(task: {
  deadline: Date | null;
  salaryCalcDate: Date | null;
  salaryPaymentDate: Date | null;
  taxPaymentDate: Date | null;
}): string | null {
  const candidates = [
    task.deadline,
    task.taxPaymentDate,
    task.salaryPaymentDate,
    task.salaryCalcDate,
  ].filter((d): d is Date => !!d);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0].toISOString();
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Доступные клиенты для роли
  const clients = await prisma.client.findMany({
    where:
      session.role === "ADMIN"
        ? {}
        : session.role === "CLIENT"
          ? { clientUserId: session.id }
          : {
              OR: [
                { primaryExecutorId: session.id },
                { secondaryExecutorId: session.id },
              ],
            },
    orderBy: { name: "asc" },
  });

  const clientIds = clients.map((c) => c.id);

  const tasks = await prisma.task.findMany({
    where: { clientId: { in: clientIds } },
    include: {
      client: { select: { id: true, name: true, taxSystem: true } },
      assignedTo: { select: { id: true, name: true, specialization: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const byClientId = new Map<
    string,
    {
      id: string;
      name: string;
      taxSystem: string;
      tasks: (
        (typeof tasks)[number] & { date: string | null }
      )[];
    }
  >();

  for (const task of tasks) {
    const entry = byClientId.get(task.clientId) ?? {
      id: task.clientId,
      name: task.client.name,
      taxSystem: task.client.taxSystem,
      tasks: [],
    };
    entry.tasks.push({ ...task, date: taskDate(task) });
    byClientId.set(task.clientId, entry);
  }

  const rows = clients.map((c) => {
    const entry = byClientId.get(c.id);
    return {
      id: c.id,
      name: c.name,
      taxSystem: c.taxSystem,
      tasks: entry ? entry.tasks : [],
    };
  });

  return NextResponse.json({ clients: rows });
}

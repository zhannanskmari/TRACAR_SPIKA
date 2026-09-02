import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardView from "./DashboardView";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";

  const tasks = await prisma.task.findMany({
    where: isAdmin
      ? {}
      : user.role === "CLIENT"
        ? {
            AND: [
              { client: { clientUserId: user.id } },
              {
                OR: [{ createdById: user.id }, { status: "SENT_TO_CLIENT" }],
              },
            ],
          }
        : {
            assignedToId: user.id,
          },
    include: {
      client: { select: { id: true, name: true, taxSystem: true } },
      assignedTo: { select: { id: true, name: true, specialization: true } },
      createdBy: { select: { id: true, name: true } },
      comments: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { documents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const clients = await prisma.client.findMany({
    where: isAdmin
      ? {}
      : user.role === "CLIENT"
        ? { clientUserId: user.id }
        : {
            OR: [
              { primaryExecutorId: user.id },
              { secondaryExecutorId: user.id },
              {
                tasks: {
                  some: { assignedToId: user.id },
                },
              },
            ],
          },
    select: { id: true, name: true, taxSystem: true },
    orderBy: { name: "asc" },
  });

  // Список исполнителей для выбора ответственного (только для сотрудников)
  const executors =
    user.role === "CLIENT"
      ? []
      : await prisma.user.findMany({
          where: { role: "EXECUTOR" },
          select: { id: true, name: true, specialization: true },
          orderBy: { name: "asc" },
        });

  const serialized = tasks.map((t) => ({
    ...t,
    deadline: t.deadline ? t.deadline.toISOString() : null,
    taxPaymentDate: t.taxPaymentDate ? t.taxPaymentDate.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    comments: t.comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  }));

  return (
    <DashboardView
      user={user}
      tasks={serialized}
      clients={clients}
      executors={executors}
    />
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EmployeesView from "./EmployeesView";

export default async function EmployeesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  // Пользователя нет в БД: гасим куку через logout (см. dashboard/page.tsx),
  // иначе будет бесконечный редирект /login <-> защищённая страница.
  if (!user) redirect("/api/auth/logout");

  // Управлять сотрудниками может только админ
  if (user.role !== "ADMIN") redirect("/dashboard");

  const employees = await prisma.user.findMany({
    where: { role: "EXECUTOR" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      specialization: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  const serialized = employees.map((e) => ({
    ...e,
    createdAt: e.createdAt.toISOString(),
  }));

  // Архивные задачи сотрудников для раздела «Зарплата сотрудников»
  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: { not: null },
      OR: [
        { assignedToId: { in: employees.map((e) => e.id) } },
        { executorId: { in: employees.map((e) => e.id) } },
      ],
    },
    select: {
      id: true,
      title: true,
      taskType: true,
      deadline: true,
      archivedAt: true,
      factDurationMinutes: true,
      assignedToId: true,
      executorId: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { archivedAt: "desc" },
  });

  const serializedTasks = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    taskType: t.taskType,
    deadline: t.deadline ? t.deadline.toISOString() : null,
    archivedAt: t.archivedAt ? t.archivedAt.toISOString() : null,
    factDurationMinutes: t.factDurationMinutes,
    assignedToId: t.assignedToId,
    executorId: t.executorId,
    client: t.client,
  }));

  return (
    <EmployeesView
      adminName={user.name}
      employees={serialized}
      tasks={serializedTasks}
    />
  );
}

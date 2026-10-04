import { redirect } from "next/navigation";
import { getSession, isAnastasiya } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ReportingView from "./ReportingView";
import { DEADLINE_EVENTS } from "./deadline-calendar";

export default async function ReportingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  // Пользователя нет в БД: гасим куку через logout (см. dashboard/page.tsx),
  // иначе будет бесконечный редирект /login <-> защищённая страница.
  if (!user) redirect("/api/auth/logout");

  // Отчётность — для админа и Анастасии (как и раздел «Клиенты»)
  if (user.role !== "ADMIN" && !isAnastasiya(user)) redirect("/dashboard");

  const [clients, tasks] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        taxSystem: true,
        advanceDay: true,
        salaryPaymentDay: true,
        legalForm: true,
        employeeCount: true,
      },
    }),
    // Карточки по срокам отчётности: выполненные — дата в таблице,
    // для «ручных» сроков (СЗВ-ТД) — наличие карточки = отметка
    prisma.task.findMany({
      where: {
        OR: [
          { title: { in: DEADLINE_EVENTS.map((e) => e.label) } },
          { taskType: { in: DEADLINE_EVENTS.map((e) => e.taskType) } },
        ],
      },
      select: {
        clientId: true,
        title: true,
        taskType: true,
        status: true,
        completedAt: true,
      },
    }),
  ]);

  const serializedTasks = tasks.map((t) => ({
    clientId: t.clientId,
    title: t.title,
    taskType: t.taskType,
    status: t.status,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
  }));

  return (
    <ReportingView
      adminName={user.name}
      clients={clients}
      tasks={serializedTasks}
    />
  );
}

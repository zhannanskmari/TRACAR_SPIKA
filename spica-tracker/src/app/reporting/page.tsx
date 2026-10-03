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

  const [clients, doneTasks] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        taxSystem: true,
        advanceDay: true,
        salaryPaymentDay: true,
      },
    }),
    // Выполненные карточки по срокам отчётности — дата выполнения
    // показывается в таблице вместо «✓»
    prisma.task.findMany({
      where: {
        status: "DONE",
        title: { in: DEADLINE_EVENTS.map((e) => e.label) },
      },
      select: { clientId: true, title: true, completedAt: true },
    }),
  ]);

  const serializedDone = doneTasks.map((t) => ({
    clientId: t.clientId,
    title: t.title,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
  }));

  return (
    <ReportingView
      adminName={user.name}
      clients={clients}
      doneTasks={serializedDone}
    />
  );
}

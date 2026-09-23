import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listExecutors } from "@/lib/tasks-service";
import ClientsView from "./ClientsView";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  // Пользователя нет в БД: гасим куку через logout (см. dashboard/page.tsx),
  // иначе будет бесконечный редирект /login <-> защищённая страница.
  if (!user) redirect("/api/auth/logout");

  // Вводить клиентов может только админ
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [clients, executors] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      include: {
        primaryExecutor: { select: { id: true, name: true } },
        secondaryExecutor: { select: { id: true, name: true } },
      },
    }),
    listExecutors(user),
  ]);

  const serialized = clients.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <ClientsView
      adminName={user.name}
      clients={serialized}
      executors={executors}
    />
  );
}

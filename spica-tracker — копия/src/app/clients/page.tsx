import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ClientsView from "./ClientsView";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) redirect("/login");

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
    prisma.user.findMany({
      where: { role: "EXECUTOR" },
      select: { id: true, name: true, specialization: true },
      orderBy: { name: "asc" },
    }),
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

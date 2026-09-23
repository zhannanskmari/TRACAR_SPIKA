import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientsVisibilityWhere } from "@/lib/task-scope";
import {
  getVisibleTasks,
  listExecutors,
  serializeTask,
} from "@/lib/tasks-service";
import DashboardView from "./DashboardView";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";

  const tasks = await getVisibleTasks(user);

  const clients = await prisma.client.findMany({
    where: isAdmin ? {} : clientsVisibilityWhere(user),
    select: {
      id: true,
      name: true,
      shortName: true,
      taxSystem: true,
    },
    orderBy: { name: "asc" },
  });

  // Список исполнителей для выбора ответственного (только для сотрудников)
  const executors = await listExecutors(user);

  const serialized = tasks.map(serializeTask);

  return (
    <DashboardView
      user={user}
      tasks={serialized}
      clients={clients}
      executors={executors}
    />
  );
}

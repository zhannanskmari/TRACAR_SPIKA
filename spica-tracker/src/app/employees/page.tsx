import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EmployeesView from "./EmployeesView";

export default async function EmployeesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) redirect("/login");

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

  return <EmployeesView adminName={user.name} employees={serialized} />;
}

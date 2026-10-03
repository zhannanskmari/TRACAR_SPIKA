import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ReportingView from "./ReportingView";

export default async function ReportingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  // Пользователя нет в БД: гасим куку через logout (см. dashboard/page.tsx),
  // иначе будет бесконечный редирект /login <-> защищённая страница.
  if (!user) redirect("/api/auth/logout");

  // Отчётность — только для админа (как и раздел «Клиенты»)
  if (user.role !== "ADMIN") redirect("/dashboard");

  return <ReportingView adminName={user.name} />;
}

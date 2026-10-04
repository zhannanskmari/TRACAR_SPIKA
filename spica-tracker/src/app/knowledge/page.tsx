import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import KnowledgeHub from "./KnowledgeHub";

// Общая база знаний — доступна сотрудникам (ADMIN / EXECUTOR)
export default async function KnowledgePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "CLIENT") redirect("/dashboard");

  return <KnowledgeHub user={{ id: session.id, name: session.name, role: session.role }} />;
}

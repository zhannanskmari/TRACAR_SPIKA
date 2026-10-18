import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleClients } from "@/lib/tasks-service";
import DocumentsView from "./DocumentsView";

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Ввод документов доступен сотрудникам (не клиентам)
  if (session.role !== "ADMIN" && session.role !== "EXECUTOR") {
    redirect("/dashboard");
  }

  const clients = await getVisibleClients(session, {
    includeExecutorTasks: true,
  });
  const clientIds = clients.map((c) => c.id);

  const entries = await prisma.docEntry.findMany({
    where: clientIds.length ? { clientId: { in: clientIds } } : { clientId: "" },
  });

  // Фирмы без заполненного поля «расч.счёт» в таблицу не попадают
  const withAccount = clients.filter(
    (c) => c.accountNote && c.accountNote.trim()
  );

  return (
    <DocumentsView
      userName={session.name}
      clients={withAccount.map((c) => ({
        id: c.id,
        name: c.name,
        shortName: c.shortName,
        accountNote: c.accountNote,
      }))}
      entries={entries.map((e) => ({
        clientId: e.clientId,
        account: e.account,
        date: e.date ? e.date.toISOString() : null,
        text: e.text,
      }))}
    />
  );
}

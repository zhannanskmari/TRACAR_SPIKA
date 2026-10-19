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

  // Автозаполнение колонок «Требование квитанция» / «Требование ответ»
  // из карточек доски: DEMAND_RECEIPT и IFNS_DEMAND.
  const demandTasks = clientIds.length
    ? await prisma.task.findMany({
        where: {
          clientId: { in: clientIds },
          taskType: { in: ["DEMAND_RECEIPT", "IFNS_DEMAND"] },
          archivedAt: null,
        },
        orderBy: { createdAt: "desc" },
        select: {
          clientId: true,
          taskType: true,
          title: true,
          deadline: true,
          receiptDeadline: true,
          demandNumber: true,
          demandDate: true,
        },
      })
    : [];

  function formatDemandText(
    title: string,
    demandNumber: string | null,
    demandDate: Date | null
  ): string {
    // Суть из поля «что надо сделать» + номер и дата требования
    const parts: string[] = [];
    if (title.trim()) parts.push(title.trim());
    if (demandNumber) parts.push(`№${demandNumber}`);
    if (demandDate) {
      parts.push(`от ${demandDate.toLocaleDateString("ru-RU")}`);
    }
    return parts.join(" ");
  }

  // По каждой паре (клиент, колонка) берём самую свежую карточку
  const autoMap = new Map<
    string,
    { clientId: string; account: string; date: string | null; text: string | null }
  >();
  for (const t of demandTasks) {
    const account = t.taskType === "DEMAND_RECEIPT" ? "demand-receipt" : "demand-answer";
    const key = `${t.clientId}:${account}`;
    if (autoMap.has(key)) continue;
    const date = t.taskType === "DEMAND_RECEIPT" ? t.deadline : t.receiptDeadline;
    const text = formatDemandText(t.title, t.demandNumber, t.demandDate);
    autoMap.set(key, {
      clientId: t.clientId,
      account,
      date: date ? date.toISOString() : null,
      text: text || null,
    });
  }
  const autoEntries = Array.from(autoMap.values());

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
      autoEntries={autoEntries}
    />
  );
}

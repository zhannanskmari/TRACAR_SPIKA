import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ArticleView from "./ArticleView";

// Просмотр материала базы знаний — для сотрудников
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "CLIENT") redirect("/dashboard");

  const { id } = await params;
  return (
    <ArticleView
      articleId={id}
      user={{ id: session.id, name: session.name, role: session.role }}
    />
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import CategoryView from "./CategoryView";

// Список материалов раздела базы знаний — для сотрудников
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "CLIENT") redirect("/dashboard");

  const { categoryId } = await params;
  return (
    <CategoryView
      categoryId={categoryId}
      user={{ id: session.id, name: session.name, role: session.role }}
    />
  );
}

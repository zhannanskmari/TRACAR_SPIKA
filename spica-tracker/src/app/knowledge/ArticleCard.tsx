import Link from "next/link";
import type { ArticleSummary } from "@/lib/knowledge";

// Карточка материала в списках (раздел, поиск, избранное)
export default function ArticleCard({
  article,
  showCategory = false,
}: {
  article: ArticleSummary & {
    category?: { id: string; name: string; icon: string };
  };
  showCategory?: boolean;
}) {
  const updated =
    typeof article.updatedAt === "string"
      ? new Date(article.updatedAt)
      : article.updatedAt;

  return (
    <Link
      href={`/knowledge/article/${article.id}`}
      className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition hover:border-blue-300 hover:bg-blue-50/40"
    >
      <span className="mt-0.5 text-lg leading-none">
        {article.type === "link" ? "🔗" : "📄"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-zinc-900">
            {article.title}
          </span>
          {article.isPinned && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              📌 Закреплено
            </span>
          )}
          {article.isFavorite && <span title="В избранном">⭐</span>}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {showCategory && article.category && (
            <span>
              {article.category.icon} {article.category.name}
            </span>
          )}
          <span>
            Обновлено:{" "}
            {updated.toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600"
            >
              {tag}
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}

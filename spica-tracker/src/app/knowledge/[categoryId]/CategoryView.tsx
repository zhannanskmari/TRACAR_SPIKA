"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import {
  collectTags,
  filterArticles,
  sortArticles,
  type ArticleSummary,
  type KnowledgeCategory,
} from "@/lib/knowledge";
import ArticleCard from "../ArticleCard";
import ArticleFormModal from "../ArticleFormModal";

type ArticleRow = ArticleSummary & {
  category: { id: string; name: string; icon: string };
};

// Список материалов одного раздела: хлебные крошки, теги, сортировка
export default function CategoryView({
  categoryId,
  user,
}: {
  categoryId: string;
  user: { id: string; name: string; role: string };
}) {
  const isAdmin = user.role === "ADMIN";
  const [category, setCategory] = useState<KnowledgeCategory | null>(null);
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [tag, setTag] = useState<string>("");
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    const [catsRes, artsRes] = await Promise.all([
      fetch("/api/knowledge/categories"),
      fetch(`/api/knowledge/articles?category=${encodeURIComponent(categoryId)}`),
    ]);
    if (catsRes.ok) {
      const data = await catsRes.json();
      const found = (data.categories ?? []).find(
        (c: KnowledgeCategory) => c.id === categoryId
      );
      if (!found) setMissing(true);
      setCategory(found ?? null);
    }
    if (artsRes.ok) {
      const data = await artsRes.json();
      setArticles(data.articles ?? []);
    }
    setLoaded(true);
  }, [categoryId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const list = useMemo(
    () => sortArticles(filterArticles(articles, { tag: tag || undefined })),
    [articles, tag]
  );
  const tags = useMemo(() => collectTags(articles), [articles]);

  if (loaded && missing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-100">
        <p className="text-sm text-zinc-600">Раздел не найден.</p>
        <Link
          href="/knowledge"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          ← К базе знаний
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            В трекер
          </Link>
          <nav className="text-sm text-zinc-500">
            <Link href="/knowledge" className="hover:text-blue-600">
              База знаний
            </Link>
            <span className="mx-1.5">→</span>
            <span className="font-medium text-zinc-900">
              {category ? `${category.icon} ${category.name}` : "…"}
            </span>
          </nav>
          <div className="ml-auto">
            {isAdmin && (
              <button
                onClick={() => setFormOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Материал
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {!loaded && <p className="text-sm text-zinc-500">Загрузка…</p>}

        {loaded && tags.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setTag("")}
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                tag === ""
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
              }`}
            >
              Все
            </button>
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t === tag ? "" : t)}
                className={`rounded-full px-2.5 py-0.5 text-xs ${
                  tag === t
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {loaded && list.length === 0 && (
          <p className="text-sm text-zinc-500">В этом разделе пока пусто.</p>
        )}

        <div className="space-y-2">
          {list.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      </main>

      {formOpen && (
        <ArticleFormModal
          categories={category ? [{ ...category, articleCount: undefined }] : []}
          defaultCategoryId={categoryId}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

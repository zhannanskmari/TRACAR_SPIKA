"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Star, X } from "lucide-react";
import {
  collectTags,
  filterArticles,
  sortArticles,
  type ArticleSummary,
  type KnowledgeCategory,
} from "@/lib/knowledge";
import ArticleCard from "./ArticleCard";
import ArticleFormModal from "./ArticleFormModal";

type ArticleRow = ArticleSummary & {
  category: { id: string; name: string; icon: string };
};

export default function KnowledgeHub({
  user,
}: {
  user: { id: string; name: string; role: string };
}) {
  const isAdmin = user.role === "ADMIN";

  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [categoryModal, setCategoryModal] = useState<null | {
    id?: string;
    name: string;
    icon: string;
  }>(null);

  const load = useCallback(async () => {
    const [catsRes, artsRes] = await Promise.all([
      fetch("/api/knowledge/categories"),
      fetch("/api/knowledge/articles"),
    ]);
    if (catsRes.ok) {
      const data = await catsRes.json();
      setCategories(data.categories ?? []);
    }
    if (artsRes.ok) {
      const data = await artsRes.json();
      setArticles(data.articles ?? []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const searching = query.trim().length > 0;
  const results = sortArticles(
    filterArticles(articles, {
      q: searching ? query : undefined,
      onlyFavorites: !searching && showFavorites,
    })
  );
  const allTags = collectTags(articles);

  // Возврат к плиткам разделов (из избранного, поиска или статьи)
  function resetToHub() {
    setQuery("");
    setShowFavorites(false);
  }

  async function saveCategory() {
    if (!categoryModal) return;
    const name = categoryModal.name.trim();
    if (!name) return;
    const editing = Boolean(categoryModal.id);
    const res = await fetch(
      editing
        ? `/api/knowledge/categories/${categoryModal.id}`
        : "/api/knowledge/categories",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon: categoryModal.icon.trim() || "📄" }),
      }
    );
    if (res.ok) {
      setCategoryModal(null);
      load();
    }
  }

  async function deleteCategory(id: string) {
    const cat = categories.find((c) => c.id === id);
    const count = cat?.articleCount ?? 0;
    const message =
      count > 0
        ? `Удалить раздел «${cat?.name}» вместе с материалами (${count})?`
        : `Удалить раздел «${cat?.name}»?`;
    if (!window.confirm(message)) return;
    const res = await fetch(`/api/knowledge/categories/${id}`, {
      method: "DELETE",
    });
    if (res.ok) load();
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            В трекер
          </Link>
          <button
            onClick={resetToHub}
            title="Вернуться к разделам базы знаний"
            className="text-lg font-bold text-zinc-900 transition hover:text-blue-600"
          >
            📚 Общая база знаний
          </button>

          <div className="relative min-w-40 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по всей базе…"
              className="w-full rounded-lg border border-zinc-300 py-1.5 pl-9 pr-8 text-sm outline-none focus:border-blue-500"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFavorites((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              showFavorites
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <Star className="h-4 w-4" />
            Избранное
          </button>

          {isAdmin && (
            <button
              onClick={() => setCategoryModal({ name: "", icon: "📄" })}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <Plus className="h-4 w-4" />
              Раздел
            </button>
          )}
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
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {!loaded && (
          <p className="text-sm text-zinc-500">Загрузка…</p>
        )}

        {loaded && searching && (
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold text-zinc-700">
                Результаты поиска по запросу «{query.trim()}» — {results.length}
              </h2>
              <button
                onClick={resetToHub}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                ← Все разделы
              </button>
            </div>
            {results.length === 0 ? (
              <p className="text-sm text-zinc-500">Ничего не найдено.</p>
            ) : (
              <div className="space-y-2">
                {results.map((a) => (
                  <ArticleCard key={a.id} article={a} showCategory />
                ))}
              </div>
            )}
          </section>
        )}

        {loaded && !searching && showFavorites && (
          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-zinc-700">
                ⭐ Избранное — {results.length}
              </h2>
              <button
                onClick={resetToHub}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                ← Все разделы
              </button>
            </div>
            {results.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Пока пусто. Откройте материал и нажмите «⭐ В избранное».
              </p>
            ) : (
              <div className="space-y-2">
                {results.map((a) => (
                  <ArticleCard key={a.id} article={a} showCategory />
                ))}
              </div>
            )}
          </section>
        )}

        {loaded && !searching && !showFavorites && (
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-700">Разделы</h2>
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allTags.slice(0, 12).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setQuery(tag)}
                      className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs text-zinc-700 hover:bg-zinc-300"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {categories.map((c) => (
                <div key={c.id} className="relative">
                  <Link
                    href={`/knowledge/${c.id}`}
                    className="block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-blue-300 hover:bg-blue-50/40"
                  >
                    <div className="text-3xl">{c.icon}</div>
                    <div className="mt-3 font-semibold text-zinc-900">
                      {c.name}
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {c.articleCount ?? 0} материалов
                    </div>
                  </Link>
                  {isAdmin && (
                    <div className="absolute right-2 top-2 flex gap-1">
                      <button
                        onClick={() =>
                          setCategoryModal({
                            id: c.id,
                            name: c.name,
                            icon: c.icon,
                          })
                        }
                        title="Редактировать раздел"
                        className="rounded-md bg-white/90 px-2 py-1 text-xs shadow-sm hover:bg-zinc-100"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteCategory(c.id)}
                        title="Удалить раздел"
                        className="rounded-md bg-white/90 px-2 py-1 text-xs shadow-sm hover:bg-zinc-100"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {formOpen && (
        <ArticleFormModal
          categories={categories}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
        />
      )}

      {categoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900">
              {categoryModal.id ? "Редактирование раздела" : "Новый раздел"}
            </div>
            <div className="space-y-3 px-5 py-4">
              <input
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="Название"
                value={categoryModal.name}
                onChange={(e) =>
                  setCategoryModal({ ...categoryModal, name: e.target.value })
                }
              />
              <input
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="Иконка (эмодзи)"
                value={categoryModal.icon}
                onChange={(e) =>
                  setCategoryModal({ ...categoryModal, icon: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3">
              <button
                onClick={() => setCategoryModal(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Отмена
              </button>
              <button
                onClick={saveCategory}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ExternalLink, Link2, Pencil, Star, Trash2 } from "lucide-react";
import ArticleFormModal, { type ArticleFormData } from "../../ArticleFormModal";

type ArticleDetail = ArticleFormData & {
  category: { id: string; name: string; icon: string };
  author?: { id: string; name: string } | null;
  isFavorite: boolean;
  updatedAt: string;
  tasks?: {
    id: string;
    title: string;
    status: string;
    deadline: string | null;
    client?: { name: string } | null;
  }[];
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  DONE: "Выполнена",
  SENT_TO_CLIENT: "Отправлено клиенту",
  REWORK: "На доработку",
  OVERDUE: "Просрочена",
};

// Просмотр материала: Markdown-текст или ссылка + избранное, копирование, CRUD
export default function ArticleView({
  articleId,
  user,
}: {
  articleId: string;
  user: { id: string; name: string; role: string };
}) {
  const router = useRouter();
  const isAdmin = user.role === "ADMIN";
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/knowledge/articles/${articleId}`);
    if (res.status === 404) {
      setMissing(true);
      setLoaded(true);
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setArticle(data.article);
    }
    setLoaded(true);
  }, [articleId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggleFavorite() {
    if (!article) return;
    const was = article.isFavorite;
    setArticle({ ...article, isFavorite: !was });
    const res = await fetch(
      was
        ? `/api/knowledge/favorites/${article.id}`
        : "/api/knowledge/favorites",
      was
        ? { method: "DELETE" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ articleId: article.id }),
          }
    );
    if (!res.ok) setArticle({ ...article, isFavorite: was });
  }

  async function copyLink() {
    const link = `${window.location.origin}/knowledge/article/${articleId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Ссылка на материал:", link);
    }
  }

  async function remove() {
    if (!article) return;
    if (!window.confirm(`Удалить материал «${article.title}»?`)) return;
    const res = await fetch(`/api/knowledge/articles/${article.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push(`/knowledge/${article.category.id}`);
    }
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-sm text-zinc-500">
        Загрузка…
      </div>
    );
  }

  if (missing || !article) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-100">
        <p className="text-sm text-zinc-600">Материал не найден.</p>
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
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <Link
            href="/knowledge"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            В трекер
          </Link>
          <nav className="min-w-0 flex-1 truncate text-sm text-zinc-500">
            <Link href="/knowledge" className="hover:text-blue-600">
              База знаний
            </Link>
            <span className="mx-1.5">→</span>
            <Link
              href={`/knowledge/${article.category.id}`}
              className="hover:text-blue-600"
            >
              {article.category.icon} {article.category.name}
            </Link>
            <span className="mx-1.5">→</span>
            <span className="font-medium text-zinc-900">{article.title}</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <article className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-zinc-500">
                {article.type === "link" ? "🔗 Ссылка" : "📄 Текст"}
                {article.isPinned && " · 📌 Закреплено"}
                {` · Обновлено ${new Date(article.updatedAt).toLocaleDateString(
                  "ru-RU"
                )}`}
                {article.author ? ` · ${article.author.name}` : ""}
              </div>
              <h1 className="mt-1 text-xl font-bold text-zinc-900">
                {article.title}
              </h1>
              {article.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {article.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleFavorite}
                title={article.isFavorite ? "Убрать из избранного" : "В избранное"}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm transition ${
                  article.isFavorite
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <Star
                  className={`h-4 w-4 ${
                    article.isFavorite ? "fill-amber-400" : ""
                  }`}
                />
              </button>
              <button
                onClick={copyLink}
                title="Скопировать ссылку"
                className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50"
              >
                <Link2 className="h-4 w-4" />
                {copied ? "Скопировано" : "Ссылка"}
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => setEditOpen(true)}
                    title="Редактировать"
                    className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={remove}
                    title="Удалить"
                    className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {article.type === "link" ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm text-zinc-600">Внешняя ссылка:</p>
              <p className="mt-1 break-all font-mono text-sm text-blue-700">
                {article.url}
              </p>
              <a
                href={article.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <ExternalLink className="h-4 w-4" />
                Открыть в новой вкладке
              </a>
            </div>
          ) : (
            <div className="kb-markdown text-sm leading-6 text-zinc-800">
              <ReactMarkdown>{article.content ?? ""}</ReactMarkdown>
            </div>
          )}
        </article>

        {article.tasks && article.tasks.length > 0 && (
          <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">
              Задачи, связанные с материалом ({article.tasks.length})
            </h2>
            <ul className="space-y-2">
              {article.tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    href="/dashboard"
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm transition hover:border-blue-300 hover:bg-blue-50/40"
                  >
                    <span className="font-medium text-zinc-900">{t.title}</span>
                    {t.client && (
                      <span className="text-xs text-zinc-500">
                        {t.client.name}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-zinc-500">
                      {STATUS_LABELS[t.status] ?? t.status}
                      {t.deadline
                        ? ` · до ${new Date(t.deadline).toLocaleDateString(
                            "ru-RU"
                          )}`
                        : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {editOpen && (
        <ArticleFormModal
          article={article}
          categories={[
            { id: article.category.id, name: article.category.name, icon: article.category.icon },
          ]}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { KnowledgeCategory } from "@/lib/knowledge";

export type ArticleFormData = {
  id?: string;
  categoryId: string;
  type: string;
  title: string;
  content: string | null;
  url: string | null;
  tags: string[];
  isPinned: boolean;
};

// Форма создания / редактирования материала (только для ADMIN)
export default function ArticleFormModal({
  article,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  article?: ArticleFormData;
  categories: KnowledgeCategory[];
  defaultCategoryId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(article?.id);
  const [title, setTitle] = useState(article?.title ?? "");
  const [type, setType] = useState(article?.type ?? "text");
  const [categoryId, setCategoryId] = useState(
    article?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? ""
  );
  const [content, setContent] = useState(article?.content ?? "");
  const [url, setUrl] = useState(article?.url ?? "");
  const [tagsInput, setTagsInput] = useState((article?.tags ?? []).join(", "));
  const [isPinned, setIsPinned] = useState(article?.isPinned ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!title.trim()) {
      setError("Укажите название");
      return;
    }
    if (!categoryId) {
      setError("Выберите раздел");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        categoryId,
        type,
        content: type === "text" ? content : null,
        url: type === "link" ? url.trim() : null,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        isPinned,
      };
      const res = await fetch(
        editing ? `/api/knowledge/articles/${article!.id}` : "/api/knowledge/articles",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const input =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <span className="text-sm font-semibold text-zinc-900">
            {editing ? "Редактирование материала" : "Новый материал"}
          </span>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Название
            </label>
            <input
              className={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Календарь налоговых платежей"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Раздел
              </label>
              <select
                className={input}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Тип
              </label>
              <select
                className={input}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="text">📄 Текст (Markdown)</option>
                <option value="link">🔗 Ссылка</option>
              </select>
            </div>
          </div>

          {type === "text" ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Текст (Markdown: # заголовок, **жирный**, списки)
              </label>
              <textarea
                className={`${input} min-h-40 font-mono text-xs`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Заголовок&#10;&#10;Текст статьи…"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Адрес ссылки
              </label>
              <input
                className={input}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Теги (через запятую)
              </label>
              <input
                className={input}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="налоги, декларации"
              />
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-4 w-4"
              />
              📌 Закрепить вверху списка
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Отмена
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

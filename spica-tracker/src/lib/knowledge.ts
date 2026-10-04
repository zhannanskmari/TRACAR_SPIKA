// Чистые функции модуля «Общая база знаний» — используются в API и UI

/** Раздел базы знаний (плитка хаба) */
export type KnowledgeCategory = {
  id: string;
  name: string;
  icon: string;
  sortOrder?: number;
  articleCount?: number;
};

export type ArticleSummary = {
  id: string;
  categoryId: string;
  type: string;
  title: string;
  content?: string | null;
  url?: string | null;
  tags: string[];
  isPinned: boolean;
  updatedAt: string | Date;
  isFavorite?: boolean;
};

/** Совпадение поискового запроса по названию и тексту (без учёта регистра) */
export function matchesQuery(
  article: Pick<ArticleSummary, "title" | "content">,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${article.title}\n${article.content ?? ""}`.toLowerCase();
  return haystack.includes(q);
}

/** Фильтрация материалов: поисковый запрос + тег (+ только избранные) */
export function filterArticles(
  list: ArticleSummary[],
  opts: { q?: string; tag?: string; onlyFavorites?: boolean } = {}
): ArticleSummary[] {
  return list.filter((a) => {
    if (opts.onlyFavorites && !a.isFavorite) return false;
    if (opts.tag && !a.tags.includes(opts.tag)) return false;
    if (opts.q && !matchesQuery(a, opts.q)) return false;
    return true;
  });
}

/** Сортировка: закреплённые вверху, затем по дате обновления */
export function sortArticles(list: ArticleSummary[]): ArticleSummary[] {
  return [...list].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const ta = new Date(a.updatedAt).getTime();
    const tb = new Date(b.updatedAt).getTime();
    return tb - ta;
  });
}

/** Уникальные теги списка материалов (в алфавитном порядке) */
export function collectTags(list: ArticleSummary[]): string[] {
  const set = new Set<string>();
  for (const a of list) for (const t of a.tags) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b, "ru"));
}

/** Нормализация массива тегов из запроса: обрезка, без пустых и дублей */
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const tags: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item.trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** Прямая ссылка из карточки задачи: обрезка, протокол https:// по умолчанию */
export function normalizeKnowledgeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!url) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  return `https://${url}`;
}

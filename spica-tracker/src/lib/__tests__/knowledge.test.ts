import { describe, expect, it } from "vitest";
import {
  collectTags,
  filterArticles,
  matchesQuery,
  sortArticles,
  type ArticleSummary,
} from "../knowledge";

function art(over: Partial<ArticleSummary> = {}): ArticleSummary {
  return {
    id: "a1",
    categoryId: "c1",
    type: "text",
    title: "Календарь налоговых платежей",
    content: "Сроки уплаты налогов в 2026 году",
    tags: ["налоги"],
    isPinned: false,
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

describe("matchesQuery", () => {
  it("находит по названию без учёта регистра", () => {
    expect(matchesQuery(art(), "КАЛЕНДАРЬ")).toBe(true);
    expect(matchesQuery(art(), "ндс")).toBe(false);
  });

  it("ищет и по тексту статьи", () => {
    expect(matchesQuery(art(), "2026 год")).toBe(true);
  });

  it("пустой запрос пропускает всё", () => {
    expect(matchesQuery(art(), "  ")).toBe(true);
  });

  it("учитывает контент отсутствующий (link)", () => {
    expect(matchesQuery(art({ content: null }), "налоговых")).toBe(true);
    expect(matchesQuery(art({ content: null }), "ничего")).toBe(false);
  });
});

describe("filterArticles", () => {
  const list = [
    art({ id: "1", title: "НДС: основные правила", tags: ["ндс"] }),
    art({ id: "2", title: "УСН vs ОСНО", tags: ["усн"], isFavorite: true }),
    art({ id: "3", title: "План счетов", tags: ["бухучёт"], isPinned: true }),
  ];

  it("фильтр по запросу", () => {
    expect(filterArticles(list, { q: "ндс" }).map((a) => a.id)).toEqual(["1"]);
  });

  it("фильтр по тегу", () => {
    expect(filterArticles(list, { tag: "усн" }).map((a) => a.id)).toEqual(["2"]);
  });

  it("только избранные", () => {
    expect(filterArticles(list, { onlyFavorites: true }).map((a) => a.id)).toEqual([
      "2",
    ]);
  });

  it("комбинация запроса и тега", () => {
    expect(filterArticles(list, { q: "правила", tag: "усн" })).toEqual([]);
    expect(filterArticles(list, { q: "правила", tag: "ндс" }).map((a) => a.id)).toEqual([
      "1",
    ]);
  });
});

describe("sortArticles", () => {
  it("закреплённые вверху, затем по дате обновления", () => {
    const sorted = sortArticles([
      art({ id: "old", updatedAt: "2026-09-01T00:00:00.000Z" }),
      art({ id: "new", updatedAt: "2026-10-02T00:00:00.000Z" }),
      art({ id: "pin", isPinned: true, updatedAt: "2026-08-01T00:00:00.000Z" }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["pin", "new", "old"]);
  });
});

describe("collectTags", () => {
  it("собирает уникальные теги по алфавиту", () => {
    const tags = collectTags([
      art({ tags: ["ндс", "отчётность"] }),
      art({ tags: ["ндс", "усн"] }),
    ]);
    expect(tags).toEqual(["ндс", "отчётность", "усн"]);
  });
});

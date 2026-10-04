import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/knowledge-access";
import { normalizeTags } from "@/lib/knowledge";

const ARTICLE_SELECT = {
  id: true,
  categoryId: true,
  type: true,
  title: true,
  content: true,
  url: true,
  tags: true,
  isPinned: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, icon: true } },
  author: { select: { id: true, name: true } },
} as const;

// GET /api/knowledge/articles?category=… — материалы (фильтры поиска/тегов — на клиенте)
export async function GET(request: NextRequest) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category");

  const articles = await prisma.article.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    select: {
      ...ARTICLE_SELECT,
      favorites: { where: { userId: guard.session.id }, select: { userId: true } },
    },
  });

  return NextResponse.json({
    articles: articles.map(({ favorites, ...a }) => ({
      ...a,
      isFavorite: favorites.length > 0,
    })),
  });
}

// POST /api/knowledge/articles — создать материал (только ADMIN)
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
  const type = body.type === "link" ? "link" : "text";

  if (!title) {
    return NextResponse.json({ error: "Укажите название материала" }, { status: 400 });
  }
  if (!categoryId) {
    return NextResponse.json({ error: "Укажите раздел" }, { status: 400 });
  }
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const content = typeof body.content === "string" ? body.content : null;
  if (type === "link" && !url) {
    return NextResponse.json({ error: "Укажите адрес ссылки" }, { status: 400 });
  }

  const article = await prisma.article.create({
    data: {
      categoryId,
      type,
      title,
      content: type === "text" ? content : null,
      url: type === "link" ? url : null,
      tags: normalizeTags(body.tags),
      isPinned: body.isPinned === true,
      authorId: guard.session.id,
      sortOrder: (await prisma.article.count({ where: { categoryId } })) + 1,
    },
    select: ARTICLE_SELECT,
  });

  return NextResponse.json({ article }, { status: 201 });
}

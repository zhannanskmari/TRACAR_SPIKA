import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/knowledge-access";
import { normalizeTags } from "@/lib/knowledge";

// GET /api/knowledge/articles/[id] — полный материал + связанные задачи канбана
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, icon: true } },
      author: { select: { id: true, name: true } },
      favorites: { where: { userId: guard.session.id }, select: { userId: true } },
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          deadline: true,
          client: { select: { name: true } },
        },
        orderBy: { deadline: "asc" },
      },
    },
  });
  if (!article) {
    return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
  }

  const { favorites, ...rest } = article;
  return NextResponse.json({
    article: { ...rest, isFavorite: favorites.length > 0 },
  });
}

// PATCH /api/knowledge/articles/[id] — редактирование (только ADMIN)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
  }
  if (typeof body.categoryId === "string" && body.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
    }
    data.categoryId = body.categoryId;
  }
  if (body.type === "text" || body.type === "link") {
    data.type = body.type;
  }
  if (body.content !== undefined) {
    data.content = typeof body.content === "string" && body.content.trim()
      ? body.content
      : null;
  }
  if (body.url !== undefined) {
    data.url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : null;
  }
  if (body.tags !== undefined) {
    data.tags = normalizeTags(body.tags);
  }
  if (typeof body.isPinned === "boolean") {
    data.isPinned = body.isPinned;
  }

  if (data.type === "link" && !data.url && !article.url) {
    return NextResponse.json({ error: "Укажите адрес ссылки" }, { status: 400 });
  }

  const updated = await prisma.article.update({
    where: { id },
    data,
    select: {
      id: true,
      categoryId: true,
      type: true,
      title: true,
      content: true,
      url: true,
      tags: true,
      isPinned: true,
      updatedAt: true,
      category: { select: { id: true, name: true, icon: true } },
    },
  });

  return NextResponse.json({ article: updated });
}

// DELETE /api/knowledge/articles/[id] — удаление (только ADMIN)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
  }

  // Связь с задачами снимается (SetNull), избранное удаляется каскадно
  await prisma.article.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

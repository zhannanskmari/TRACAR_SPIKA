import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/knowledge-access";

// GET /api/knowledge/favorites — id избранных материалов текущего пользователя
export async function GET() {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const favorites = await prisma.favorite.findMany({
    where: { userId: guard.session.id },
    select: { articleId: true },
  });

  return NextResponse.json({ articleIds: favorites.map((f) => f.articleId) });
}

// POST /api/knowledge/favorites { articleId } — добавить в избранное ⭐
export async function POST(request: NextRequest) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const articleId = typeof body.articleId === "string" ? body.articleId : "";
  if (!articleId) {
    return NextResponse.json({ error: "Укажите материал" }, { status: 400 });
  }
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true },
  });
  if (!article) {
    return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
  }

  await prisma.favorite.upsert({
    where: { userId_articleId: { userId: guard.session.id, articleId } },
    update: {},
    create: { userId: guard.session.id, articleId },
  });

  return NextResponse.json({ ok: true, isFavorite: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/knowledge-access";

// GET /api/knowledge/categories — все разделы со счётчиком материалов
export async function GET() {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { articles: true } } },
  });

  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      sortOrder: c.sortOrder,
      articleCount: c._count.articles,
    })),
  });
}

// POST /api/knowledge/categories — создать раздел (только ADMIN)
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Укажите название раздела" }, { status: 400 });
  }

  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Раздел с таким названием уже есть" }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: {
      name,
      icon: typeof body.icon === "string" && body.icon.trim() ? body.icon.trim() : "📄",
      sortOrder:
        typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
          ? Math.round(body.sortOrder)
          : (await prisma.category.count()) + 1,
    },
  });

  return NextResponse.json({ category }, { status: 201 });
}

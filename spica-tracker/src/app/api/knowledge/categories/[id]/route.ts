import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/knowledge-access";

// PATCH /api/knowledge/categories/[id] — переименование / иконка / порядок (ADMIN)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    const name = body.name.trim();
    const duplicate = await prisma.category.findFirst({
      where: { name, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Раздел с таким названием уже есть" },
        { status: 409 }
      );
    }
    data.name = name;
  }
  if (typeof body.icon === "string" && body.icon.trim()) {
    data.icon = body.icon.trim();
  }
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.round(body.sortOrder);
  }

  const updated = await prisma.category.update({ where: { id }, data });
  return NextResponse.json({ category: updated });
}

// DELETE /api/knowledge/categories/[id] — удаление раздела вместе со статьями (ADMIN)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
  }

  // Статьи удаляются каскадно (onDelete: Cascade)
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/knowledge-access";

// DELETE /api/knowledge/favorites/[articleId] — убрать из избранного
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const { articleId } = await params;
  await prisma.favorite.deleteMany({
    where: { userId: guard.session.id, articleId },
  });

  return NextResponse.json({ ok: true, isFavorite: false });
}

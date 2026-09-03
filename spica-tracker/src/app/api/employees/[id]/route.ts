import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const SPECIALIZATIONS = ["SALARY", "TAX"];

async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  specialization: true,
  createdAt: true,
} as const;

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  }
  if (existing.role !== "EXECUTOR") {
    return NextResponse.json({ error: "Это не сотрудник" }, { status: 400 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }

  if (
    typeof body.email === "string" &&
    body.email.trim() &&
    body.email.trim().toLowerCase() !== existing.email
  ) {
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Укажите корректный email" },
        { status: 400 }
      );
    }
    const dup = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }
    data.email = email;
  }

  if (typeof body.specialization === "string") {
    data.specialization = SPECIALIZATIONS.includes(body.specialization)
      ? body.specialization
      : null;
  }

  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: "Пароль должен быть не короче 6 символов" },
        { status: 400 }
      );
    }
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  const employee = await prisma.user.update({
    where: { id },
    data,
    select,
  });

  return NextResponse.json({ employee });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  }
  if (existing.role !== "EXECUTOR") {
    return NextResponse.json({ error: "Это не сотрудник" }, { status: 400 });
  }

  // Нельзя удалить сотрудника, если на него ссылаются клиенты, задачи, комментарии или документы
  const [primaryClient, assignedTasks, comments, documents] = await Promise.all([
    prisma.client.findFirst({
      where: { primaryExecutorId: id },
      select: { id: true, name: true },
    }),
    prisma.task.count({ where: { assignedToId: id } }),
    prisma.comment.count({ where: { userId: id } }),
    prisma.document.count({ where: { uploadedById: id } }),
  ]);

  if (primaryClient || assignedTasks > 0 || comments > 0 || documents > 0) {
    const parts: string[] = [];
    if (primaryClient)
      parts.push(`главный исполнитель «${primaryClient.name}»`);
    if (assignedTasks > 0) parts.push(`${assignedTasks} задач`);
    if (comments > 0) parts.push(`${comments} комментариев`);
    if (documents > 0) parts.push(`${documents} документов`);
    return NextResponse.json(
      { error: `Нельзя удалить: сотрудник указан как ${parts.join(", ")}` },
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

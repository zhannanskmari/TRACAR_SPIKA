import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const employees = await prisma.user.findMany({
    where: { role: "EXECUTOR" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      specialization: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ employees });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const specialization = SPECIALIZATIONS.includes(body.specialization)
    ? body.specialization
    : null;

  if (!name) {
    return NextResponse.json({ error: "Укажите имя сотрудника" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Пароль должен быть не короче 6 символов" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Пользователь с таким email уже существует" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const employee = await prisma.user.create({
    data: { name, email, passwordHash, role: "EXECUTOR", specialization },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      specialization: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ employee }, { status: 201 });
}

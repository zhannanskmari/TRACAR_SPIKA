import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";

export type GuardResult =
  | { ok: true; session: SessionUser }
  | { ok: false; response: NextResponse };

/** База знаний доступна сотрудникам (ADMIN / EXECUTOR), не клиентам */
export async function requireStaff(): Promise<GuardResult> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.role === "CLIENT") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, session };
}

/** Создание / редактирование / удаление — только для ADMIN */
export async function requireAdmin(): Promise<GuardResult> {
  const guard = await requireStaff();
  if (!guard.ok) return guard;
  if (guard.session.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return guard;
}

import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

// GET-вариант для разрыва петли редиректов: сессия валидна по подписи,
// но пользователя уже нет в БД (удалён / база пересеяна) — гасим куку
// и уходим на /login, иначе middleware вернёт обратно на защищённую страницу.
export async function GET(request: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url));
}

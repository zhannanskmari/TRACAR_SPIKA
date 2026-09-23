import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

// GET-вариант для разрыва петли редиректов: сессия валидна по подписи,
// но пользователя уже нет в БД (удалён / база пересеяна) — гасим куку
// и уходим на /login, иначе middleware вернёт обратно на защищённую страницу.
// Location относительный: за reverse-proxy (Railway) абсолютный URL,
// собранный из request.url, указывал бы на внутренний localhost:8080.
export async function GET() {
  await destroySession();
  return new NextResponse(null, {
    status: 307,
    headers: { Location: "/login" },
  });
}

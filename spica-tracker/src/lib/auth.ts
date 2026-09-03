import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "spica-dev-secret";
const COOKIE_NAME = "spica_token";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function createSession(user: SessionUser): Promise<void> {
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Приложение работает по HTTP (localhost / локальная сеть), поэтому
    // флаг Secure не нужен — иначе браузер не отправляет cookie и все API запросы падают с 401.
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

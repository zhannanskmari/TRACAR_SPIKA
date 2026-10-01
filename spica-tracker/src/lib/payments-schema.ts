import { prisma } from "@/lib/prisma";

// Самоприменение схемы «Оплат» на средах, куда нет доступа к БД
// (например, прод внутри сети Railway). Выполняется один раз за
// жизненный цикл процесса: проверяет наличие колонки, а при первом
// появлении переносит проставленные вручную стартовые остатки
// в флаг startManual (остальные записи считаются переносными).
let ensured = false;

export async function ensureMonthBalanceSchema(): Promise<void> {
  if (ensured) return;
  try {
    const cols = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MonthBalance' AND column_name = 'startManual'
      ) AS exists
    `;
    if (cols[0]?.exists) {
      ensured = true;
      return;
    }
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "MonthBalance" ADD COLUMN "startManual" BOOLEAN NOT NULL DEFAULT false'
    );
    // Разовая миграция данных: всё, что было введено вручную
    // (startBalance <> 0), остаётся ручным; нулевые старты, созданные
    // старым кодом при вводе оплаты, становятся переносными.
    await prisma.$executeRawUnsafe(
      'UPDATE "MonthBalance" SET "startManual" = ("startBalance" <> 0)'
    );
    ensured = true;
  } catch (e) {
    console.error("ensureMonthBalanceSchema failed:", e);
  }
}

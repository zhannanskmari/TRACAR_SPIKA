export function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setHours(12, 0, 0, 0);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return result;
}

// Нормализация даты (Prisma Date | ISO-строка) в ISO-строку для передачи
// в клиентские компоненты. Единый примитив вместо инлайн-конверсий.
export function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
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

// Дедлайн на заданный день с сохранением времени суток исходной даты
// (drag-and-drop карточки между днями в календаре).
// Без исходной даты — полдень, чтобы карточка не уплыла на соседний день
// из-за часового пояса.
export function deadlineForDayIso(
  dateIso: string | null | undefined,
  day: Date
): string {
  let hh = 12;
  let mm = 0;
  if (dateIso) {
    const d = new Date(dateIso);
    if (!isNaN(d.getTime())) {
      hh = d.getHours();
      mm = d.getMinutes();
    }
  }
  const target = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hh,
    mm,
    0,
    0
  );
  return target.toISOString();
}
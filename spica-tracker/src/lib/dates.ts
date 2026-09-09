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
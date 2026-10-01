// Упрощённая панель сотрудника: без «Оплат», «Архива», «Архивации»
// и начислений зарплаты/аванса. Остаётся «Доска задач» + «Календарь».
//
// Чтобы выдать упрощённую панель ещё одному сотруднику, добавьте его
// сюда (email в нижнем регистре).
const SIMPLE_PANEL_EMAILS: readonly string[] = [
  "margaritavalbrit@gmail.com",
];

export function hasSimplePanel(user: { email: string }): boolean {
  return SIMPLE_PANEL_EMAILS.includes(user.email.trim().toLowerCase());
}

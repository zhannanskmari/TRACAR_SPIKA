// Счета для таблицы «Ввод документов»
export const DOC_ACCOUNTS = [
  { key: "51", label: "51 сч" },
  { key: "60", label: "60 сч" },
  { key: "62", label: "62 сч" },
  { key: "71", label: "71 сч" },
] as const;

export type DocAccount = (typeof DOC_ACCOUNTS)[number]["key"];

export const DOC_ACCOUNT_KEYS: string[] = DOC_ACCOUNTS.map((a) => a.key);

"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, Save, Trash2, X } from "lucide-react";
import { DOC_ACCOUNTS, accountLabel } from "@/lib/doc-meta";
import { TAX_SYSTEMS, taxLabel } from "@/app/clients/client-meta";

type DocClient = {
  id: string;
  name: string;
  shortName: string | null;
  accountNote: string | null;
  taxSystem: string;
};

type DocEntry = {
  clientId: string;
  account: string;
  date: string | null;
  text: string | null;
};

function cellKey(clientId: string, account: string): string {
  return `${clientId}:${account}`;
}

// Порядок групп — как в справочнике видов налогообложения
const GROUP_ORDER = [...TAX_SYSTEMS.map((t) => t.label), "Другое"];

function groupByTaxSystem(
  clients: DocClient[]
): { label: string; clients: DocClient[] }[] {
  const map = new Map<string, DocClient[]>();
  for (const c of clients) {
    const known = TAX_SYSTEMS.some((t) => t.value === c.taxSystem);
    const label = known ? taxLabel(c.taxSystem) : "Другое";
    const list = map.get(label);
    if (list) list.push(c);
    else map.set(label, [c]);
  }
  return GROUP_ORDER.filter((label) => map.has(label)).map((label) => ({
    label,
    clients: map.get(label) ?? [],
  }));
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU");
}

export default function DocumentsView({
  userName,
  clients,
  emptyClients,
  entries: initialEntries,
  autoEntries,
}: {
  userName: string;
  clients: DocClient[];
  emptyClients: DocClient[];
  entries: DocEntry[];
  autoEntries: DocEntry[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"main" | "empty">("main");
  const shownClients = tab === "empty" ? emptyClients : clients;
  const groups = groupByTaxSystem(shownClients);

  const [entries, setEntries] = useState<Map<string, DocEntry>>(() => {
    const map = new Map<string, DocEntry>();
    for (const e of initialEntries) map.set(cellKey(e.clientId, e.account), e);
    return map;
  });

  // Автозаполнение из карточек доски (только если нет сохранённой записи)
  const autoMap = useState<Map<string, DocEntry>>(() => {
    const map = new Map<string, DocEntry>();
    for (const e of autoEntries) map.set(cellKey(e.clientId, e.account), e);
    return map;
  })[0];

  function getEntry(clientId: string, account: string): DocEntry | null {
    return (
      entries.get(cellKey(clientId, account)) ??
      autoMap.get(cellKey(clientId, account)) ??
      null
    );
  }

  function isAuto(clientId: string, account: string): boolean {
    const key = cellKey(clientId, account);
    return !entries.has(key) && autoMap.has(key);
  }

  // Открытая ячейка для редактирования
  const [openCell, setOpenCell] = useState<{
    clientId: string;
    account: string;
    clientName: string;
  } | null>(null);
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openEditor(client: DocClient, account: string) {
    const entry = getEntry(client.id, account);
    setOpenCell({ clientId: client.id, account, clientName: client.name });
    setDate(toDateInput(entry?.date ?? null));
    setText(entry?.text ?? "");
    setError("");
  }

  function closeEditor() {
    setOpenCell(null);
    setError("");
  }

  async function save() {
    if (!openCell) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/doc-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: openCell.clientId,
          account: openCell.account,
          date: date ? new Date(`${date}T12:00:00`).toISOString() : null,
          text: text.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить");
        return;
      }
      const key = cellKey(openCell.clientId, openCell.account);
      setEntries((prev) => {
        const next = new Map(prev);
        if (data.entry) next.set(key, data.entry);
        else next.delete(key);
        return next;
      });
      closeEditor();
    } catch {
      setError("Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-bold text-zinc-900">Спика</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            Ввод документов
          </span>
        </div>
        <div className="text-right text-sm">
          <div className="font-medium text-zinc-900">{userName}</div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/clients")}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-base font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <ArrowLeft className="h-5 w-5" />
            К клиентам
          </button>
          <h1 className="text-xl font-semibold text-zinc-900">
            Ввод документов
          </h1>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => setTab("main")}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              tab === "main"
                ? "bg-blue-600 text-white"
                : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Основные ({clients.length})
          </button>
          <button
            onClick={() => setTab("empty")}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              tab === "empty"
                ? "bg-blue-600 text-white"
                : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Пустышки ({emptyClients.length})
          </button>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-zinc-50 text-xs font-semibold text-zinc-600">
                <th className="sticky left-0 top-0 z-20 border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-left w-[10ch]">
                  Фирма
                </th>
                <th className="sticky top-0 z-10 border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-left w-[10ch]">
                  Способ ввода
                </th>
                {DOC_ACCOUNTS.map((acc) => (
                  <th
                    key={acc.key}
                    className="sticky top-0 z-10 border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-center w-[10ch]"
                  >
                    {acc.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownClients.length === 0 && (
                <tr>
                  <td
                    colSpan={DOC_ACCOUNTS.length + 2}
                    className="px-3 py-6 text-center text-zinc-400"
                  >
                    {tab === "empty" ? "Пустышек нет" : "Клиентов пока нет"}
                  </td>
                </tr>
              )}
              {groups.map((group) => (
                <Fragment key={group.label}>
                  <tr>
                    <td
                      colSpan={DOC_ACCOUNTS.length + 2}
                      className="border-b border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600"
                    >
                      {group.label}
                    </td>
                  </tr>
                  {group.clients.map((client) => (
                    <tr key={client.id} className="align-top">
                      <td className="sticky left-0 z-10 border-b border-r border-zinc-100 bg-white px-3 py-2">
                        <div className="font-medium text-zinc-900">{client.name}</div>
                        {client.shortName && (
                          <div className="text-xs text-zinc-500">
                            {client.shortName}
                          </div>
                        )}
                      </td>
                      <td className="border-b border-r border-zinc-100 px-3 py-2 text-xs text-zinc-600">
                        {client.accountNote || "—"}
                      </td>
                      {DOC_ACCOUNTS.map((acc) => {
                        const entry = getEntry(client.id, acc.key);
                        const auto = isAuto(client.id, acc.key);
                        return (
                          <td
                            key={acc.key}
                            onClick={() => openEditor(client, acc.key)}
                            className="cursor-pointer border-b border-r border-zinc-100 px-2 py-2 hover:bg-blue-50"
                          >
                            {entry ? (
                              <div className={`text-xs ${auto ? "italic text-zinc-400" : ""}`}>
                                {entry.date && (
                                  <div className={`font-medium ${auto ? "" : "text-zinc-700"}`}>
                                    {formatDate(entry.date)}
                                  </div>
                                )}
                                {entry.text && (
                                  <div className="line-clamp-3 whitespace-pre-wrap">
                                    {entry.text}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center text-zinc-300">—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {openCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeEditor}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-xs text-zinc-500">{openCell.clientName}</div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  {accountLabel(openCell.account)}
                </h3>
                {isAuto(openCell.clientId, openCell.account) && (
                  <div className="mt-0.5 text-[11px] italic text-zinc-400">
                    из карточки на доске — при сохранении заменится
                  </div>
                )}
              </div>
              <button
                onClick={closeEditor}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Дата
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Ввод
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="Введите текст..."
                  className="w-full resize-y rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">
                  {error}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
                {(date || text.trim()) && (
                  <button
                    onClick={() => {
                      setDate("");
                      setText("");
                    }}
                    title="Очистить поля (сохранение удалит запись)"
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Очистить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

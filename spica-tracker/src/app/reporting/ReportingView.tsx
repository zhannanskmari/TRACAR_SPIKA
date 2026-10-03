"use client";

import { ArrowLeft, Building2, FileText, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { TAX_DEADLINES } from "./tax-deadlines";

export default function ReportingView({ adminName }: { adminName: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-bold text-zinc-900">Спика</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            Отчётность
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="font-medium text-zinc-900">{adminName}</div>
            <div className="text-xs text-zinc-500">Руководитель</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
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
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">
              Сроки отчётности и платежей
            </h1>
            <p className="text-sm text-zinc-500">
              Налоги, декларации и уведомления в ИФНС по системам
              налогообложения
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {TAX_DEADLINES.map((section) => (
            <section
              key={section.key}
              className="rounded-xl border border-zinc-200 bg-white"
            >
              <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
                <FileText className="h-4 w-4 text-blue-600" />
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">
                    {section.title}
                  </h2>
                  <p className="text-xs text-zinc-500">{section.description}</p>
                </div>
              </div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-left text-xs font-semibold text-zinc-600">
                    <th className="border-b border-r border-zinc-200 px-3 py-2">
                      Налог / отчётность / уведомление
                    </th>
                    <th className="border-b border-zinc-200 px-3 py-2">
                      Срок
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.item} className="align-top">
                      <td className="border-b border-r border-zinc-100 px-3 py-2 text-zinc-700">
                        {row.item}
                        {row.note && (
                          <div className="text-xs text-zinc-400">
                            {row.note}
                          </div>
                        )}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-2 font-medium text-zinc-900">
                        {row.deadline}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

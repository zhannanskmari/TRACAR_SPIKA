"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TASK_TYPE_LABELS } from "@/lib/task-meta";

// Сворачиваемые группы в выборе типа задачи
const GROUPS: { label: string; match: (t: string) => boolean }[] = [
  { label: "Зарплата", match: (t) => t.startsWith("SALARY_") },
  {
    label: "Отчётность",
    match: (t) => t === "REPORT" || t.startsWith("REPORT_"),
  },
];

// Выпадающий выбор типа задачи: типы групп («Зарплата», «Отчётность»)
// свёрнуты и раскрываются кликом, остальные типы — обычным списком.
export default function TaskTypeSelect({
  value,
  onChange,
  types,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  types: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const groups = GROUPS.map((g) => ({
    ...g,
    types: types.filter(g.match),
  })).filter((g) => g.types.length > 0);
  const groupedSet = new Set(groups.flatMap((g) => g.types));
  const otherTypes = types.filter((t) => !groupedSet.has(t));

  // Закрытие списка кликом вне
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        // при открытии сразу показываем группу выбранного типа
        const g = groups.find((x) => x.match(value));
        setOpenLabel(g ? g.label : null);
      }
      return next;
    });
  }

  function pick(t: string) {
    onChange(t);
    setOpen(false);
  }

  const itemCls = (active: boolean) =>
    `flex w-full items-center py-1.5 pl-7 pr-3 text-left text-sm hover:bg-zinc-100 ${
      active ? "bg-blue-50 font-medium text-blue-700" : "text-zinc-700"
    }`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className={`flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className="truncate">{TASK_TYPE_LABELS[value] ?? value}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-xl">
          {groups.map((g) => (
            <Fragment key={g.label}>
              <button
                type="button"
                onClick={() =>
                  setOpenLabel((cur) => (cur === g.label ? null : g.label))
                }
                className="flex w-full items-center justify-between px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                <span>{g.label}</span>
                {openLabel === g.label ? (
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                )}
              </button>
              {openLabel === g.label &&
                g.types.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => pick(t)}
                    className={itemCls(t === value)}
                  >
                    {TASK_TYPE_LABELS[t] ?? t}
                  </button>
                ))}
            </Fragment>
          ))}
          <div className="my-1 border-t border-zinc-100" />
          {otherTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => pick(t)}
              className={`flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-zinc-100 ${
                t === value
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-zinc-700"
              }`}
            >
              {TASK_TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

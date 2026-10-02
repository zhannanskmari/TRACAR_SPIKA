"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TASK_TYPE_LABELS } from "@/lib/task-meta";

// Выпадающий выбор типа задачи: зарплатные типы свёрнуты в группу
// «Зарплата» (раскрывается кликом), остальные типы — обычным списком.
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
  const [salaryOpen, setSalaryOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const salaryTypes = types.filter((t) => t.startsWith("SALARY_"));
  const otherTypes = types.filter((t) => !t.startsWith("SALARY_"));

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
      // при открытии сразу показываем подтипы, если выбранный тип зарплатный
      if (next) setSalaryOpen(value.startsWith("SALARY_"));
      return next;
    });
  }

  function pick(t: string) {
    onChange(t);
    setOpen(false);
  }

  const itemCls = (active: boolean) =>
    `flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-zinc-100 ${
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
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-xl">
          <button
            type="button"
            onClick={() => setSalaryOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            <span>Зарплата</span>
            {salaryOpen ? (
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            )}
          </button>
          {salaryOpen &&
            salaryTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => pick(t)}
                className={`flex w-full items-center py-1.5 pl-7 pr-3 text-left text-sm hover:bg-zinc-100 ${
                  t === value
                    ? "bg-blue-50 font-medium text-blue-700"
                    : "text-zinc-700"
                }`}
              >
                {TASK_TYPE_LABELS[t] ?? t}
              </button>
            ))}
          <div className="my-1 border-t border-zinc-100" />
          {otherTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => pick(t)}
              className={itemCls(t === value)}
            >
              {TASK_TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

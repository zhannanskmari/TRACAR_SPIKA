"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Pencil, X, Check, CircleDot, Loader, RefreshCw, CheckCircle2, Send, AlertTriangle, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { TASK_TYPE_LABELS, STATUS_LABELS } from "@/lib/task-meta";
import TaskTypeSelect from "@/app/dashboard/TaskTypeSelect";
import { deadlineForDayIso } from "@/lib/dates";
import { specSuffix } from "@/lib/specialization";

export type CalendarClient = {
  id: string;
  name: string;
  taxSystem: string;
  tasks: CalendarTask[];
};

export type CalendarTask = {
  id: string;
  title: string;
  taskType: string;
  status: string;
  date: string | null;
  deadline: string | null;
  taxPaymentDate: string | null;
  salaryCalcDate: string | null;
  salaryPaymentDate: string | null;
  taxAmount: number | null;
  durationMinutes: number | null;
  factDurationMinutes: number | null;
  docCount: number | null;
  startTime: string | null;
  endTime: string | null;
  urgent: boolean;
  createdBy: { id: string; name: string } | null;
  assignedTo: { id: string; name: string; specialization: string | null } | null;
  executor: { id: string; name: string; specialization: string | null } | null;
};

const TASK_TYPES = [
  "SALARY_CALC",
  "SALARY_PAYMENT",
  "SALARY_ADVANCE",
  "SALARY_SICK_LEAVE",
  "SALARY_VACATION",
  "SALARY_BONUS",
  "REPORT",
  "REPORT_VAT_DECL",
  "REPORT_VAT_PAY",
  "REPORT_PROFIT_DECL",
  "REPORT_PROFIT_PAY",
  "REPORT_NDFL_6",
  "REPORT_NDFL_PAY",
  "REPORT_NDFL_NOTICE",
  "REPORT_USN_NOTICE",
  "REPORT_USN_PAY",
  "REPORT_TRANSPORT_NOTICE",
  "REPORT_TRANSPORT_PAY",
  "REPORT_PROPERTY_PAY",
  "REPORT_INSURANCE_PAY",
  "REPORT_RSV",
  "REPORT_EFS1",
  "REPORT_PSF",
  "REPORT_SZV_TD",
  "REPORT_AUSN_PAY",
  "REPORT_NDFL_AUSN",
  "IFNS_DEMAND",
  "DEMAND_RECEIPT",
  "CLIENT_REQUEST",
  "PAYMENT_ORDER",
  "DIADOK",
  "ECP",
  "NOTIFICATION",
  "BANK_REGISTRY",
  "CURRENT_ACCOUNT",
  "CASH_DESK",
  "SUPPLIERS",
  "CUSTOMERS",
  "OTHER",
];

// РЎР»РѕС‚С‹ РІСЂРµРјРµРЅРё СЃ С€Р°РіРѕРј 30 РјРёРЅ СЃ 10:00 РґРѕ 20:00
const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const h = String(10 + Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

// РРЅРґРµРєСЃ РІСЂРµРјРµРЅРЅРѕРіРѕ СЃР»РѕС‚Р° РґР»СЏ РІСЂРµРјРµРЅРё "Р§Р§:РњРњ" (РІРЅРµ РґРёР°РїР°Р·РѕРЅР° вЂ” Рє РєСЂР°СЋ)
function toSlotIndex(time: string | null): number {
  if (!time) return 0;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return 0;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  const idx = Math.floor((minutes - 10 * 60) / 30);
  return Math.min(TIME_SLOTS.length - 1, Math.max(0, idx));
}

const CAL_COLORS: Record<string, { bg: string; text: string; amount: string }> = {
  blue:   { bg: "bg-sky-100",   text: "text-sky-900",   amount: "text-sky-700" },
  green:  { bg: "bg-emerald-100", text: "text-emerald-900", amount: "text-emerald-700" },
  beige:  { bg: "bg-amber-50",  text: "text-amber-900",  amount: "text-amber-700" },
  yellow: { bg: "bg-[#fffef7]", text: "text-yellow-900", amount: "text-yellow-700" },
};

// РЎРёРјРІРѕР» СЃС‚Р°С‚СѓСЃР° РєР°СЂС‚РѕС‡РєРё (СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓРµС‚ СЃС‚Р°С‚СѓСЃСѓ Р·Р°РґР°С‡Рё)
const STATUS_SYMBOL: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }
> = {
  NEW: { icon: CircleDot, label: "РќРѕРІРѕРµ", cls: "text-zinc-500" },
  IN_PROGRESS: { icon: Loader, label: "Р•Р¶РµРґРЅРµРІРЅРёРє", cls: "text-blue-500" },
  REWORK: { icon: RefreshCw, label: "РќР° РґРѕСЂР°Р±РѕС‚РєРµ", cls: "text-amber-500" },
  DONE: { icon: CheckCircle2, label: "Р’С‹РїРѕР»РЅРµРЅРѕ", cls: "text-green-600" },
  SENT_TO_CLIENT: { icon: Send, label: "РћС‚РїСЂР°РІР»РµРЅРѕ РєР»РёРµРЅС‚Сѓ", cls: "text-violet-500" },
  OVERDUE: { icon: AlertTriangle, label: "РџСЂРѕСЃСЂРѕС‡РµРЅРѕ", cls: "text-red-500" },
};

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join(".")
      .toUpperCase() + "."
  );
}

function cardColor(task: {
  assignedTo: { id: string; name: string } | null;
  taskType: string;
}): { bg: string; text: string; amount: string } {
  // РљР°СЂС‚РѕС‡РєРё РїРѕ СЃСЂРѕРєР°Рј РѕС‚С‡С‘С‚РЅРѕСЃС‚Рё Рё РЅР°Р»РѕРіРѕРІ вЂ” СЃРІРµС‚Р»Рѕ-Р¶С‘Р»С‚С‹Рµ
  if (task.taskType === "REPORT" || task.taskType.startsWith("REPORT_")) {
    return CAL_COLORS.yellow;
  }
  const name = task.assignedTo?.name ?? "";
  if (name.includes("Р‘СѓР»РіР°РєРѕРІР°")) return CAL_COLORS.beige;
  if (name.includes("РђРЅР°СЃС‚Р°СЃРёСЏ") && task.taskType === "SALARY_CALC") return CAL_COLORS.blue;
  return CAL_COLORS.green;
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// РџРѕРЅРµРґРµР»СЊРЅРёРє С‚РµРєСѓС‰РµР№ РЅРµРґРµР»Рё (Р±РµР· РІСЂРµРјРµРЅРё)
function startOfWeek(d: Date): Date {
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (res.getDay() + 6) % 7; // 0 вЂ” РїРѕРЅРµРґРµР»СЊРЅРёРє
  res.setDate(res.getDate() - dow);
  return res;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function formatShortDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

// Р¤РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ СЃСѓРјРјС‹ СЃ РїСЂРѕР±РµР»Р°РјРё-СЂР°Р·РґРµР»РёС‚РµР»СЏРјРё РіСЂСѓРїРї, Р±РµР· Р»РѕРєР°Р»Рё
function formatAmount(n: number): string {
  return n
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const WEEKDAYS_SHORT = ["РџРЅ", "Р’С‚", "РЎСЂ", "Р§С‚", "РџС‚", "РЎР±", "Р’СЃ"];

function formatDdMm(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

// РљР°СЂС‚РѕС‡РєР° РєР°Р»РµРЅРґР°СЂСЏ СЃ drag-and-drop: Р±СЂРѕСЃРѕРє РІ РґСЂСѓРіРѕР№ РґРµРЅСЊ РјРµРЅСЏРµС‚ РґРµРґР»Р°Р№РЅ.
// memo вЂ” С‡С‚РѕР±С‹ РїРѕРґСЃРІРµС‚РєР° С†РµР»Рё Рё РґРІРёР¶РµРЅРёРµ РєСѓСЂСЃРѕСЂР° РЅРµ РїРµСЂРµСЂРёСЃРѕРІС‹РІР°Р»Рё РІСЃРµ РєР°СЂС‚РѕС‡РєРё.
const DraggableCard = memo(function DraggableCard({
  task,
  clientName,
  dimmed,
  onOpen,
}: {
  task: CalendarTask;
  clientName: string;
  dimmed: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: task.id,
    data: { task, clientName },
  });
  const col = cardColor(task);
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      title={`${task.title}\nРўСЏРЅРёС‚Рµ РІ РґСЂСѓРіРѕР№ РґРµРЅСЊ, С‡С‚РѕР±С‹ РїРµСЂРµРЅРµСЃС‚Рё. РќР°Р¶РјРёС‚Рµ, С‡С‚РѕР±С‹ СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ`}
      className={`mb-1 block w-full cursor-grab rounded text-left ${col.bg} px-1 py-1 text-[11px] leading-tight transition active:cursor-grabbing ${col.text} hover:ring-2 hover:ring-blue-300 ${
        dimmed ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1">
          {STATUS_SYMBOL[task.status] &&
            (() => {
              const s = STATUS_SYMBOL[task.status];
              const IconCmp = s.icon;
              return (
                <span
                  title={`РЎС‚Р°С‚СѓСЃ: ${s.label}`}
                  className={`shrink-0 ${s.cls}`}
                >
                  <IconCmp className="h-3 w-3" />
                </span>
              );
            })()}
          <span className="truncate font-medium">
            {TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
          </span>
          {task.urgent && (
            // СЃСЂРѕС‡РЅР°СЏ Р·Р°РґР°С‡Р° вЂ” Р·РЅР°С‡РѕРє РѕРіРѕРЅСЊРєР° СЂСЏРґРѕРј СЃ С‚РёРїРѕРј
            <span title="РЎСЂРѕС‡РЅР°СЏ Р·Р°РґР°С‡Р°" className="shrink-0">
              <Flame className="h-3 w-3 text-red-600" />
            </span>
          )}
        </span>
        <Pencil className="h-3 w-3 shrink-0 opacity-40" />
      </div>
      <div className="truncate text-[10px] font-semibold text-zinc-800">
        {clientName}
      </div>
      <div className="line-clamp-2">{task.title}</div>
      {task.executor && (
        <div className="mt-0.5 truncate text-[10px] text-zinc-600">
          РСЃРї вЂ” {initials(task.executor.name)}
        </div>
      )}
      {(task.taxAmount != null ||
        task.durationMinutes != null ||
        task.factDurationMinutes != null ||
        task.docCount != null) && (
        <div className={`font-semibold ${col.amount}`}>
          {task.taxAmount != null && (
            <span>{formatAmount(task.taxAmount)} в‚Ѕ</span>
          )}
          {task.taxAmount != null &&
            (task.durationMinutes != null ||
              task.factDurationMinutes != null ||
              task.docCount != null) && <span> В· </span>}
          {task.durationMinutes != null && (
            <span>РџР»Р°РЅ: {task.durationMinutes} РјРёРЅ</span>
          )}
          {task.durationMinutes != null &&
            (task.factDurationMinutes != null || task.docCount != null) && <span> В· </span>}
          {task.factDurationMinutes != null && (
            <span>Р¤Р°РєС‚: {task.factDurationMinutes} РјРёРЅ</span>
          )}
          {task.factDurationMinutes != null && task.docCount != null && <span> В· </span>}
          {task.docCount != null && <span>Р”РѕРє: {task.docCount}</span>}
        </div>
      )}
      {(task.startTime || task.endTime) && (
        <div className="text-[10px] text-zinc-500">
          РќР°С‡Р°Р»Рѕ: {task.startTime ?? "вЂ”"} В· РћРєРѕРЅС‡Р°РЅРёРµ: {task.endTime ?? "вЂ”"}
        </div>
      )}
    </button>
  );
});

// РЇС‡РµР№РєР° РґРЅСЏ вЂ” Р·РѕРЅР° СЃР±СЂРѕСЃР° РґР»СЏ РєР°СЂС‚РѕС‡РµРє (id РЅРµСЃС‘С‚ РєР»СЋС‡ РґРЅСЏ).
// РџРѕРґСЃРІРµС‚РєР° вЂ” РёР· СЃРѕР±СЃС‚РІРµРЅРЅРѕРіРѕ isOver, С‡С‚РѕР±С‹ РЅРµ РїРµСЂРµСЂРёСЃРѕРІС‹РІР°С‚СЊ РІСЃСЋ С‚Р°Р±Р»РёС†Сѓ.
const DaySlot = memo(function DaySlot({
  id,
  dayKey,
  weekend,
  children,
}: {
  id: string;
  dayKey: string;
  weekend: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { dayKey } });
  return (
    <td
      ref={setNodeRef}
      className={`border-b px-1 py-1.5 align-top ${
        isOver
          ? "bg-blue-100 ring-2 ring-inset ring-blue-400"
          : weekend
            ? "bg-zinc-50/50"
            : "border-zinc-100"
      }`}
    >
      {children}
    </td>
  );
});

type EditModalProps = {
  task: CalendarTask;
  clientName: string;
  canEditTax: boolean;
  executors: { id: string; name: string; specialization: string | null }[];
  onClose: () => void;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
};

function EditModal({
  task,
  clientName,
  canEditTax,
  executors,
  onClose,
  onSave,
}: EditModalProps) {
  const [title, setTitle] = useState(task.title);
  const [taskType, setTaskType] = useState(task.taskType);
  const [status, setStatus] = useState(task.status);
  const [urgent, setUrgent] = useState(task.urgent);
  const [deadline, setDeadline] = useState(toDateInput(task.deadline));
  const [duration, setDuration] = useState(
    task.durationMinutes != null ? String(task.durationMinutes) : ""
  );
  const [factDuration, setFactDuration] = useState(
    task.factDurationMinutes != null ? String(task.factDurationMinutes) : ""
  );
  const [docCount, setDocCount] = useState(
    task.docCount != null ? String(task.docCount) : ""
  );
  const [startTime, setStartTime] = useState(task.startTime ?? "");
  const [endTime, setEndTime] = useState(task.endTime ?? "");
  const [assignedToId, setAssignedToId] = useState(task.assignedTo?.id ?? "");
  const [taxAmount, setTaxAmount] = useState(
    task.taxAmount != null ? String(task.taxAmount) : ""
  );
  const [taxPaymentDate, setTaxPaymentDate] = useState(
    toDateInput(task.taxPaymentDate)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const label = "mb-1 block text-xs font-medium text-zinc-600";
  const input =
    "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("РЈРєР°Р¶РёС‚Рµ РЅР°Р·РІР°РЅРёРµ");
      return;
    }
    setSaving(true);
    setError("");

    const patch: Record<string, unknown> = {};
    if (title.trim() !== task.title) patch.title = title.trim();
    if (taskType !== task.taskType) patch.taskType = taskType;
    if (urgent !== task.urgent) patch.urgent = urgent;

    const oldAssigned = task.assignedTo?.id ?? "";
    if (assignedToId && assignedToId !== oldAssigned) {
      patch.assignedToId = assignedToId;
    }

    const newDuration = duration === "" ? null : Math.max(0, Number(duration));
    const oldDuration = task.durationMinutes ?? null;
    if (
      duration !== "" &&
      newDuration !== null &&
      !isNaN(newDuration) &&
      newDuration !== oldDuration
    ) {
      patch.durationMinutes = Math.round(newDuration);
    } else if (duration === "" && oldDuration !== null) {
      patch.durationMinutes = null;
    }

    const newFact = factDuration === "" ? null : Math.max(0, Number(factDuration));
    const oldFact = task.factDurationMinutes ?? null;
    if (
      factDuration !== "" &&
      newFact !== null &&
      !isNaN(newFact) &&
      newFact !== oldFact
    ) {
      patch.factDurationMinutes = Math.round(newFact);
    } else if (factDuration === "" && oldFact !== null) {
      patch.factDurationMinutes = null;
    }

    // РљРѕР»РёС‡РµСЃС‚РІРѕ РїРµСЂРІРёС‡РЅС‹С… РґРѕРєСѓРјРµРЅС‚РѕРІ (РІРІРѕРґ РІ Р±СѓС…РіР°Р»С‚РµСЂСЃРєСѓСЋ РїСЂРѕРіСЂР°РјРјСѓ)
    const newDocs = docCount === "" ? null : Math.max(0, Number(docCount));
    const oldDocs = task.docCount ?? null;
    if (
      docCount !== "" &&
      newDocs !== null &&
      !isNaN(newDocs) &&
      newDocs !== oldDocs
    ) {
      patch.docCount = Math.round(newDocs);
    } else if (docCount === "" && oldDocs !== null) {
      patch.docCount = null;
    }

    if (startTime.trim() !== (task.startTime ?? "")) {
      patch.startTime = startTime.trim() || null;
    }
    if (endTime.trim() !== (task.endTime ?? "")) {
      patch.endTime = endTime.trim() || null;
    }

    const newDeadline = deadline ? new Date(deadline).toISOString() : null;
    const oldDeadline = toDateInput(task.deadline);
    const sentDeadline = oldDeadline
      ? new Date(oldDeadline).toISOString()
      : null;
    // РџРµСЂРµРЅРѕСЃ РєР°СЂС‚РѕС‡РєРё РІ РєРѕР»РѕРЅРєСѓ РІС‹Р±СЂР°РЅРЅРѕР№ РґР°С‚С‹: "РєСЂР°Р№РЅРёР№ СЃСЂРѕРє" СЃС‚Р°РЅРѕРІРёС‚СЃСЏ
    // РѕРїСЂРµРґРµР»СЏСЋС‰РµР№ РґР°С‚РѕР№ РєР°Р»РµРЅРґР°СЂСЏ. Р•СЃР»Рё РґСЂСѓРіРёРµ РґР°С‚С‹ (СѓРїР»Р°С‚Р° РЅР°Р»РѕРіР°, Р·Р°СЂРїР»Р°С‚Р°,
    // СЂР°СЃС‡С‘С‚ Р·Р°СЂРїР»Р°С‚С‹) РѕРєР°Р·Р°Р»РёСЃСЊ СЂР°РЅСЊС€Рµ РЅРѕРІРѕРіРѕ СЃСЂРѕРєР° вЂ” РїРѕРґС‚СЏРіРёРІР°РµРј РёС… Рє РЅРµРјСѓ,
    // РёРЅР°С‡Рµ РєР°СЂС‚РѕС‡РєР° РѕСЃС‚Р°РЅРµС‚СЃСЏ РІ СЃС‚Р°СЂРѕР№ РєРѕР»РѕРЅРєРµ.
    const dateFields: Array<"taxPaymentDate" | "salaryPaymentDate" | "salaryCalcDate"> = [
      "taxPaymentDate",
      "salaryPaymentDate",
      "salaryCalcDate",
    ];
    const movedDate = new Date(`${deadline}T00:00:00`);
    for (const f of dateFields) {
      const raw = task[f];
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      if (movedDate.getTime() > d.getTime()) {
        patch[f] = new Date(`${deadline}T00:00:00`).toISOString();
      }
    }
    if (newDeadline !== sentDeadline) patch.deadline = newDeadline;

    if (canEditTax) {
      const newTax = taxAmount === "" ? null : Number(taxAmount);
      const oldTax = task.taxAmount ?? null;
      if (newTax !== oldTax) patch.taxAmount = newTax;

      const newTaxDate = taxPaymentDate
        ? new Date(taxPaymentDate).toISOString()
        : null;
      const oldTaxDate = task.taxPaymentDate ?? null;
      if (newTaxDate !== oldTaxDate) patch.taxPaymentDate = newTaxDate;
    }

    try {
      await onSave(task.id, patch);
      onClose();
    } catch {
      setError("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-xs text-zinc-500">{clientName}</div>
            <h3 className="text-lg font-semibold text-zinc-900">
              Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ Р·Р°РґР°С‡Рё
            </h3>
            <div className="mt-1 text-xs text-zinc-500">
              {TASK_TYPE_LABELS[task.taskType] ?? task.taskType} В·{" "}
              {task.date ? formatShortDate(task.date) : "Р±РµР· РґР°С‚С‹"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>РќР°Р·РІР°РЅРёРµ *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={input}
            />
          </div>
          <div>
            <label className={label}>РўРёРї Р·Р°РґР°С‡Рё</label>
            <TaskTypeSelect
              value={taskType}
              types={TASK_TYPES}
              className={input}
              onChange={setTaskType}
            />
          </div>
          <div>
            <label className={label}>РЎС‚Р°С‚СѓСЃ</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled
              className={`${input} bg-zinc-50 text-zinc-400`}
            >
              <option value={status}>
                {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
              </option>
            </select>
          </div>
          <div>
            <label className={label}>РљСЂР°Р№РЅРёР№ СЃСЂРѕРє</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={input}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={label}>РџР»Р°РЅ, РјРёРЅ</label>
                <input
                  type="number"
                  min="0"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Р¤Р°РєС‚, РјРёРЅ</label>
                <input
                  type="number"
                  min="0"
                  value={factDuration}
                  onChange={(e) => setFactDuration(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label
                  className={label}
                  title="РљРѕР»РёС‡РµСЃС‚РІРѕ РїРµСЂРІРёС‡РЅС‹С… РґРѕРєСѓРјРµРЅС‚РѕРІ, РІРІРµРґС‘РЅРЅС‹С… РІ Р±СѓС…РіР°Р»С‚РµСЂСЃРєСѓСЋ РїСЂРѕРіСЂР°РјРјСѓ"
                >
                  Р”РѕРєСѓРјРµРЅС‚РѕРІ
                </label>
                <input
                  type="number"
                  min="0"
                  value={docCount}
                  onChange={(e) => setDocCount(e.target.value)}
                  className={input}
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={label}>РќР°С‡Р°Р»Рѕ</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>РћРєРѕРЅС‡Р°РЅРёРµ</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={input}
                />
              </div>
            </div>
          </div>

          {executors.length > 0 && (
            <div className="sm:col-span-2">
              <label className={label}>РћС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Р№</label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className={input}
              >
                <option value="">вЂ”</option>
                {executors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {specSuffix(u.specialization)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canEditTax && (
            <>
              <div>
                <label className={label}>РЎСѓРјРјР° РЅР°Р»РѕРіР°, в‚Ѕ</label>
                <input
                  type="number"
                  min="0"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Р”Р°С‚Р° СѓРїР»Р°С‚С‹</label>
                <input
                  type="date"
                  value={taxPaymentDate}
                  onChange={(e) => setTaxPaymentDate(e.target.value)}
                  className={input}
                />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => setUrgent(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            РЎСЂРѕС‡РЅР°СЏ Р·Р°РґР°С‡Р°
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">
              {error}
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            <X className="h-4 w-4" />
            РћС‚РјРµРЅР°
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {saving ? "РЎРѕС…СЂР°РЅРµРЅРёРµ..." : "РЎРѕС…СЂР°РЅРёС‚СЊ"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CalendarPlan({
  clients,
  canEditTax,
  executors,
  onSave,
}: {
  clients: CalendarClient[];
  canEditTax: boolean;
  executors: { id: string; name: string; specialization: string | null }[];
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState<{
    task: CalendarTask;
    clientName: string;
  } | null>(null);

  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [todayKey, setTodayKey] = useState("");

  // РќРµРґРµР»СЏ Рё В«СЃРµРіРѕРґРЅСЏВ» СЃС‡РёС‚Р°СЋС‚СЃСЏ РЅР° РєР»РёРµРЅС‚Рµ РїРѕСЃР»Рµ РјРѕРЅС‚РёСЂРѕРІР°РЅРёСЏ,
  // С‡С‚РѕР±С‹ СЃРµСЂРІРµСЂ Рё РєР»РёРµРЅС‚ РЅРµ СЂР°СЃС…РѕРґРёР»РёСЃСЊ РїСЂРё РіРёРґСЂР°С†РёРё
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTodayKey(dayKey(new Date()));
    setWeekStart((prev) => prev ?? startOfWeek(new Date()));
  }, []);

  // Р’СЃРµ 7 РґРЅРµР№ С‚РµРєСѓС‰РµР№ РЅРµРґРµР»Рё: СЂР°Р±РѕС‡РёРµ + РІС‹С…РѕРґРЅС‹Рµ
  const days = useMemo(
    () =>
      weekStart
        ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
        : [],
    [weekStart]
  );

  function isWeekend(d: Date): boolean {
    return d.getDay() === 0 || d.getDay() === 6;
  }

  const weekLabel = (() => {
    const two = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    return days.length === 7
      ? `${two(days[0])} вЂ“ ${two(days[6])}.${days[6].getFullYear()}`
      : "";
  })();

  // РС‚РѕРіРѕРІРѕРµ РІСЂРµРјСЏ (РјРёРЅ) РїРѕ РІСЃРµРј РєР»РёРµРЅС‚Р°Рј РґР»СЏ РєР°Р¶РґРѕР№ РґР°С‚С‹ РЅРµРґРµР»Рё (РїР»Р°РЅ Рё С„Р°РєС‚)
  const totalByDate = days.map((d) => {
    const k = dayKey(d);
    let plan = 0;
    let fact = 0;
    for (const c of clients) {
      for (const t of c.tasks) {
        if (t.date && dayKey(new Date(t.date)) === k) {
          plan += t.durationMinutes ?? 0;
          // С„Р°РєС‚ вЂ” РµСЃР»Рё РЅРµ РїСЂРѕРїРёСЃР°РЅ, Р±РµСЂС‘Рј РїР»Р°РЅ
          fact += t.factDurationMinutes ?? t.durationMinutes ?? 0;
        }
      }
    }
    return { plan, fact };
  });

  const hasAnyTime = totalByDate.some((s) => s.plan > 0 || s.fact > 0);

  // Р Р°Р·РјРµС‰РµРЅРёРµ Р·Р°РґР°С‡ РїРѕ СЃР»РѕС‚Р°Рј РґРЅСЏ: СЃ СѓРєР°Р·Р°РЅРЅС‹Рј РІСЂРµРјРµРЅРµРј вЂ” РІ СЃРІРѕР№ СЃР»РѕС‚,
  // Р±РµР· РІСЂРµРјРµРЅРё вЂ” РІ Р±Р»РёР¶Р°Р№С€РёР№ СЃРІРѕР±РѕРґРЅС‹Р№ СЃР»РѕС‚ РЅР°С‡РёРЅР°СЏ СЃ 10:00
  const buildDaySlots = useCallback(
    (key: string) => {
      const slots: { task: CalendarTask; clientName: string }[][] = Array.from(
        { length: TIME_SLOTS.length },
        () => []
      );
      const all: { task: CalendarTask; clientName: string }[] = [];
      for (const c of clients) {
        for (const t of c.tasks) {
          if (t.date && dayKey(new Date(t.date)) === key) {
            all.push({ task: t, clientName: c.name });
          }
        }
      }
      const withTime = all
        .filter((x) => x.task.startTime)
        .sort((a, b) =>
          (a.task.startTime ?? "").localeCompare(b.task.startTime ?? "")
        );
      const withoutTime = all.filter((x) => !x.task.startTime);
      for (const item of withTime) {
        slots[toSlotIndex(item.task.startTime)].push(item);
      }
      for (const item of withoutTime) {
        const free = slots.findIndex((s) => s.length === 0);
        if (free === -1) slots[slots.length - 1].push(item);
        else slots[free].push(item);
      }
      return slots;
    },
    [clients]
  );

  // РџСЂРµРґРІС‹С‡РёСЃР»РµРЅРЅС‹Рµ СЃР»РѕС‚С‹ РґР»СЏ РєР°Р¶РґРѕРіРѕ РґРЅСЏ РЅРµРґРµР»Рё
  const slotsByDay = useMemo(() => {
    const map: Record<
      string,
      { task: CalendarTask; clientName: string }[][]
    > = {};
    for (const d of days) {
      const k = dayKey(d);
      map[k] = buildDaySlots(k);
    }
    return map;
  }, [days, buildDaySlots]);

  // --- Drag-and-drop РєР°СЂС‚РѕС‡РµРє РјРµР¶РґСѓ РґРЅСЏРјРё ---
  // РњС‹С€СЊ вЂ” СЃСЂР°Р·Сѓ (РґРёСЃС‚Р°РЅС†РёСЏ 6px), С‚Р°С‡ вЂ” СЃ Р·Р°РґРµСЂР¶РєРѕР№ 250РјСЃ, С‡С‚РѕР±С‹ РІРµСЂС‚РёРєР°Р»СЊРЅС‹Р№
  // СЃРєСЂРѕР»Р» С‚Р°Р±Р»РёС†С‹ РЅРµ РїСЂРµРІСЂР°С‰Р°Р»СЃСЏ РІ РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ РєР°СЂС‚РѕС‡РєРё.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );
  const [activeDrag, setActiveDrag] = useState<{
    task: CalendarTask;
    clientName: string;
  } | null>(null);
  const [moveError, setMoveError] = useState("");
  // РљР»РёРє РїРѕСЃР»Рµ СЂРµР°Р»СЊРЅРѕРіРѕ РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёСЏ РіР°СЃРёРј, С‡С‚РѕР±С‹ РЅРµ РѕС‚РєСЂС‹РІР°Р»Р°СЃСЊ РјРѕРґР°Р»РєР°
  const dragActiveRef = useRef(false);
  const moveErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (moveErrorTimer.current) clearTimeout(moveErrorTimer.current);
    },
    []
  );

  function showMoveError(text: string) {
    setMoveError(text);
    if (moveErrorTimer.current) clearTimeout(moveErrorTimer.current);
    moveErrorTimer.current = setTimeout(() => setMoveError(""), 4000);
  }

  function handleDragStart(event: DragStartEvent) {
    dragActiveRef.current = true;
    const data = event.active.data.current as
      | { task: CalendarTask; clientName: string }
      | undefined;
    if (data) setActiveDrag({ task: data.task, clientName: data.clientName });
  }

  function clearDrag() {
    setActiveDrag(null);
    window.setTimeout(() => {
      dragActiveRef.current = false;
    }, 100);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const targetKey = over?.data.current?.dayKey as string | undefined;
    const src = active.data.current as
      | { task: CalendarTask; clientName: string }
      | undefined;
    clearDrag();
    if (!targetKey || !src) return;
    const curKey = src.task.date ? dayKey(new Date(src.task.date)) : "";
    if (curKey === targetKey) return; // Р±СЂРѕСЃРёР»Рё РІ С‚РѕС‚ Р¶Рµ РґРµРЅСЊ
    const targetDay = days.find((d) => dayKey(d) === targetKey);
    if (!targetDay) return;
    try {
      const iso = deadlineForDayIso(src.task.date, targetDay);
      // В«РўСЂРµР±РѕРІР°РЅРёРµ РР¤РќРЎВ» СЃС‚РѕРёС‚ РІ РєР°Р»РµРЅРґР°СЂРµ РїРѕ РѕРєРѕРЅС‡Р°С‚РµР»СЊРЅРѕРјСѓ СЃСЂРѕРєСѓ вЂ”
      // РїРµСЂРµРЅРѕСЃ РґРІРёРіР°РµС‚ РёРјРµРЅРЅРѕ РµРіРѕ, РёРЅР°С‡Рµ РєР°СЂС‚РѕС‡РєР° РІРµСЂРЅС‘С‚СЃСЏ РЅР° СЃС‚Р°СЂС‹Р№ РґРµРЅСЊ
      await onSave(
        src.task.id,
        src.task.taskType === "IFNS_DEMAND"
          ? { receiptDeadline: iso }
          : { deadline: iso }
      );
    } catch {
      showMoveError("РќРµ СѓРґР°Р»РѕСЃСЊ РїРµСЂРµРЅРµСЃС‚Рё РєР°СЂС‚РѕС‡РєСѓ");
    }
  }

  function handleDragCancel() {
    clearDrag();
  }

  function handleCardOpen(task: CalendarTask, clientName: string) {
    if (dragActiveRef.current) return;
    setEditing({ task, clientName });
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() =>
              setWeekStart(
                addDays(weekStart ?? startOfWeek(new Date()), -7)
              )
            }
            title="РџСЂРµРґС‹РґСѓС‰Р°СЏ РЅРµРґРµР»СЏ"
            className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            РЎРµРіРѕРґРЅСЏ
          </button>
          <button
            onClick={() =>
              setWeekStart(addDays(weekStart ?? startOfWeek(new Date()), 7))
            }
            title="РЎР»РµРґСѓСЋС‰Р°СЏ РЅРµРґРµР»СЏ"
            className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-2 text-sm font-semibold text-zinc-700">
            {weekLabel}
          </span>
        </div>
      </div>

      {moveError && (
        <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {moveError}
        </div>
      )}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
      <div className="h-full overflow-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full border-collapse">
          <colgroup>
            <col className="w-[44px] min-w-[44px]" />
            {days.map((d, i) => (
              <col
                key={i}
                className={isWeekend(d) ? "w-[44px] min-w-[44px]" : "min-w-[132px]"}
              />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="sticky left-0 z-20 w-[44px] min-w-[44px] border-b border-r border-zinc-200 bg-zinc-50 px-1 py-2 text-left text-xs font-semibold text-zinc-600">
                Р’СЂРµРјСЏ
              </th>
              {days.map((d, i) => {
                const current = dayKey(d) === todayKey;
                const we = isWeekend(d);
                return (
                  <th
                    key={i}
                    className={`border-b border-zinc-200 px-1 py-2 text-center ${
                      we ? "bg-zinc-100/70" : "bg-zinc-50"
                    }`}
                  >
                    <div
                      className={`text-xs font-semibold ${
                        current ? "text-blue-700" : "text-zinc-600"
                      }`}
                    >
                      {WEEKDAYS_SHORT[i % 7]}
                    </div>
                    <div className="text-[11px] font-normal text-zinc-500">
                      {formatDdMm(d)}
                    </div>
                  </th>
                );
              })}
            </tr>
            {hasAnyTime && (
              <tr>
                <th className="sticky left-0 z-20 border-b border-r border-zinc-200 bg-zinc-50 px-3 py-1 text-left text-[11px] font-medium text-zinc-500">
                  РћР±С‰РµРµ РІСЂРµРјСЏ
                </th>
                {totalByDate.map((s, i) => (
                  <td
                    key={i}
                    className="border-b border-zinc-200 bg-zinc-50 px-1 py-1 text-center text-[11px] font-semibold text-zinc-600"
                  >
                    {s.plan > 0 || s.fact > 0
                      ? `РџР»Р°РЅ: ${s.plan} В· Р¤Р°РєС‚: ${s.fact}`
                      : ""}
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {TIME_SLOTS.map((time, si) => (
              <tr key={time} className="align-top">
                <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-zinc-200 bg-zinc-50 px-1 py-2 text-xs font-medium text-zinc-600">
                  {time}
                </td>
                {days.map((d, i) => {
                  const k = dayKey(d);
                  const we = isWeekend(d);
                  const items = slotsByDay[k][si];
                  return (
                    <DaySlot
                      key={i}
                      id={`cell:${k}:${si}`}
                      dayKey={k}
                      weekend={we}
                    >
                      {items.map(({ task: t, clientName }) => (
                        <DraggableCard
                          key={t.id}
                          task={t}
                          clientName={clientName}
                          dimmed={activeDrag?.task.id === t.id}
                          onOpen={() => handleCardOpen(t, clientName)}
                        />
                      ))}
                    </DaySlot>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DragOverlay>
        {activeDrag ? (
          <div className="w-40 rounded bg-white px-2 py-1 text-[11px] shadow-xl ring-2 ring-blue-400">
            <div className="truncate font-medium">
              {TASK_TYPE_LABELS[activeDrag.task.taskType] ??
                activeDrag.task.taskType}
            </div>
            <div className="truncate text-zinc-600">
              {activeDrag.clientName}
            </div>
            <div className="line-clamp-2 text-zinc-800">
              {activeDrag.task.title}
            </div>
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>

      {editing && (
        <EditModal
          task={editing.task}
          clientName={editing.clientName}
          canEditTax={canEditTax}
          executors={executors}
          onClose={() => setEditing(null)}
          onSave={onSave}
        />
      )}
    </>
  );
}

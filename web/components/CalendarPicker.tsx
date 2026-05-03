"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import {
  bookedSlotSet,
  defaultConfig,
  dropPastSlots,
  generateSlotStrings,
  slotsForDate,
  toSlotStringInTZ,
  ymdLocal,
  type AvailabilityConfig,
} from "@/lib/calendar";

const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

interface SlotEntry {
  time: string;
  booked: boolean;
}

export interface CalendarPickerProps {
  selectedDate: Date | null;
  selectedSlot: string | null;
  onSelectDate: (d: Date) => void;
  onSelectSlot: (s: string) => void;
  timezone?: string;
}

export function CalendarPicker(props: CalendarPickerProps) {
  const {
    selectedDate,
    selectedSlot,
    onSelectDate,
    onSelectSlot,
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  } = props;

  const [view, setView] = React.useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [config, setConfig] = React.useState<AvailabilityConfig | null>(null);
  const [slots, setSlots] = React.useState<SlotEntry[]>([]);
  const [slotsLoading, setSlotsLoading] = React.useState(false);

  // Fetch config once.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/availability")
      .then((r) => r.ok ? r.json() : defaultConfig)
      .then((d) => { if (!cancelled) setConfig(d); })
      .catch(() => { if (!cancelled) setConfig(defaultConfig); });
    return () => { cancelled = true; };
  }, []);

  // Fetch slots whenever the user picks a new date.
  React.useEffect(() => {
    if (!selectedDate || !config) { setSlots([]); return; }
    let cancelled = false;
    setSlotsLoading(true);
    const ymd = ymdLocal(selectedDate);

    (async () => {
      try {
        const r = await fetch(`/api/availability?date=${ymd}`);
        const data = r.ok ? await r.json() : { booked: [] };
        if (cancelled) return;

        let times = slotsForDate(selectedDate, config);
        times = dropPastSlots(times, selectedDate, 30);
        const taken = bookedSlotSet(Array.isArray(data.booked) ? data.booked : [], selectedDate, timezone);
        const out: SlotEntry[] = times.map((t) => ({ time: t, booked: taken.has(t) }));
        setSlots(out);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedDate, config, timezone]);

  const monthLabel = view.toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const dayCells: (Date | null)[] = [];
  for (let i = 0; i < firstOfMonth.getDay(); i++) dayCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    dayCells.push(new Date(view.getFullYear(), view.getMonth(), d));
  }

  const slotsLabel = selectedDate
    ? selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    : "Pick a date";

  return (
    <div className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-7">
      {/* Header */}
      <div className="flex items-center gap-3.5 pb-4 mb-4 border-b border-line">
        <div className="w-12 h-12 rounded-[10px] bg-white p-1.5 grid place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="w-full h-full object-contain" />
        </div>
        <div>
          <h3 className="text-[17px] font-semibold tracking-tight m-0">30-min discovery call</h3>
          <div className="text-text-2 text-[13px] mt-0.5 flex gap-3">
            <span>⏱ 30 min</span>
            <span>● Google Meet</span>
          </div>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex justify-between items-center mb-3.5">
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          className="bg-bg-2 border border-line-2 text-text-1 w-8 h-8 rounded-lg grid place-items-center hover:bg-bg-3 hover:text-text-0"
          aria-label="Previous month"
        >‹</button>
        <div className="font-semibold text-[15px]">{monthLabel}</div>
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          className="bg-bg-2 border border-line-2 text-text-1 w-8 h-8 rounded-lg grid place-items-center hover:bg-bg-3 hover:text-text-0"
          aria-label="Next month"
        >›</button>
      </div>

      {/* DOW labels */}
      <div className="grid grid-cols-7 gap-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="text-center font-mono text-[10px] text-text-3 uppercase tracking-[0.08em] py-1.5">{d}</div>
        ))}
        {dayCells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const dow = date.getDay();
          const past = date < today;
          const has = !past && dow >= 1 && dow <= 5;
          const isSelected = selectedDate && ymdLocal(selectedDate) === ymdLocal(date);
          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={!has}
              onClick={() => has && onSelectDate(date)}
              className={cn(
                "aspect-square rounded-lg grid place-items-center text-[13.5px] font-variant-numeric tabular-nums",
                "border border-transparent transition-all duration-150",
                has && !isSelected && "text-blue-2 font-semibold bg-blue/[0.06] border-blue/25 hover:bg-blue/[0.14] cursor-pointer",
                isSelected && "bg-gradient-to-b from-orange-2 to-orange text-[#1a0e05] border-transparent font-bold",
                !has && "text-text-3 opacity-40 cursor-default",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Slots */}
      <div className="mt-4 pt-4 border-t border-line">
        <h4 className="m-0 mb-3 text-[13px] font-semibold text-text-1">{slotsLabel}</h4>
        {!selectedDate ? (
          <div className="text-text-3 text-[13.5px] py-5 text-center">Select a date with availability to see open times.</div>
        ) : slotsLoading ? (
          <div className="text-text-3 text-[13.5px] py-5 text-center">Loading…</div>
        ) : slots.length === 0 ? (
          <div className="text-text-3 text-[13.5px] py-5 text-center">No slots available — try another date.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {slots.map(({ time, booked }) => {
              const isSelected = selectedSlot === time;
              return (
                <button
                  key={time}
                  type="button"
                  disabled={booked}
                  aria-disabled={booked}
                  title={booked ? "Already booked" : undefined}
                  onClick={() => !booked && onSelectSlot(time)}
                  className={cn(
                    "py-2.5 px-3 rounded-lg font-mono font-medium text-[13.5px] text-center transition-all duration-150",
                    !booked && !isSelected && "bg-bg-2 border border-line-2 text-text-0 hover:border-blue hover:text-blue-2 hover:bg-blue/[0.06] cursor-pointer",
                    isSelected && "bg-gradient-to-b from-blue-2 to-blue text-white border border-transparent",
                    booked && "bg-transparent border border-line text-text-3 line-through decoration-bad/50 cursor-not-allowed opacity-55 font-normal",
                  )}
                >
                  {time}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-line text-[12px] text-text-3 leading-relaxed">
        All times in your local timezone. The call lands on Google Meet — invite hits your inbox once you submit.
      </div>
    </div>
  );
}

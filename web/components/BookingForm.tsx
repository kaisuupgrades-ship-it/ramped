"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Input, Textarea } from "@/components/ui/core";
import { Button } from "@/components/ui/Button";
import { CalendarPicker } from "@/components/CalendarPicker";
import { combineDateAndSlot } from "@/lib/calendar";
import { bookingFormSchema, type BookingFormData } from "@/lib/schemas/booking";

export interface BookingFormProps {
  tier?: "starter" | "growth" | "enterprise";
  billing?: "monthly" | "annual";
}

export function BookingForm({ tier, billing }: BookingFormProps) {
  const router = useRouter();
  const tz = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingFormData>({ resolver: zodResolver(bookingFormSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    if (!selectedDate || !selectedSlot) {
      setError("Please pick a date and time on the calendar.");
      return;
    }
    setSubmitting(true);
    try {
      const datetime = combineDateAndSlot(selectedDate, selectedSlot);
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          notes: values.notes ?? "",
          datetime,
          timezone: tz,
          ...(tier ? { tier } : {}),
          ...(billing ? { billing } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Booking failed");

      const params = new URLSearchParams({
        date: selectedDate.toISOString().slice(0, 10),
        slot: selectedSlot,
      });
      if (body.booking_id) {
        params.set("booking_id", body.booking_id);
        if (tier) params.set("tier", tier);
        if (billing) params.set("billing", billing);
        router.push(`/questionnaire?${params.toString()}`);
      } else {
        params.set("intent", "booking");
        router.push(`/thanks?${params.toString()}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Email jon@30dayramp.com.");
      setSubmitting(false);
    }
  });

  const summary = selectedSlot && selectedDate
    ? `${selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${selectedSlot} · 30 min · Google Meet`
    : selectedDate
      ? `${selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · select a time →`
      : "No time selected yet — pick one on the right →";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 items-start">
      {/* Form */}
      <form onSubmit={onSubmit} className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-8" noValidate>
        <h2 className="m-0 mb-1.5 text-[22px] font-semibold tracking-tight">Your details</h2>
        <p className="m-0 mb-5 text-text-2 text-sm leading-relaxed">
          Just the essentials — we&apos;ll send a 2-minute prep questionnaire after you book if you want to dig deeper.
        </p>

        <Field label="Full name" error={errors.name?.message}>
          <Input placeholder="Jane Doe" autoComplete="name" {...register("name")} />
        </Field>
        <Field label="Work email" error={errors.email?.message}>
          <Input type="email" placeholder="jane@company.com" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Company" error={errors.company?.message}>
          <Input placeholder="Acme Logistics" autoComplete="organization" {...register("company")} />
        </Field>
        <Field label={<>Anything we should know? <span className="text-text-3 font-normal normal-case">(optional)</span></>}>
          <Textarea
            rows={3}
            placeholder="What you're trying to fix, what you've already tried, anything that would change how we'd approach the call…"
            {...register("notes")}
          />
        </Field>

        <div className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl my-2 ${selectedSlot ? "bg-orange/[0.04] border-orange/35" : "bg-bg-2 border-line"} border text-[14px] leading-relaxed text-text-2`}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span dangerouslySetInnerHTML={{ __html: summary
            .replace(/^([A-Z][a-z]+, [A-Z][a-z]+ \d+)/, '<strong style="color:var(--color-text-0)">$1</strong>')
            .replace(/at (\d+:\d+ [AP]M)/, 'at <strong style="color:var(--color-orange-2)">$1</strong>')
          }} />
        </div>

        {error && (
          <div className="my-2 px-3.5 py-2.5 rounded-xl bg-bad/10 border border-bad/40 text-bad text-[13.5px]">{error}</div>
        )}

        <Button type="submit" size="lg" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Booking…" : "Book the call →"}
        </Button>

        <div className="mt-3.5 flex items-center justify-center gap-2.5 flex-wrap font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
          <span>30 min</span><span>·</span><span>Google Meet</span><span>·</span><span>30-day go-live guarantee</span>
        </div>
      </form>

      {/* Calendar */}
      <div className="lg:sticky lg:top-[120px]">
        <CalendarPicker
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          onSelectDate={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
          onSelectSlot={setSelectedSlot}
          timezone={tz}
        />
      </div>
    </div>
  );
}

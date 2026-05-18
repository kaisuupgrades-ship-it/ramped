"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Input, Textarea } from "@/components/ui/core";
import { Button } from "@/components/ui/Button";
import { CalendarPicker } from "@/components/CalendarPicker";
import { QuestionnaireForm } from "@/components/QuestionnaireForm";
import { combineDateAndSlot } from "@/lib/calendar";
import { bookingFormSchema, type BookingFormData } from "@/lib/schemas/booking";

export interface BookingFormProps {
  tier?: "starter" | "growth" | "enterprise";
  billing?: "monthly" | "annual";
}

type Phase =
  | { kind: "form" }
  | { kind: "confirmed"; bookingId?: string; meetLink?: string; email: string; date: Date; slot: string; questionnaireState: "open" | "skipped" | "submitted" };

export function BookingForm({ tier, billing }: BookingFormProps) {
  const tz = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>({ kind: "form" });

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

      setPhase({
        kind: "confirmed",
        bookingId: body.booking_id,
        meetLink: body.meet_link ?? undefined,
        email: values.email,
        date: selectedDate,
        slot: selectedSlot,
        questionnaireState: "open",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Email jon@30dayramp.com.");
      setSubmitting(false);
    }
  });

  if (phase.kind === "confirmed") {
    return <ConfirmationPanel phase={phase} onQuestionnaireDone={(intent) => setPhase((p) => p.kind === "confirmed" ? { ...p, questionnaireState: intent } : p)} />;
  }

  const summary = selectedSlot && selectedDate
    ? `${selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${selectedSlot} · 30 min · Google Meet`
    : selectedDate
      ? `${selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · select a time →`
      : "No time selected yet — pick one on the right →";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 items-start">
      {/* Form column */}
      <div className="flex flex-col gap-5">
        {/* "What we'll cover" + guarantee — restored from legacy left panel.
            Lives above the form so it's the first thing readers see. */}
        <CoverageAndGuarantee />

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
          <Field label={<>Company website <span className="text-text-3 font-normal normal-case">(optional — helps us prep)</span></>} error={errors.company_url?.message}>
            <Input
              type="url"
              placeholder="https://acmelogistics.com"
              autoComplete="url"
              {...register("company_url")}
            />
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
      </div>

      {/* Calendar column */}
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

/** "What we'll cover" checklist + 30-day go-live guarantee badge.
 *  Content matches the legacy book.html left panel — visual styling is V4. */
function CoverageAndGuarantee() {
  const items = [
    "Where AI can save you 10+ hours/week right now",
    "Which workflows to automate first for fastest ROI",
    "What a 30-day implementation looks like for your business",
    "Honest assessment — if it's not a fit, we'll tell you",
  ];
  return (
    <div className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-7">
      <p className="m-0 mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">What we&apos;ll cover</p>
      <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-text-1">
            <svg viewBox="0 0 20 20" width={16} height={16} className="text-blue-2 flex-shrink-0 mt-1" aria-hidden="true">
              <path fill="currentColor" d="M7.629 14.571 3.4 10.343l1.414-1.414 2.815 2.814 7.142-7.143 1.414 1.415z" />
            </svg>
            <span>{it}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-start gap-2.5 px-4 py-3.5 bg-bg-2 border border-line rounded-xl">
        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden="true">
          <path d="M7 1L2 3.5v4C2 10.1 4.2 12.6 7 13.5c2.8-.9 5-3.4 5-6V3.5L7 1z" fill="#F59E0B" opacity=".3" stroke="#F59E0B" strokeWidth="1.2" />
        </svg>
        <div>
          <p className="m-0 text-[13px] font-semibold text-text-0">30-day go-live guarantee</p>
          <p className="m-0 mt-0.5 text-[12px] text-text-2 leading-relaxed">If your AI agent isn&apos;t live in 30 days, you get a full refund. No questions, no partial payments, no fine print.</p>
        </div>
      </div>
    </div>
  );
}

/** Renders the post-booking confirmation card + inline questionnaire.
 *  When the questionnaire is submitted or skipped, swaps the questionnaire
 *  area for a "you're all set" footer. */
function ConfirmationPanel({
  phase,
  onQuestionnaireDone,
}: {
  phase: Extract<Phase, { kind: "confirmed" }>;
  onQuestionnaireDone: (intent: "submitted" | "skipped") => void;
}) {
  const friendly = phase.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Confirmation card */}
      <div className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-9">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue/10 border border-blue/30 grid place-items-center flex-shrink-0">
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-blue-2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">You&apos;re booked</p>
            <h2 className="m-0 mt-1 text-[24px] font-semibold tracking-tight leading-tight">
              See you on <span className="text-text-0">{friendly}</span> at <span className="gradient-text">{phase.slot}</span>.
            </h2>
            <p className="m-0 mt-2.5 text-[14px] text-text-2 leading-relaxed">
              A calendar invite with the Google Meet link is on its way to <strong className="text-text-1">{phase.email}</strong>.
              {phase.meetLink && (
                <> You can also join directly: <a href={phase.meetLink} target="_blank" rel="noopener noreferrer" className="text-blue-2 underline-offset-2 hover:underline">Open Google Meet ↗</a>.</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Questionnaire (or "all set" footer once submitted/skipped).
          If the booking lacked an id (env-vars-missing-on-preview, race, etc.)
          we can't submit the questionnaire inline — show the "we'll email a
          link" panel so the user isn't trapped in a 400 loop. */}
      {phase.questionnaireState === "open" && phase.bookingId ? (
        <>
          <div className="text-center">
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">One more thing — optional</p>
            <h3 className="m-0 mt-1.5 text-[20px] font-semibold tracking-tight">Help us prep before the call.</h3>
            <p className="m-0 mt-1.5 text-[14px] text-text-2 leading-relaxed max-w-xl mx-auto">
              A 2-minute questionnaire so Andrew can build a custom automation map before you hop on. Skip if you&apos;d rather just chat.
            </p>
          </div>
          <QuestionnaireForm
            bookingId={phase.bookingId}
            email={phase.email}
            onComplete={onQuestionnaireDone}
          />
        </>
      ) : (
        <DonePanel intent={phase.questionnaireState === "submitted" ? "submitted" : "skipped"} email={phase.email} />
      )}

      <p className="text-center text-[12.5px] text-text-3">
        Need to reschedule? Email <a href="mailto:jon@30dayramp.com" className="text-text-1 hover:text-text-0 underline-offset-2 hover:underline">jon@30dayramp.com</a> — we&apos;ll move things around.
      </p>
      <p className="text-center text-[11px] font-mono uppercase tracking-[0.08em] text-text-3">
        Times shown in {tz.replace(/_/g, " ")}
      </p>
    </div>
  );
}

function DonePanel({ intent, email }: { intent: "submitted" | "skipped"; email: string }) {
  const isSubmitted = intent === "submitted";
  return (
    <div className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-7 text-center">
      <p className="m-0 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">{isSubmitted ? "All done" : "No problem"}</p>
      <h3 className="m-0 mt-1.5 text-[20px] font-semibold tracking-tight">
        {isSubmitted ? "Your automation map is being built." : "We'll email you a link to fill it out later."}
      </h3>
      <p className="m-0 mt-2 text-[14px] text-text-2 leading-relaxed">
        {isSubmitted
          ? <>We&apos;ll email a copy to <strong className="text-text-1">{email}</strong> in the next minute or two.</>
          : <>Check <strong className="text-text-1">{email}</strong> — we just sent the prep questionnaire as a link you can fill out anytime before the call.</>}
      </p>
    </div>
  );
}

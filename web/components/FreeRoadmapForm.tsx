"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Input } from "@/components/ui/core";
import { Button } from "@/components/ui/Button";
import { QuestionnaireForm } from "@/components/QuestionnaireForm";
import { freeRoadmapFormSchema, type FreeRoadmapFormData } from "@/lib/schemas/free-roadmap";

/**
 * Free-roadmap flow — three phases:
 *   1. "intake"          — name + email + company (this component)
 *   2. "questionnaire"   — same 11-question QuestionnaireForm as the booking
 *                          flow, in free-roadmap mode (POSTs to /api/free-roadmap)
 *   3. "done"            — confirmation panel saying the roadmap is on the way
 *
 * Same questionnaire as the booking funnel by design — produces the same
 * Anthropic-graded automation roadmap, just without a calendar booking.
 */

type Phase =
  | { kind: "intake" }
  | { kind: "questionnaire"; lead: FreeRoadmapFormData }
  | { kind: "done"; lead: FreeRoadmapFormData; intent: "submitted" | "skipped" };

export function FreeRoadmapForm() {
  const [phase, setPhase] = React.useState<Phase>({ kind: "intake" });

  const { register, handleSubmit, formState: { errors } } = useForm<FreeRoadmapFormData>({
    resolver: zodResolver(freeRoadmapFormSchema),
  });

  const onIntakeSubmit = handleSubmit((values) => {
    setPhase({ kind: "questionnaire", lead: values });
  });

  if (phase.kind === "questionnaire") {
    return (
      <div className="flex flex-col gap-5">
        {/* Tiny "you're {name}" banner so the user sees their intake stuck */}
        <div className="bg-bg-2 border border-line rounded-xl px-4 py-3 text-[13px] text-text-2 flex items-center justify-between gap-3 flex-wrap">
          <span>
            For <span className="text-text-0 font-semibold">{phase.lead.name}</span> at{" "}
            <span className="text-text-0 font-semibold">{phase.lead.company}</span> · we&apos;ll email it to{" "}
            <span className="text-text-1">{phase.lead.email}</span>
          </span>
          <button
            type="button"
            onClick={() => setPhase({ kind: "intake" })}
            className="text-text-3 text-[12.5px] hover:text-text-1 underline-offset-2 hover:underline"
          >
            Edit
          </button>
        </div>

        <QuestionnaireForm
          mode="free-roadmap"
          leadIntake={phase.lead}
          email={phase.lead.email}
          onComplete={(intent) => setPhase({ kind: "done", lead: phase.lead, intent })}
        />
      </div>
    );
  }

  if (phase.kind === "done") {
    const isSubmitted = phase.intent === "submitted";
    return (
      <div className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-9 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue/10 border border-blue/30 grid place-items-center mx-auto mb-5">
          <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-blue-2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="m-0 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
          {isSubmitted ? "All done" : "We've got your details"}
        </p>
        <h2 className="m-0 mt-1.5 text-[22px] font-semibold tracking-tight">
          {isSubmitted ? "Your roadmap is being built." : "We'll send your roadmap shortly."}
        </h2>
        <p className="m-0 mt-2.5 text-[14.5px] text-text-2 leading-relaxed max-w-md mx-auto">
          {isSubmitted ? (
            <>We&apos;ll email a copy to <strong className="text-text-1">{phase.lead.email}</strong> in the next minute or two — Claude is reading your responses and writing your custom roadmap right now.</>
          ) : (
            <>You skipped the questionnaire, so we&apos;ll send a generic-but-useful roadmap to <strong className="text-text-1">{phase.lead.email}</strong> within 24 hours.</>
          )}
        </p>
        <div className="mt-6 pt-5 border-t border-line text-[13px] text-text-2">
          Want to walk through it live instead?{" "}
          <a href="/book" className="text-orange-2 font-semibold hover:underline">Book a 30-min call →</a>
        </div>
      </div>
    );
  }

  // phase === "intake"
  return (
    <form
      onSubmit={onIntakeSubmit}
      className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-8"
      noValidate
    >
      <p className="m-0 mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">Step 1 of 2</p>
      <h2 className="m-0 mb-1.5 text-[22px] font-semibold tracking-tight">Where should we send it?</h2>
      <p className="m-0 mb-5 text-text-2 text-sm leading-relaxed">
        Just the basics. Next we&apos;ll ask 11 quick questions about your business — Claude uses your answers to build a roadmap tailored to your stack.
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

      <Button type="submit" size="lg" variant="primary" className="w-full mt-2">
        Continue to the questionnaire →
      </Button>
      <div className="mt-3 text-[12.5px] text-text-3 text-center">
        Free. No spam. Roadmap delivered in under 60 seconds.
      </div>
    </form>
  );
}

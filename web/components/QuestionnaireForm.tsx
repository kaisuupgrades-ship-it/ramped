"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Pill, Textarea, Input } from "@/components/ui/core";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { integrations } from "@/lib/integrations";
import {
  budgetBands, hoursLost, industries, painPoints, priorAttempts, revenueBands, roles, teamSizes,
} from "@/lib/pain-points";

interface FormState {
  business: string;
  revenue: string;
  team: string;
  pain: string[];
  hours: string;
  stack: string[];
  stack_other: string;
  prior: string;
  prior_notes: string;
  success: string;
  budget: string;
  notes: string;
}

const initial: FormState = {
  business: "", revenue: "", team: "", pain: [], hours: "",
  stack: [], stack_other: "", prior: "", prior_notes: "",
  success: "", budget: "", notes: "",
};

const TOTAL = 11;

export function QuestionnaireForm() {
  const router = useRouter();
  const params = useSearchParams();
  const bookingId = params.get("booking_id") ?? "";
  const email = params.get("email") ?? "";

  // If they got here without a booking_id, send back to /book
  React.useEffect(() => {
    if (!bookingId && !email) router.replace("/book");
  }, [bookingId, email, router]);

  const [step, setStep] = React.useState(1);
  const [state, setState] = React.useState<FormState>(initial);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const toggle = (key: "pain" | "stack", value: string) =>
    setState((s) => ({
      ...s,
      [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value],
    }));

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const stackJoined = [...state.stack, ...(state.stack_other.trim() ? [state.stack_other.trim()] : [])].join(", ");
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          email: email || undefined,
          business_description: state.business,
          revenue: state.revenue,
          team_size: state.team,
          pain_points: state.pain,
          hours_lost: state.hours,
          stack: stackJoined,
          prior_attempts: state.prior,
          prior_notes: state.prior_notes,
          success_definition: state.success,
          budget: state.budget,
          notes: state.notes,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Submission failed");
      }
      router.push("/thanks?intent=questionnaire");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const next = () => (step >= TOTAL ? submit() : setStep(step + 1));
  const skip = () => (step >= TOTAL ? submit() : setStep(step + 1));
  const back = () => setStep(Math.max(1, step - 1));

  return (
    <div className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-9">
      {/* Stepper */}
      <div className="flex items-center gap-2.5 mb-7 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
        <span>Question {step} / {TOTAL}</span>
        <div className="flex-1 h-[3px] rounded-full bg-bg-3 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue to-orange rounded-full transition-[width] duration-300"
            style={{ width: `${(step / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      {step === 1 && (
        <Step title="What does your business do?" sub="A sentence or two — the kind of pitch you'd give at a dinner party.">
          <Textarea rows={4} value={state.business} onChange={(e) => setField("business", e.target.value)} placeholder="We sell industrial equipment to mid-sized contractors across the US…" />
        </Step>
      )}
      {step === 2 && (
        <Step title="What's your annual revenue?">
          <PillRow values={revenueBands} selected={state.revenue} onSelect={(v) => setField("revenue", v)} />
        </Step>
      )}
      {step === 3 && (
        <Step title="How many people on the team?">
          <PillRow values={teamSizes} selected={state.team} onSelect={(v) => setField("team", v)} />
        </Step>
      )}
      {step === 4 && (
        <Step title="What workflows eat the most time?" sub="Pick all that apply.">
          <div className="flex flex-wrap gap-2">
            {painPoints.map((p) => (
              <Pill key={p.value} active={state.pain.includes(p.value)} onClick={() => toggle("pain", p.value)}>
                {p.label}
              </Pill>
            ))}
          </div>
        </Step>
      )}
      {step === 5 && (
        <Step title="How many hours per week does that cost the team?">
          <PillRow values={hoursLost} selected={state.hours} onSelect={(v) => setField("hours", v)} />
        </Step>
      )}
      {step === 6 && (
        <Step title="What tools are you running on?" sub="Pick all that apply — helps us pre-scope the integration work.">
          <div className="flex flex-wrap gap-2">
            {integrations.map((i) => (
              <Pill key={i.name} active={state.stack.includes(i.name)} onClick={() => toggle("stack", i.name)} className="pl-2.5">
                <BrandLogo integration={i} size={16} />
                {i.name}
              </Pill>
            ))}
          </div>
          <div className="mt-3.5">
            <Textarea
              rows={2}
              value={state.stack_other}
              onChange={(e) => setField("stack_other", e.target.value)}
              placeholder="Anything else? Custom tools, internal portals, ERPs we missed…"
            />
          </div>
        </Step>
      )}
      {step === 7 && (
        <Step title="Have you tried automating this before?">
          <PillRow values={priorAttempts} selected={state.prior} onSelect={(v) => setField("prior", v)} />
        </Step>
      )}
      {step === 8 && (
        <Step title="What worked? What didn't?" sub="Skip if not applicable.">
          <Textarea rows={4} value={state.prior_notes} onChange={(e) => setField("prior_notes", e.target.value)} placeholder="Zapier got us 60% of the way but kept breaking on edge cases…" />
        </Step>
      )}
      {step === 9 && (
        <Step title="If we get this right, what changes?" sub="What does success look like in 90 days?">
          <Textarea rows={4} value={state.success} onChange={(e) => setField("success", e.target.value)} placeholder="My ops lead stops working weekends. We respond to leads in under an hour." />
        </Step>
      )}
      {step === 10 && (
        <Step title="What's the budget reality?">
          <PillRow values={budgetBands} selected={state.budget} onSelect={(v) => setField("budget", v)} />
        </Step>
      )}
      {step === 11 && (
        <Step title="Anything else we should know?" sub="Optional — anything that would change how we'd run the call.">
          <Textarea rows={5} value={state.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Constraints, deadlines, internal politics, related projects, etc." />
        </Step>
      )}

      {error && <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-bad/10 border border-bad/40 text-bad text-[13.5px]">{error}</div>}

      {/* Actions */}
      <div className="flex justify-between gap-2.5 mt-7 pt-4 border-t border-line items-center">
        <Button variant="ghost" onClick={back} disabled={step === 1}>← Back</Button>
        <button type="button" onClick={skip} className="text-text-3 text-[13px] hover:text-text-1">Skip this question →</button>
        <Button variant="primary" onClick={next} disabled={submitting}>
          {step === TOTAL ? (submitting ? "Submitting…" : "Submit →") : "Continue →"}
        </Button>
      </div>
    </div>
  );
}

function Step({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="m-0 mb-1.5 text-2xl font-semibold tracking-tight leading-tight">{title}</h2>
      {sub && <p className="m-0 mb-5 text-text-2 text-[14.5px] leading-relaxed">{sub}</p>}
      {children}
    </div>
  );
}

function PillRow({ values, selected, onSelect }: { values: readonly string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <Pill key={v} active={selected === v} onClick={() => onSelect(v)}>{v}</Pill>
      ))}
    </div>
  );
}

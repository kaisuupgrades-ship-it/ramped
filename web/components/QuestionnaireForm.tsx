"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Pill, Textarea, Input } from "@/components/ui/core";
import { FIELDS, TOTAL_QUESTIONS, type Field as SchemaField, type FieldOption } from "@/lib/questionnaire-fields";

/**
 * Schema-driven questionnaire form. The FIELDS module is the single source of
 * truth for both this form and the API prompt builder — renaming a field
 * updates both at once.
 */

type FormState = Record<string, string | string[]>;

const GEN_STAGES: ReadonlyArray<readonly [number, string, number]> = [
  [0,  "Reading your responses…",                    8],
  [6,  "Mapping your stack to integration points…",  22],
  [14, "Identifying highest-leverage workflows…",    40],
  [26, "Drafting your 30-day deployment plan…",      58],
  [40, "Estimating ROI in dollars and hours…",       74],
  [55, "Polishing the final document…",              88],
  [75, "Almost there — just a few more seconds…",    96],
];

function brandIconUrl(opt: FieldOption): string | null {
  if (!opt.icon) return null;
  return opt.color
    ? `https://cdn.simpleicons.org/${opt.icon}/${opt.color.replace("#", "")}`
    : `https://cdn.simpleicons.org/${opt.icon}`;
}

export function QuestionnaireForm() {
  const router = useRouter();
  const params = useSearchParams();
  const bookingId = params.get("booking_id") ?? "";
  const email = params.get("email") ?? "";

  React.useEffect(() => {
    if (!bookingId && !email) router.replace("/book");
  }, [bookingId, email, router]);

  // initialize each field with the right empty type
  const initial: FormState = React.useMemo(() => {
    const s: FormState = {};
    for (const f of FIELDS) {
      s[f.id] = (f.type === "checkbox_pills" || f.type === "brand_pills") ? [] : "";
      if (f.otherField) s[f.otherField.id] = "";
    }
    return s;
  }, []);

  const [state, setState] = React.useState<FormState>(initial);
  const [step, setStep]   = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [genStage, setGenStage] = React.useState(GEN_STAGES[0]);
  const [genElapsed, setGenElapsed] = React.useState(0);

  const setSingle = (id: string, v: string) => setState((s) => ({ ...s, [id]: v }));
  const toggle = (id: string, v: string) =>
    setState((s) => {
      const arr = (s[id] as string[]) ?? [];
      return { ...s, [id]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });

  // Tick the generating-state animation while /api/questionnaire runs.
  React.useEffect(() => {
    if (!generating) return;
    const start = Date.now();
    setGenElapsed(0);
    const tick = setInterval(() => {
      const t = (Date.now() - start) / 1000;
      setGenElapsed(t);
      let stage = GEN_STAGES[0];
      for (const s of GEN_STAGES) if (t >= s[0]) stage = s;
      setGenStage(stage);
    }, 1000);
    return () => clearInterval(tick);
  }, [generating]);

  async function submit() {
    setError(null);
    setSubmitting(true);
    setGenerating(true);
    try {
      const payload: Record<string, unknown> = { booking_id: bookingId, email: email || undefined };
      for (const f of FIELDS) {
        payload[f.id] = state[f.id];
        if (f.otherField && state[f.otherField.id]) payload[f.otherField.id] = state[f.otherField.id];
      }
      const r = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Submission failed");
      }
      // pin progress + redirect
      setGenStage([100, "Done. Redirecting…", 100]);
      setTimeout(() => router.push("/thanks?intent=questionnaire"), 600);
    } catch (e) {
      setGenerating(false);
      setSubmitting(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  const next = () => (step >= TOTAL_QUESTIONS ? submit() : setStep((s) => s + 1));
  const skip = () => (step >= TOTAL_QUESTIONS ? submit() : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  // Generating panel
  if (generating) {
    const remaining = Math.max(0, Math.round(75 - genElapsed));
    const eta = remaining > 5 ? `~${remaining} seconds remaining` : "Wrapping up…";
    return (
      <div className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-9" aria-live="polite">
        <div className="relative w-20 h-20 rounded-2xl bg-blue/10 border border-blue/30 grid place-items-center mx-auto mb-5">
          <span className="absolute inset-[-4px] rounded-3xl border-2 border-blue-2 opacity-0 animate-[gen-ring_2.4s_ease-out_infinite]" aria-hidden="true" />
          <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-blue-2">
            <path d="M9.663 17h4.673M12 3v1M5.6 5.6l.7.7M3 12h1M20 12h1M18.4 5.6l-.7.7M8 14a4 4 0 1 1 8 0c0 1.5-.5 2-1 3h-6c-.5-1-1-1.5-1-3z" />
          </svg>
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight m-0">Generating your <span className="gradient-text">automation map.</span></h2>
        <p className="mx-auto mt-2.5 text-center text-text-2 text-[14.5px] leading-relaxed max-w-lg">
          Claude is reading your responses and mapping the highest-leverage workflows we&apos;d build for you. This usually takes <strong className="text-text-1">30 to 60 seconds</strong>.
        </p>
        <div className="mt-5 mx-auto max-w-lg flex items-center justify-center gap-2.5 bg-bg-2 border border-line rounded-xl py-3.5 px-4 font-mono text-[13px]">
          <span className="w-2 h-2 rounded-full bg-blue animate-pulse shrink-0" />
          <span className="text-text-1">{genStage[1]}</span>
        </div>
        <div className="mt-4 mx-auto max-w-lg h-1 rounded-full bg-bg-3 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-blue to-orange transition-[width] duration-700" style={{ width: `${genStage[2]}%` }} />
        </div>
        <div className="mt-3.5 text-center font-mono text-[12.5px] uppercase tracking-[0.06em] text-text-3">{eta}</div>
        <div className="mt-7 pt-5 border-t border-line text-center text-[12.5px] text-text-3 leading-relaxed max-w-md mx-auto">
          Don&apos;t refresh or close this tab — we&apos;ll redirect you the moment your map is ready and a copy is sent to your email.
        </div>
        <style>{`@keyframes gen-ring { 0% { opacity: 0.6; transform: scale(0.92); } 100% { opacity: 0; transform: scale(1.18); } }`}</style>
      </div>
    );
  }

  const f = FIELDS[step - 1];

  return (
    <div className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-9">
      {/* Stepper */}
      <div className="flex items-center gap-2.5 mb-7 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
        <span>Question {step} / {TOTAL_QUESTIONS}</span>
        <div className="flex-1 h-[3px] rounded-full bg-bg-3 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue to-orange rounded-full transition-[width] duration-300"
            style={{ width: `${(step / TOTAL_QUESTIONS) * 100}%` }}
          />
        </div>
      </div>

      <h2 className="m-0 mb-1.5 text-2xl font-semibold tracking-tight leading-tight">{f.title}</h2>
      {f.sub && <p className="m-0 mb-5 text-text-2 text-[14.5px] leading-relaxed">{f.sub}</p>}

      <FieldRender field={f} state={state} setSingle={setSingle} toggle={toggle} setOther={(id, v) => setState((s) => ({ ...s, [id]: v }))} />

      {error && <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-bad/10 border border-bad/40 text-bad text-[13.5px]">{error}</div>}

      <div className="flex justify-between gap-2.5 mt-7 pt-4 border-t border-line items-center">
        <Button variant="ghost" onClick={back} disabled={step === 1}>← Back</Button>
        <button type="button" onClick={skip} className="text-text-3 text-[13px] hover:text-text-1">Skip this question →</button>
        <Button variant="primary" onClick={next} disabled={submitting}>
          {step === TOTAL_QUESTIONS ? (submitting ? "Submitting…" : "Submit →") : "Continue →"}
        </Button>
      </div>
    </div>
  );
}

function FieldRender({
  field, state, setSingle, toggle, setOther,
}: {
  field: SchemaField;
  state: FormState;
  setSingle: (id: string, v: string) => void;
  toggle: (id: string, v: string) => void;
  setOther: (id: string, v: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <Field>
        <Textarea
          rows={field.rows ?? 4}
          placeholder={field.placeholder ?? ""}
          value={state[field.id] as string}
          onChange={(e) => setSingle(field.id, e.target.value)}
        />
      </Field>
    );
  }
  if (field.type === "text") {
    return (
      <Field>
        <Input
          placeholder={field.placeholder ?? ""}
          autoComplete="off"
          value={state[field.id] as string}
          onChange={(e) => setSingle(field.id, e.target.value)}
        />
      </Field>
    );
  }
  if (field.type === "radio_pills") {
    return (
      <div className="flex flex-wrap gap-2">
        {field.options?.map((o) => (
          <Pill key={o.value} active={state[field.id] === o.value} onClick={() => setSingle(field.id, o.value)}>
            {o.label ?? o.value}
          </Pill>
        ))}
      </div>
    );
  }
  if (field.type === "checkbox_pills") {
    const checked = (state[field.id] as string[]) ?? [];
    return (
      <div className="flex flex-wrap gap-2">
        {field.options?.map((o) => (
          <Pill key={o.value} active={checked.includes(o.value)} onClick={() => toggle(field.id, o.value)}>
            {o.label ?? o.value}
          </Pill>
        ))}
      </div>
    );
  }
  if (field.type === "brand_pills" || field.type === "brand_radio") {
    const isMulti = field.type === "brand_pills";
    const sel = state[field.id];
    const checkedSet = new Set(isMulti ? (sel as string[]) : sel ? [sel as string] : []);
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {field.options?.map((o) => {
            const url = brandIconUrl(o);
            const active = checkedSet.has(o.value);
            return (
              <Pill
                key={o.value}
                active={active}
                onClick={() => (isMulti ? toggle(field.id, o.value) : setSingle(field.id, o.value))}
                className="pl-2.5"
              >
                {url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={url} alt="" width={16} height={16} className="inline-block flex-shrink-0 object-contain" />
                ) : null}
                {o.label ?? o.value}
              </Pill>
            );
          })}
        </div>
        {field.otherField && (
          <div className="mt-3.5">
            <Textarea
              rows={2}
              placeholder={field.otherField.placeholder}
              value={state[field.otherField.id] as string}
              onChange={(e) => setOther(field.otherField!.id, e.target.value)}
            />
          </div>
        )}
      </>
    );
  }
  return null;
}

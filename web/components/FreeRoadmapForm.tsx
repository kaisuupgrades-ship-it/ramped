"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Field, Input, Pill, Textarea } from "@/components/ui/core";
import { integrations } from "@/lib/integrations";
import { painPoints, roles, teamSizes } from "@/lib/pain-points";
import { freeRoadmapFormSchema, type FreeRoadmapFormData } from "@/lib/schemas/free-roadmap";

export function FreeRoadmapForm() {
  const router = useRouter();
  const [pain, setPain] = React.useState<string[]>([]);
  const [stack, setStack] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FreeRoadmapFormData>({
    resolver: zodResolver(freeRoadmapFormSchema),
  });

  const toggle = (set: string[], setter: (v: string[]) => void, value: string) => {
    setter(set.includes(value) ? set.filter((v) => v !== value) : [...set, value]);
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/free-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          notes: values.notes ?? "",
          role: values.role ?? "",
          team_size: values.team_size ?? "",
          pain_points: pain,
          stack,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Submission failed");
      router.push("/thanks?intent=roadmap");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Email jon@30dayramp.com.");
      setSubmitting(false);
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-8"
      noValidate
    >
      <h2 className="m-0 mb-5 text-[22px] font-semibold tracking-tight">Tell us about your business</h2>

      <Field label="Full name" error={errors.name?.message}>
        <Input placeholder="Jane Doe" autoComplete="name" {...register("name")} />
      </Field>
      <div className="grid md:grid-cols-2 gap-3.5">
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" placeholder="jane@company.com" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Company" error={errors.company?.message}>
          <Input placeholder="Acme Logistics" autoComplete="organization" {...register("company")} />
        </Field>
      </div>
      <div className="grid md:grid-cols-2 gap-3.5">
        <Field label="Role">
          <select
            {...register("role")}
            className="w-full h-11 px-3.5 rounded-xl bg-bg-2 border border-line-2 text-text-0 text-[14.5px] focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/30"
          >
            <option value="">Select…</option>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Team size">
          <select
            {...register("team_size")}
            className="w-full h-11 px-3.5 rounded-xl bg-bg-2 border border-line-2 text-text-0 text-[14.5px] focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/30"
          >
            <option value="">Select…</option>
            {teamSizes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Where are you losing the most hours?">
        <div className="flex flex-wrap gap-2">
          {painPoints.map((p) => (
            <Pill key={p.value} active={pain.includes(p.value)} onClick={() => toggle(pain, setPain, p.value)}>
              {p.label}
            </Pill>
          ))}
        </div>
      </Field>
      <Field label="Current tools">
        <div className="flex flex-wrap gap-2">
          {integrations.map((i) => (
            <Pill key={i.name} active={stack.includes(i.name)} onClick={() => toggle(stack, setStack, i.name)} className="pl-2.5">
              <BrandLogo integration={i} size={16} />
              {i.name}
            </Pill>
          ))}
        </div>
      </Field>
      <Field label="What would change if this all ran on autopilot?">
        <Textarea
          rows={3}
          placeholder="One paragraph is enough — what would you do with the freed-up hours?"
          {...register("notes")}
        />
      </Field>

      {error && <div className="my-2 px-3.5 py-2.5 rounded-xl bg-bad/10 border border-bad/40 text-bad text-[13.5px]">{error}</div>}

      <Button type="submit" size="lg" variant="primary" className="w-full mt-2" disabled={submitting}>
        {submitting ? "Generating your roadmap…" : "Send me my roadmap →"}
      </Button>
      <div className="mt-3 text-[12.5px] text-text-3 text-center">Delivered within 24 hours. No spam, ever.</div>
    </form>
  );
}

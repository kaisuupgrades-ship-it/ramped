"use client";

/**
 * Homepage interactive demo. Pick a playbook → bot types → process steps
 * activate one-by-one with a fill bar → integrations light up → success card
 * with metrics + "agent learned" insight + branch buttons.
 *
 * Ported from the legacy index.html state machine. Keeps the V4 dark visuals.
 */
import * as React from "react";
import Link from "next/link";

type IntegrationId = "hubspot" | "clearbit" | "calendar" | "slack" | "netsuite" | "quickbooks" | "gong";

interface Step {
  l: string;
  ms: number;
  i?: IntegrationId[];
}

interface Metric {
  l: string;
  v: string;
  c?: "accent" | "green";
}

interface Workflow {
  id: "lead" | "inventory" | "finance" | "sales";
  title: string;
  subtitle: string;
  icon: string;
  iconBg: string;
  userPrompt: string;
  intro: string;
  steps: Step[];
  integrations: IntegrationId[];
  successTitle: string;
  metrics: Metric[];
  aha: string;
  detail: string;
}

const WORKFLOWS: Workflow[] = [
  {
    id: "lead",
    title: "Handle inbound lead",
    subtitle: "HubSpot → Slack → Calendar",
    icon: "🎯",
    iconBg: "linear-gradient(135deg,#3b82f6,#60a5fa)",
    userPrompt: "New inbound lead just came in from the website demo form — Sara Chen, Director of Ops at Northwind Logistics. Run the inbound playbook.",
    intro: "On it. Pulling Sara's profile and Northwind's signal data now — give me a moment to enrich.",
    steps: [
      { l: "Enriching lead from Clearbit + LinkedIn", ms: 950, i: ["clearbit"] },
      { l: "Scoring fit against ICP model", ms: 800 },
      { l: "Looking up Northwind in HubSpot", ms: 700, i: ["hubspot"] },
      { l: "Drafting personalized outreach", ms: 1100 },
      { l: "Booking discovery slot in Calendar", ms: 800, i: ["calendar"] },
      { l: "Posting handoff to #sales-pod", ms: 600, i: ["slack"] },
    ],
    integrations: ["hubspot", "clearbit", "calendar", "slack"],
    successTitle: "Lead routed and meeting booked.",
    metrics: [
      { l: "Time to first touch", v: "47s", c: "accent" },
      { l: "Pipeline added", v: "$12,400", c: "green" },
      { l: "Fit score", v: "94 / 100" },
    ],
    aha: "Agent learned from your last 12 closed-won deals — Sara fits the profile of a 32-day cycle, so I queued a tighter follow-up cadence.",
    detail: "Sent a Loom recap to Sara, looped in <strong>@marcus</strong> as AE, and dropped the Northwind brief into the deal record. Next touch fires in 26 hours if no reply.",
  },
  {
    id: "inventory",
    title: "Automate inventory",
    subtitle: "NetSuite reorder + SKU forecast",
    icon: "📦",
    iconBg: "linear-gradient(135deg,#fb923c,#fdba74)",
    userPrompt: "Run the weekly inventory pass. Flag anything tracking below safety stock and trigger reorders where the math works.",
    intro: "Pulling SKU velocity from NetSuite and cross-checking against the demand model. Running the reorder logic now.",
    steps: [
      { l: "Fetching 14,200 active SKUs from NetSuite", ms: 900, i: ["netsuite"] },
      { l: "Running 30-day demand forecast", ms: 1100 },
      { l: "Flagging SKUs below safety stock", ms: 700 },
      { l: "Validating supplier lead times", ms: 800 },
      { l: "Generating purchase orders", ms: 950, i: ["netsuite"] },
      { l: "Notifying ops in #inventory-alerts", ms: 600, i: ["slack"] },
    ],
    integrations: ["netsuite", "slack"],
    successTitle: "62 SKUs reordered, 3 flagged for review.",
    metrics: [
      { l: "POs generated", v: "62", c: "accent" },
      { l: "Stockouts prevented", v: "$84,200", c: "green" },
      { l: "Hours saved", v: "11h" },
    ],
    aha: "Three SKUs hit a seasonality spike I haven't seen before — paused those for a human review instead of auto-firing.",
    detail: "POs sit in <code>Pending Approval</code> in NetSuite. The 3 flagged items are in <strong>#inventory-alerts</strong> with my reasoning attached.",
  },
  {
    id: "finance",
    title: "Process finance report",
    subtitle: "QuickBooks → variance memo",
    icon: "📊",
    iconBg: "linear-gradient(135deg,#a78bfa,#60a5fa)",
    userPrompt: "Close Q3 — pull the actuals from QuickBooks, compare to plan, and draft the variance memo for Friday's board prep.",
    intro: "Closing Q3 now. Reconciling actuals, building the variance walk, and drafting the memo with footnotes.",
    steps: [
      { l: "Reconciling 1,847 transactions in QuickBooks", ms: 1100, i: ["quickbooks"] },
      { l: "Mapping to plan categories", ms: 850 },
      { l: "Computing line-item variances", ms: 700 },
      { l: "Drafting executive variance memo", ms: 1100 },
      { l: "Generating board-ready charts", ms: 800 },
      { l: "Sharing draft with #finance-leads", ms: 500, i: ["slack"] },
    ],
    integrations: ["quickbooks", "slack"],
    successTitle: "Q3 close packet ready for review.",
    metrics: [
      { l: "Variance vs plan", v: "+4.2%", c: "green" },
      { l: "Memo turnaround", v: "9 min", c: "accent" },
      { l: "Manual hours saved", v: "14h" },
    ],
    aha: "Spotted a recurring duplicate from one vendor across June and July — I held those out and flagged for AP review before they hit the memo.",
    detail: "Memo and charts are in <strong>#finance-leads</strong>. Two notes added for the CFO: <strong>OpEx</strong> ran hot on cloud spend, and <strong>headcount</strong> came in under by $86k.",
  },
  {
    id: "sales",
    title: "Qualify sales call",
    subtitle: "Gong recap + MEDDIC scoring",
    icon: "📞",
    iconBg: "linear-gradient(135deg,#34d399,#60a5fa)",
    userPrompt: "Discovery call with Acme Robotics just wrapped — process the recording, score the deal, and update the pipeline.",
    intro: "Got the recording. Pulling the transcript, scoring against MEDDIC, and updating HubSpot. Should take under a minute.",
    steps: [
      { l: "Transcribing 38-min call from Gong", ms: 1100, i: ["gong"] },
      { l: "Extracting champion + decision criteria", ms: 900 },
      { l: "Scoring against MEDDIC framework", ms: 750 },
      { l: "Updating deal record in HubSpot", ms: 700, i: ["hubspot"] },
      { l: "Drafting follow-up email + summary", ms: 950 },
      { l: "Posting recap to #deal-room", ms: 500, i: ["slack"] },
    ],
    integrations: ["gong", "hubspot", "slack"],
    successTitle: "Acme Robotics qualified — moved to Stage 3.",
    metrics: [
      { l: "MEDDIC score", v: "78%", c: "accent" },
      { l: "Deal size", v: "$148k", c: "green" },
      { l: "Close confidence", v: "High" },
    ],
    aha: "Their CTO mentioned a 6-week procurement freeze — I flagged the timeline and pre-built a phased rollout option for your follow-up.",
    detail: "Updated <strong>Acme Robotics — Pilot</strong> in HubSpot. Follow-up email is in your drafts. Two flags: budget signed-off, but legal review may add 2 weeks.",
  },
];

const IMETA: Record<IntegrationId, { l: string; a: string; bg: string }> = {
  hubspot: { l: "HubSpot", a: "H", bg: "#ff7a59" },
  clearbit: { l: "Clearbit", a: "C", bg: "#3b82f6" },
  calendar: { l: "Calendar", a: "📅", bg: "#22c55e" },
  slack: { l: "Slack", a: "#", bg: "#a855f7" },
  netsuite: { l: "NetSuite", a: "N", bg: "#f59e0b" },
  quickbooks: { l: "QuickBooks", a: "Q", bg: "#10b981" },
  gong: { l: "Gong", a: "G", bg: "#ef4444" },
};

type StepState = "pending" | "active" | "done";

interface RunState {
  workflow: Workflow;
  stepStates: StepState[];
  liveIntegrations: Set<IntegrationId>;
  fillPct: number;
  showTyping: boolean;
  showIntro: boolean;
  showProcess: boolean;
  showSuccess: boolean;
  showBranches: boolean;
}

function stamp(): string {
  const d = new Date();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export function HomepageDemo() {
  const [run, setRun] = React.useState<RunState | null>(null);
  const [running, setRunning] = React.useState(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [introTime] = React.useState<string>("9:14 AM");
  const abortRef = React.useRef<AbortController | null>(null);
  const streamRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Auto-scroll the chat stream when new content lands.
  React.useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  });

  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function runWF(wf: Workflow) {
    if (running) return;
    setRunning(true);
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const speed = reduceMotion ? 4 : 1;

    const initial: RunState = {
      workflow: wf,
      stepStates: wf.steps.map(() => "pending"),
      liveIntegrations: new Set(),
      fillPct: 0,
      showTyping: false,
      showIntro: false,
      showProcess: false,
      showSuccess: false,
      showBranches: false,
    };
    setRun(initial);

    try {
      await wait(450 / speed, ctl.signal);
      setRun((r) => r && { ...r, showTyping: true });
      await wait(900 / speed, ctl.signal);
      setRun((r) => r && { ...r, showTyping: false, showIntro: true });
      await wait(400 / speed, ctl.signal);
      setRun((r) => r && { ...r, showProcess: true });

      const total = wf.steps.reduce((s, x) => s + x.ms, 0);
      let elapsed = 0;
      for (let i = 0; i < wf.steps.length; i++) {
        const s = wf.steps[i];
        setRun((r) => {
          if (!r) return r;
          const nextStates = [...r.stepStates];
          nextStates[i] = "active";
          const liveSet = new Set(r.liveIntegrations);
          if (s.i) s.i.forEach((iid) => liveSet.add(iid));
          return { ...r, stepStates: nextStates, liveIntegrations: liveSet };
        });

        const ms = s.ms / speed;
        const start = performance.now();
        const startEl = elapsed;
        await new Promise<void>((res, rej) => {
          const onAbort = () => { cancelAnimationFrame(raf); rej(new DOMException("Aborted", "AbortError")); };
          ctl.signal.addEventListener("abort", onAbort, { once: true });
          let raf = 0;
          const tick = () => {
            const t = performance.now() - start;
            const pct = Math.min(100, ((startEl + Math.min(t, ms)) / (total / speed)) * 100);
            setRun((r) => r && { ...r, fillPct: pct });
            if (t >= ms) {
              ctl.signal.removeEventListener("abort", onAbort);
              res();
              return;
            }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        });
        elapsed += ms;

        setRun((r) => {
          if (!r) return r;
          const nextStates = [...r.stepStates];
          nextStates[i] = "done";
          return { ...r, stepStates: nextStates };
        });
      }

      await wait(350 / speed, ctl.signal);
      setRun((r) => r && { ...r, showSuccess: true });
      await wait(400 / speed, ctl.signal);
      setRun((r) => r && { ...r, showBranches: true });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) throw e;
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    abortRef.current?.abort();
    setRun(null);
    setRunning(false);
  }

  return (
    <div className="bg-bg-1 border border-line rounded-2xl overflow-hidden grid lg:grid-cols-[240px_1fr] min-h-[480px]">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col gap-4 p-4 bg-bg-0 border-r border-line">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue to-orange grid place-items-center text-[#07090d] font-bold text-sm">N</div>
          <div>
            <div className="font-semibold text-[14px] text-text-0">Northwind</div>
            <div className="text-[11px] text-text-3">12 agents online</div>
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-text-3 font-semibold px-2.5 py-1.5">Channels</div>
          {["general", "sales-pod", "deal-room", "finance-leads", "inventory-alerts"].map((c) => (
            <div key={c} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-text-2 hover:text-text-0 hover:bg-bg-2 rounded-md cursor-default">
              <span className="text-text-3">#</span> {c}
            </div>
          ))}
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-text-3 font-semibold px-2.5 py-1.5">AI Agents</div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-text-0 bg-blue/[0.10] rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-good motion-safe:animate-pulse" /> Ramped Bot
            <span className="ml-auto text-[9.5px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-good/15 text-good">LIVE</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-text-2">
            <span className="w-1.5 h-1.5 rounded-full bg-text-3" /> Ops Agent
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-text-2">
            <span className="w-1.5 h-1.5 rounded-full bg-text-3" /> Finance Agent
          </div>
        </div>
        <div className="mt-auto p-3 rounded-xl bg-bg-2 border border-line">
          <div className="text-[11px] text-text-3">Day</div>
          <div className="text-2xl font-bold text-text-0">30 / 30</div>
          <div className="text-[12px] text-good flex items-center gap-1">● Deployment complete</div>
        </div>
      </aside>

      {/* Chat */}
      <div className="flex flex-col min-w-0">
        <header className="border-b border-line px-6 py-3.5 flex items-center gap-3.5 bg-bg-1">
          <div className="w-9 h-9 rounded-lg bg-white p-1 grid place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[15px] text-text-0">Ramped Bot</div>
            <div className="text-[12px] text-text-2">Your AI department · trained on Northwind data</div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-good">
            <span className="w-1.5 h-1.5 rounded-full bg-good motion-safe:animate-pulse" /> Online
          </span>
        </header>

        <div ref={streamRef} className="flex-1 px-6 py-5 space-y-5 overflow-y-auto max-h-[640px]">
          {/* Bot intro (always shown) */}
          <BotMsg time={introTime}>
            <div className="text-[14.5px] text-text-1 leading-relaxed">
              Morning — I&apos;ve been live for <strong className="text-text-0">30 days</strong>. I&apos;ve trained on your Northwind data, mapped your tools, and I&apos;m ready to run real work. <strong className="text-text-0">Pick a playbook</strong> and I&apos;ll execute it end-to-end.
            </div>
            {!run && (
              <div className="mt-3.5 grid sm:grid-cols-2 gap-2 max-w-[560px]">
                {WORKFLOWS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={running}
                    onClick={() => runWF(p)}
                    className="text-left bg-gradient-to-b from-[rgba(255,255,255,0.04)] to-[rgba(255,255,255,0.01)] border border-line-2 rounded-xl px-3.5 py-3 flex items-center gap-2.5 transition-all duration-150 hover:border-blue hover:bg-blue/[0.06] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="w-8 h-8 rounded-lg grid place-items-center text-base flex-shrink-0" style={{ background: p.iconBg }}>{p.icon}</span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-text-0 font-semibold text-[13.5px]">{p.title}</span>
                      <span className="text-text-3 text-[11.5px] font-mono">{p.subtitle}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </BotMsg>

          {run && (
            <>
              <UserMsg text={run.workflow.userPrompt} />
              {run.showTyping && <TypingMsg />}
              {run.showIntro && <BotMsg><div className="text-[14.5px] text-text-1 leading-relaxed">{run.workflow.intro}</div></BotMsg>}
              {run.showProcess && (
                <div className="pl-12">
                  <div className="rounded-xl border border-line bg-bg-2 p-4">
                    <div className="space-y-2">
                      {run.workflow.steps.map((s, i) => (
                        <ProcessStep key={i} label={s.l} state={run.stepStates[i]} duration={s.ms} />
                      ))}
                    </div>
                    <div className="mt-3 h-1 rounded-full bg-bg-3 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue to-orange transition-[width] duration-[300ms]" style={{ width: `${run.fillPct}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {run.workflow.integrations.map((iid) => {
                      const meta = IMETA[iid];
                      const live = run.liveIntegrations.has(iid);
                      return (
                        <span
                          key={iid}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-medium transition-colors ${
                            live ? "border-good/40 bg-good/[0.08] text-text-0" : "border-line-2 bg-bg-2 text-text-2"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-good motion-safe:animate-pulse" : "bg-text-3"}`} />
                          <span className="w-4 h-4 rounded grid place-items-center text-[9px] font-bold text-white" style={{ background: meta.bg }}>{meta.a}</span>
                          {meta.l}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {run.showSuccess && (
                <BotMsg>
                  <div className="rounded-xl border border-line bg-bg-2 p-4">
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="w-6 h-6 rounded-full bg-good grid place-items-center flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#07090d" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <div className="font-semibold text-[14.5px] text-text-0">{run.workflow.successTitle}</div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2.5">
                      {run.workflow.metrics.map((m) => (
                        <div key={m.l} className="rounded-lg border border-line bg-bg-3 px-3 py-2.5">
                          <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-3 font-semibold">{m.l}</div>
                          <div className={`mt-1 text-[18px] font-bold tracking-tight tabular-nums ${m.c === "accent" ? "text-orange-2" : m.c === "green" ? "text-good" : "text-text-0"}`}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 px-3.5 py-2.5 rounded-r-lg border-l-2 border-orange bg-orange/[0.06] text-[13px] text-text-1 flex gap-2">
                      <span className="text-orange">✦</span>
                      <span><strong className="text-orange-2">Agent learned from your data —</strong> {run.workflow.aha}</span>
                    </div>
                    <div
                      className="mt-3 text-[13.5px] text-text-1 leading-snug [&_strong]:text-text-0 [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-bg-3 [&_code]:border [&_code]:border-line"
                      dangerouslySetInnerHTML={{ __html: run.workflow.detail }}
                    />
                  </div>
                </BotMsg>
              )}
              {run.showBranches && (
                <div className="pl-12 flex flex-wrap gap-2">
                  <Link
                    href="/book"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange text-[#07090d] font-semibold text-[13px] hover:bg-orange-2 transition-colors"
                  >
                    📅 Book a discovery call
                  </Link>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-bg-2 border border-line-2 text-text-1 font-semibold text-[13px] hover:bg-bg-3 hover:text-text-0 transition-colors"
                  >
                    ↻ Run another playbook
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-line px-5 py-3.5">
          <div className="bg-bg-2 border border-line-2 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5">
            <span className="text-text-3">+</span>
            <span className="flex-1 text-[13.5px] text-text-3">Ask Ramped Bot anything, or pick a playbook above…</span>
            <span className="text-[10.5px] font-mono text-text-3 hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-bg-3 border border-line-2 text-text-2">⌘</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-bg-3 border border-line-2 text-text-2">K</kbd>
            </span>
          </div>
          <div className="mt-2.5 text-[11px] text-text-3 px-1 flex items-center justify-between flex-wrap gap-2">
            <span>Connected to <span className="text-text-1 font-semibold">HubSpot</span>, <span className="text-text-1 font-semibold">NetSuite</span>, <span className="text-text-1 font-semibold">QuickBooks</span>, <span className="text-text-1 font-semibold">Gong</span>, <span className="text-text-1 font-semibold">Slack</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BotMsg({ time, children }: { time?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[36px_1fr] gap-3">
      <div className="w-9 h-9 rounded-lg bg-white p-1 grid place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="w-full h-full object-contain" />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-[14px] text-text-0">Ramped Bot</span>
          <span className="text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue/15 text-blue-2">AI</span>
          <span className="text-[11px] text-text-3">{time ?? stamp()}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function UserMsg({ text }: { text: string }) {
  return (
    <div className="grid grid-cols-[36px_1fr] gap-3">
      <div className="w-9 h-9 rounded-lg bg-bg-3 border border-line grid place-items-center text-text-1 font-semibold text-[13px]">U</div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-[14px] text-text-0">You</span>
          <span className="text-[11px] text-text-3">{stamp()}</span>
        </div>
        <div className="text-[14.5px] text-text-1 leading-relaxed">{text}</div>
      </div>
    </div>
  );
}

function TypingMsg() {
  return (
    <div className="grid grid-cols-[36px_1fr] gap-3">
      <div className="w-9 h-9 rounded-lg bg-white p-1 grid place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="w-full h-full object-contain" />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-[14px] text-text-0">Ramped Bot</span>
          <span className="text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue/15 text-blue-2">AI</span>
          <span className="text-[11px] text-text-3">typing…</span>
        </div>
        <div className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-bg-2 border border-line">
          <Dot delay={0} />
          <Dot delay={150} />
          <Dot delay={300} />
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-text-2"
      style={{
        animation: "homepageDemoBlink 1s infinite",
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

function ProcessStep({ label, state, duration }: { label: string; state: StepState; duration: number }) {
  return (
    <div className={`flex items-center gap-2.5 text-[13.5px] transition-opacity ${state === "pending" ? "opacity-50" : "opacity-100"}`}>
      {state === "active" ? (
        <span
          className="w-3.5 h-3.5 rounded-full border-2 border-blue border-t-transparent"
          style={{ animation: "homepageDemoSpin 0.7s linear infinite" }}
          aria-hidden="true"
        />
      ) : state === "done" ? (
        <span className="w-3.5 h-3.5 rounded-full bg-good grid place-items-center flex-shrink-0">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#07090d" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      ) : (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-line-2" aria-hidden="true" />
      )}
      <span className={state === "active" ? "text-text-0" : state === "done" ? "text-text-1" : "text-text-2"}>{label}</span>
      {state === "done" && (
        <span className="ml-auto text-[11px] font-mono text-text-3">✓ {(duration / 1000).toFixed(1)}s</span>
      )}
    </div>
  );
}

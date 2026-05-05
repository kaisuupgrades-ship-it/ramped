import { NextResponse, type NextRequest } from "next/server";
import { checkPortalToken } from "@/lib/portal-auth";
import { computePhase } from "@/lib/phase";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal-data?id=<uuid>&exp=<unix>&t=<hmac>
 *
 * Customer portal home payload. Returns booking + automation_map + computed
 * phase + agents/drafts/activity, with a phase-aware welcome subhead.
 *
 * Defensive against pre-migration column states: full SELECT first, falls back
 * to a minimal SELECT if migration 004 columns aren't present yet.
 */

interface BookingFull {
  id: string; name: string | null; company: string | null; email: string | null;
  tier: string | null; status: string | null; datetime: string | null;
  timezone: string | null; meet_link: string | null;
  automation_map?: { summary?: string; top_agents?: unknown[] } | null;
  questionnaire?: unknown;
  payment_status?: string | null; onboarding_completed_at?: string | null;
  created_at?: string;
}

interface Agent { id: string; name: string; channel: string; description: string; status: string }
interface Draft { id: string; subject: string; body: string; recipient: string; channel: string; created_at: string }
interface Run { id: string; agent_id: string; action: string; outcome: string; hours_saved: number | null; created_at: string }

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtCallTime(iso: string | null | undefined, tz: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  };
  if (tz) opts.timeZone = tz;
  return d.toLocaleString("en-US", opts);
}

export async function GET(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  // Booking — full SELECT, fall back to minimal if migration 004 cols missing
  const fullSel = "id,name,company,email,tier,status,datetime,timezone,meet_link,automation_map,questionnaire,payment_status,onboarding_completed_at,created_at";
  const minSel = "id,name,company,email,tier,status,datetime,timezone,meet_link,automation_map,questionnaire,created_at";
  let r = await supabaseRest<BookingFull[]>("GET", `/bookings?id=eq.${encodeURIComponent(id)}&select=${fullSel}`);
  if (!r.ok) {
    r = await supabaseRest<BookingFull[]>("GET", `/bookings?id=eq.${encodeURIComponent(id)}&select=${minSel}`);
  }
  if (!r.ok) return NextResponse.json({ error: "Database error" }, { status: 500 });
  const b = Array.isArray(r.data) ? r.data[0] : null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Pending drafts + agents + recent activity (best-effort; tables may not exist yet)
  let drafts: Draft[] = [];
  let agents: Agent[] = [];
  let activity: Run[] = [];
  try {
    const [dr, ar, rr] = await Promise.all([
      supabaseRest<Draft[]>("GET", `/agent_drafts?booking_id=eq.${encodeURIComponent(id)}&status=eq.pending&select=id,subject,body,recipient,channel,created_at&order=created_at.desc&limit=20`),
      supabaseRest<Agent[]>("GET", `/agents?booking_id=eq.${encodeURIComponent(id)}&status=neq.archived&select=id,name,channel,description,status&order=created_at.asc`),
      supabaseRest<Run[]>("GET", `/agent_runs?booking_id=eq.${encodeURIComponent(id)}&select=id,agent_id,action,outcome,hours_saved,created_at&order=created_at.desc&limit=20`),
    ]);
    drafts = (dr.ok && Array.isArray(dr.data)) ? dr.data : [];
    agents = (ar.ok && Array.isArray(ar.data)) ? ar.data : [];
    activity = (rr.ok && Array.isArray(rr.data)) ? rr.data : [];
  } catch { /* tables not migrated, leave empty */ }

  const kickoffISO = b.datetime;
  const goliveISO = kickoffISO ? new Date(new Date(kickoffISO).getTime() + 30 * 86400000).toISOString() : null;
  const phaseInfo = computePhase(kickoffISO);

  const agentCount = b.automation_map?.top_agents?.length || 0;
  const liveAgents = agents.filter((a) => a.status === "live").length;
  const totalHoursSaved = activity.reduce((sum, r) => sum + (Number(r.hours_saved) || 0), 0);

  let welcomeSub: string;
  switch (phaseInfo.phase) {
    case "Pre-kickoff":
      welcomeSub = b.automation_map?.summary
        || `We're scoping your AI department. ${agentCount > 0 ? `${agentCount} agents identified so far.` : "Discovery call coming up."}`;
      break;
    case "Kickoff":
      welcomeSub = `Day 1. We just met. Roadmap lands in your inbox within a few hours.`;
      break;
    case "Discovery":
      welcomeSub = b.automation_map?.summary
        || `Roadmap delivered. ${agentCount} agents on the build queue. First prototype lands this week.`;
      break;
    case "Build":
      welcomeSub = agentCount
        ? `${agentCount} agents in build. ${liveAgents} live so far. Live data appears here the moment each one ships.`
        : `Build phase. Agents being wired into your stack. Live data appears here as they ship.`;
      break;
    case "QA":
      welcomeSub = `Final QA against your real data. Agents go live in a few days.`;
      break;
    case "Live":
      welcomeSub = totalHoursSaved > 0
        ? `${liveAgents || agentCount} agents running. ${totalHoursSaved.toFixed(1)} hours saved this month and counting.`
        : `${liveAgents || agentCount} agents running. Live activity appears below as it happens.`;
      break;
    default:
      welcomeSub = b.automation_map?.summary || `We're scoping your AI department.`;
  }

  return NextResponse.json({
    booking: {
      id: b.id, name: b.name, company: b.company, tier: b.tier, status: b.status,
      payment_status: b.payment_status || null,
      onboarding_completed_at: b.onboarding_completed_at || null,
    },
    payment_status: b.payment_status || null,
    phase_eyebrow: phaseInfo.eyebrow,
    phase: phaseInfo.phase,
    phase_step: phaseInfo.step,
    day_of_thirty: phaseInfo.dayOfThirty,
    welcome_sub: welcomeSub,
    kickoff_date: fmtDate(kickoffISO),
    golive_date: fmtDate(goliveISO),
    next_call: {
      when: fmtCallTime(kickoffISO, b.timezone),
      what: phaseInfo.phase === "Live" ? "Monthly strategy call · 30 min" : "Weekly check-in · 30 min",
      meet_url: b.meet_link || null,
    },
    automation_map: b.automation_map || null,
    agents,
    activity,
    drafts,
  });
}

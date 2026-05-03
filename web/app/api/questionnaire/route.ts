import { NextResponse, type NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase";
import { questionnairePayloadSchema } from "@/lib/schemas/questionnaire";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/questionnaire
 *
 * Saves the qualification answers to bookings.questionnaire (JSONB).
 *
 * NOTE: Anthropic-driven automation-map generation is NOT included in this
 * minimal port — the legacy /api/questionnaire.js still handles that. We'll
 * port the prompt + Claude call once we replace the Resend/Calendar invite
 * generation in the next session.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = questionnairePayloadSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first = Object.values(flat)[0]?.[0];
    return NextResponse.json({ ok: false, error: first ?? "Invalid request" }, { status: 400 });
  }

  const { booking_id, ...rest } = parsed.data;

  const updateRes = await supabaseRest(
    "PATCH",
    `/bookings?id=eq.${encodeURIComponent(booking_id)}`,
    {
      questionnaire: rest,
      profile_updated_at: new Date().toISOString(),
    },
  );

  if (!updateRes.ok) {
    return NextResponse.json(
      { ok: false, error: "Couldn't save responses. Email jon@30dayramp.com if this keeps happening." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

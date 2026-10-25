import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  password?: string;
  recipientPersonId?: number | null;
  deathDate?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;

    if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (body.recipientPersonId && !/^\d{4}-\d{2}-\d{2}$/.test(body.deathDate ?? "")) {
      return NextResponse.json(
        { error: "Please enter the date of death before closing the round." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("id,title")
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundError) throw roundError;
    if (!round) {
      return NextResponse.json({ error: "No active round" }, { status: 409 });
    }

    const { error: closeError } = await supabase
      .from("rounds")
      .update({
        status: "closed",
        ended_at: new Date().toISOString(),
        recipient_person_id: body.recipientPersonId || null,
        death_date: body.recipientPersonId ? body.deathDate : null,
      })
      .eq("id", round.id);

    if (closeError) throw closeError;

    const { data: newRound, error: newRoundError } = await supabase
      .from("rounds")
      .insert({ title: `Round ${Number(round.id) + 1}`, status: "active" })
      .select("id,title,started_at")
      .single();

    if (newRoundError) throw newRoundError;

    return NextResponse.json({ ok: true, newRound });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to reset round" }, { status: 500 });
  }
}

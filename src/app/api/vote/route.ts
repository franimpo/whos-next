import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { attachVoterCookie, getOrCreateVoter } from "@/lib/voter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

type VoteBody = {
  wikidataId?: string;
};

type Claim = {
  mainsnak?: {
    datavalue?: {
      value?: string | { id?: string };
    };
  };
};

type Entity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
};

async function getCanonicalPerson(wikidataId: string, origin: string) {
  if (!/^Q\d+$/.test(wikidataId)) return null;

  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", wikidataId);
  url.searchParams.set("props", "labels|descriptions|claims");
  url.searchParams.set("languages", "en");
  url.searchParams.set("languagefallback", "1");
  url.searchParams.set("format", "json");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": `WhosNext/1.0 (${origin})`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Wikidata validation failed", response.status, body.slice(0, 500));
    throw new Error(`Wikidata returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    entities?: Record<string, Entity & { missing?: string }>;
  };

  const entity = data.entities?.[wikidataId];
  if (!entity || "missing" in entity) return null;

  const isHuman = (entity.claims?.P31 ?? []).some((claim) => {
    const value = claim.mainsnak?.datavalue?.value;
    return typeof value === "object" && value?.id === "Q5";
  });

  if (!isHuman) return null;

  const name = entity.labels?.en?.value;
  if (!name) return null;

  const imageValue = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;

  return {
    wikidataId: entity.id,
    name,
    description: entity.descriptions?.en?.value ?? "",
    image:
      typeof imageValue === "string"
        ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
            imageValue
          )}?width=480`
        : null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VoteBody;

    if (!body.wikidataId) {
      return NextResponse.json({ error: "Invalid person" }, { status: 400 });
    }

    // Never trust the browser-supplied name/photo. Re-read the canonical record
    // from Wikidata and verify that the entity is actually a human (Q5).
    const canonicalPerson = await getCanonicalPerson(
      body.wikidataId,
      request.nextUrl.origin
    );
    if (!canonicalPerson) {
      return NextResponse.json(
        { error: "That Wikidata entry is not a valid person" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("id")
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundError) throw roundError;
    if (!round) {
      return NextResponse.json({ error: "No active round" }, { status: 409 });
    }

    let { data: person, error: personLookupError } = await supabase
      .from("people")
      .select("id,wikidata_id,name")
      .eq("wikidata_id", canonicalPerson.wikidataId)
      .maybeSingle();

    if (personLookupError) throw personLookupError;

    if (!person) {
      const baseSlug =
        slugify(canonicalPerson.name) || canonicalPerson.wikidataId.toLowerCase();
      const uniqueSlug = `${baseSlug}-${canonicalPerson.wikidataId.toLowerCase()}`;

      const { data: insertedPerson, error: insertPersonError } = await supabase
        .from("people")
        .insert({
          wikidata_id: canonicalPerson.wikidataId,
          name: canonicalPerson.name,
          slug: uniqueSlug,
          description: canonicalPerson.description || null,
          image_url: canonicalPerson.image,
        })
        .select("id,wikidata_id,name")
        .single();

      if (insertPersonError) throw insertPersonError;
      person = insertedPerson;
    }

    const { voterId, voterHash, isNew } = getOrCreateVoter(request);

    const { error: voteError } = await supabase.from("votes").upsert(
      {
        round_id: round.id,
        person_id: person.id,
        voter_hash: voterHash,
      },
      {
        onConflict: "round_id,voter_hash",
      }
    );

    if (voteError) throw voteError;

    const response = NextResponse.json({
      ok: true,
      person,
    });

    return isNew ? attachVoterCookie(response, voterId) : response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to vote" }, { status: 500 });
  }
}

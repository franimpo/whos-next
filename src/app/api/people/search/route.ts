import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchItem = {
  id: string;
  label?: string;
  description?: string;
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

function wikimediaHeaders(request: NextRequest) {
  // Wikimedia requires a descriptive User-Agent with contact information.
  // Using the deployed site's own origin keeps this valid in local/dev/prod.
  return {
    "User-Agent": `WhosNext/1.0 (${request.nextUrl.origin})`,
    Accept: "application/json",
  };
}

async function fetchWikidata(url: URL, request: NextRequest) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: wikimediaHeaders(request),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Wikidata request failed", response.status, body.slice(0, 500));
    throw new Error(`Wikidata returned HTTP ${response.status}`);
  }

  return response;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const searchUrl = new URL("https://www.wikidata.org/w/api.php");
    searchUrl.searchParams.set("action", "wbsearchentities");
    searchUrl.searchParams.set("search", query);
    searchUrl.searchParams.set("language", "en");
    searchUrl.searchParams.set("uselang", "en");
    searchUrl.searchParams.set("type", "item");
    searchUrl.searchParams.set("limit", "15");
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("formatversion", "2");

    const searchResponse = await fetchWikidata(searchUrl, request);
    const searchData = (await searchResponse.json()) as {
      search?: SearchItem[];
    };

    const items = searchData.search ?? [];
    const ids = items.map((item) => item.id);

    if (!ids.length) return NextResponse.json([]);

    const entityUrl = new URL("https://www.wikidata.org/w/api.php");
    entityUrl.searchParams.set("action", "wbgetentities");
    entityUrl.searchParams.set("ids", ids.join("|"));
    entityUrl.searchParams.set("props", "labels|descriptions|claims");
    entityUrl.searchParams.set("languages", "en");
    entityUrl.searchParams.set("languagefallback", "1");
    entityUrl.searchParams.set("format", "json");
    entityUrl.searchParams.set("formatversion", "2");

    const entityResponse = await fetchWikidata(entityUrl, request);
    const entityData = (await entityResponse.json()) as {
      entities?: Record<string, Entity>;
    };

    const entities = entityData.entities ?? {};
    const searchLookup = new Map(items.map((item) => [item.id, item]));

    const people = ids
      .map((id) => entities[id])
      .filter((entity): entity is Entity => Boolean(entity))
      .filter((entity) => {
        const instanceOf = entity.claims?.P31 ?? [];
        return instanceOf.some((claim) => {
          const value = claim.mainsnak?.datavalue?.value;
          return typeof value === "object" && value?.id === "Q5";
        });
      })
      .map((entity) => {
        const searchItem = searchLookup.get(entity.id);
        const imageValue = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;

        return {
          wikidataId: entity.id,
          name: entity.labels?.en?.value ?? searchItem?.label ?? entity.id,
          description:
            entity.descriptions?.en?.value ?? searchItem?.description ?? "",
          image:
            typeof imageValue === "string"
              ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
                  imageValue
                )}?width=240`
              : null,
        };
      });

    return NextResponse.json(people);
  } catch (error) {
    console.error("Person search error:", error);
    return NextResponse.json(
      {
        error: "Unable to search people",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}

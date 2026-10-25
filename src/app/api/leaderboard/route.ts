import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type VotePerson = {
  id: number;
  wikidata_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
};

type RankedPerson = {
  id: number;
  wikidataId: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  votes: number;
  rank: number;
  percentage: number;
};

type HistoricalRound = {
  id: number;
  title: string | null;
  ended_at: string | null;
  death_date: string | null;
  totalVotes: number;
  recipient: {
    id: number;
    wikidataId: string;
    name: string;
    slug: string;
    description: string | null;
    image: string | null;
    votes: number;
    rank: number | null;
    percentage: number;
  };
};

function buildLeaderboard(
  votes:
    | {
        person_id: number;
        people: unknown;
      }[]
    | null
) {
  const grouped = new Map<number, Omit<RankedPerson, "rank" | "percentage">>();

  for (const vote of votes ?? []) {
    const raw = vote.people;
    const person = (Array.isArray(raw) ? raw[0] : raw) as VotePerson | null;

    if (!person) continue;

    const current = grouped.get(person.id);
    if (current) {
      current.votes += 1;
    } else {
      grouped.set(person.id, {
        id: person.id,
        wikidataId: person.wikidata_id,
        name: person.name,
        slug: person.slug,
        description: person.description,
        image: person.image_url,
        votes: 1,
      });
    }
  }

  const sorted = [...grouped.values()].sort((a, b) => b.votes - a.votes);
  const totalVotes = sorted.reduce((sum, item) => sum + item.votes, 0);

  const leaderboard: RankedPerson[] = sorted.map((person, index) => ({
    ...person,
    rank: index + 1,
    percentage:
      totalVotes > 0
        ? Math.round((person.votes / totalVotes) * 1000) / 10
        : 0,
  }));

  return { leaderboard, totalVotes };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("id,title,started_at")
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundError) throw roundError;

    let leaderboard: RankedPerson[] = [];
    let totalVotes = 0;

    if (round) {
      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select("person_id, people(id,wikidata_id,name,slug,description,image_url)")
        .eq("round_id", round.id);

      if (votesError) throw votesError;

      const current = buildLeaderboard(votes);
      leaderboard = current.leaderboard;
      totalVotes = current.totalVotes;
    }

    const { data: historicalRows, error: historicalError } = await supabase
      .from("rounds")
      .select("id,title,ended_at,death_date,recipient_person_id")
      .eq("status", "closed")
      .not("recipient_person_id", "is", null)
      .order("death_date", { ascending: false, nullsFirst: false })
      .order("ended_at", { ascending: false });

    if (historicalError) throw historicalError;

    const history: HistoricalRound[] = [];

    for (const historicalRow of historicalRows ?? []) {
      if (!historicalRow.recipient_person_id) continue;

      const [recipientResult, votesResult] = await Promise.all([
        supabase
          .from("people")
          .select("id,wikidata_id,name,slug,description,image_url")
          .eq("id", historicalRow.recipient_person_id)
          .maybeSingle(),
        supabase
          .from("votes")
          .select("person_id, people(id,wikidata_id,name,slug,description,image_url)")
          .eq("round_id", historicalRow.id),
      ]);

      if (recipientResult.error) throw recipientResult.error;
      if (votesResult.error) throw votesResult.error;
      if (!recipientResult.data) continue;

      const previous = buildLeaderboard(votesResult.data);
      const recipientStats = previous.leaderboard.find(
        (person) => person.id === recipientResult.data!.id
      );

      history.push({
        id: historicalRow.id,
        title: historicalRow.title,
        ended_at: historicalRow.ended_at,
        death_date: historicalRow.death_date,
        totalVotes: previous.totalVotes,
        recipient: {
          id: recipientResult.data.id,
          wikidataId: recipientResult.data.wikidata_id,
          name: recipientResult.data.name,
          slug: recipientResult.data.slug,
          description: recipientResult.data.description,
          image: recipientResult.data.image_url,
          votes: recipientStats?.votes ?? 0,
          rank: recipientStats?.rank ?? null,
          percentage: recipientStats?.percentage ?? 0,
        },
      });
    }

    return NextResponse.json({
      round: round ?? null,
      totalVotes,
      leaderboard,
      previousRound: history[0] ?? null,
      history,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load leaderboard" },
      { status: 500 }
    );
  }
}

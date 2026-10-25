"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";

type Person = {
  wikidataId: string;
  name: string;
  description: string;
  image: string | null;
};

type LeaderboardPerson = Person & {
  id: number;
  slug: string;
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

type LeaderboardResponse = {
  round: { id: number; title: string | null; started_at: string } | null;
  leaderboard: LeaderboardPerson[];
  totalVotes: number;
  previousRound: HistoricalRound | null;
  history: HistoricalRound[];
};

function formatDeathDate(date: string | null) {
  if (!date) return "Date not recorded";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export default function WhosNextApp() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [searching, setSearching] = useState(false);
  const [voting, setVoting] = useState(false);
  const [message, setMessage] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse>({
    round: null,
    leaderboard: [],
    totalVotes: 0,
    previousRound: null,
    history: [],
  });

  const loadLeaderboard = useCallback(async () => {
    const response = await fetch("/api/leaderboard", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as LeaderboardResponse;
    setLeaderboard(data);
  }, []);

  useEffect(() => {
    void loadLeaderboard();
    const timer = setInterval(() => void loadLeaderboard(), 10000);
    return () => clearInterval(timer);
  }, [loadLeaderboard]);

  useEffect(() => {
    if (query.trim().length < 2 || query === selected?.name) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const response = await fetch(
          `/api/people/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Search failed");
        setResults((await response.json()) as Person[]);
      } catch (error) {
        if ((error as Error).name !== "AbortError") console.error(error);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  async function vote() {
    if (!selected) return;

    setVoting(true);
    setMessage("");

    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wikidataId: selected.wikidataId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to vote");

      setMessage(`Prediction recorded: ${selected.name}. Fate remains editable.`);
      await loadLeaderboard();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setVoting(false);
    }
  }

  const topThree = useMemo(
    () => leaderboard.leaderboard.slice(0, 3),
    [leaderboard.leaderboard]
  );

  return (
    <main className="sinister-site min-h-screen overflow-hidden">
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />

      <section className="relative mx-auto grid min-h-[72vh] max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.08fr_.92fr] lg:py-24">
        <div className="relative z-10">
          <div className="eyebrow-row mb-7">
            <span className="status-dot" />
            <span>
              {leaderboard.round?.title || "Current round"} · speculation is open
            </span>
          </div>

          <p className="ritual-kicker">A public prediction ritual</p>
          <h1 className="sinister-heading mt-4 max-w-4xl text-6xl font-black leading-[0.88] tracking-[-0.06em] sm:text-7xl lg:text-[6.6rem]">
            WHO&apos;S
            <br />
            <span className="blood-text">NEXT?</span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-stone-400 sm:text-xl">
            The crowd has its suspicions. Choose the famous name you think will
            be next to leave the mortal coil.
          </p>

          <div className="relative mt-10 max-w-2xl">
            <div className="search-shell">
              <span className="search-mark" aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected(null);
                  setMessage("");
                }}
                placeholder="Search the next likely departure…"
                className="sinister-input w-full py-5 pl-14 pr-28 text-lg outline-none"
              />
              <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-600">
                {searching ? "Searching" : "Wikidata"}
              </div>
            </div>

            {results.length > 0 && (
              <div className="search-results absolute z-30 mt-2 max-h-[430px] w-full overflow-auto">
                {results.map((person) => (
                  <button
                    key={person.wikidataId}
                    onClick={() => {
                      setSelected(person);
                      setQuery(person.name);
                      setResults([]);
                    }}
                    className="search-result-row flex w-full items-center gap-4 p-4 text-left"
                  >
                    {person.image ? (
                      <img
                        src={person.image}
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover grayscale-[20%]"
                      />
                    ) : (
                      <div className="portrait-placeholder h-14 w-14 rounded-xl" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-stone-100">{person.name}</div>
                      <div className="truncate text-sm text-stone-500">
                        {person.description || person.wikidataId}
                      </div>
                    </div>
                    <div className="ml-auto text-xl text-red-950 transition group-hover:text-red-700">→</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="selected-card mt-5 flex max-w-2xl flex-col gap-4 p-4 sm:flex-row sm:items-center">
              {selected.image ? (
                <img
                  src={selected.image}
                  alt={selected.name}
                  className="h-16 w-16 rounded-xl object-cover grayscale-[15%]"
                />
              ) : (
                <div className="portrait-placeholder h-16 w-16 rounded-xl" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
                  Your pick
                </div>
                <div className="mt-1 text-lg font-bold text-stone-100">{selected.name}</div>
                <div className="truncate text-sm text-stone-500">
                  {selected.description}
                </div>
              </div>
              <button
                onClick={vote}
                disabled={voting}
                className="sinister-button rounded-xl px-6 py-3.5 font-black disabled:opacity-50"
              >
                {voting ? "Casting…" : "Cast prediction"}
              </button>
            </div>
          )}

          {message && (
            <p className="mt-4 max-w-2xl border-l-2 border-red-800 pl-4 text-sm text-stone-400">
              {message}
            </p>
          )}
        </div>

        <div className="ominous-panel relative z-10 p-5 sm:p-6">
          <div className="pointer-events-none absolute right-5 top-4 text-[5.5rem] font-black leading-none text-white/[0.018]">
            01
          </div>

          <div className="flex items-end justify-between border-b border-white/[0.07] pb-5">
            <div>
              <p className="ritual-kicker">Live evidence</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-100">
                Most suspected
              </h2>
            </div>
            <div className="text-right">
              <div className="font-serif text-3xl font-bold text-stone-100">
                {leaderboard.totalVotes}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
                predictions
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {topThree.length === 0 && (
              <div className="empty-ritual p-10 text-center">
                <div className="text-3xl text-red-900">◌</div>
                <div className="mt-3 font-serif text-lg italic text-stone-400">
                  Nobody has been marked yet.
                </div>
                <div className="mt-1 text-sm text-stone-600">Be the first to tempt fate.</div>
              </div>
            )}

            {topThree.map((person, index) => (
              <div
                key={person.id}
                className={`leader-card ${index === 0 ? "leader-card-first" : ""} flex items-center gap-4 p-4`}
              >
                <div className="rank-number w-9 text-center text-xl font-black">
                  {String(person.rank).padStart(2, "0")}
                </div>
                {person.image ? (
                  <img
                    src={person.image}
                    alt=""
                    className="h-13 w-13 h-[52px] w-[52px] rounded-xl object-cover grayscale-[15%]"
                  />
                ) : (
                  <div className="portrait-placeholder h-[52px] w-[52px] rounded-xl" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-stone-100">{person.name}</div>
                  <div className="mt-0.5 text-xs text-stone-600">
                    {person.votes} {person.votes === 1 ? "vote" : "votes"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-xl font-bold text-stone-200">
                    {person.percentage}%
                  </div>
                  {index === 0 && (
                    <div className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-red-600">
                      Prime suspect
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-stone-600">
            <span>The internet has made its guesses.</span>
            <span className="uppercase tracking-[0.14em]">Live · 10s</span>
          </div>
        </div>
      </section>

      {leaderboard.previousRound && (
        <section className="verdict-section relative border-y border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="verdict-card relative overflow-hidden p-6 sm:p-8">
              <div className="verdict-stamp">VERDICT</div>
              <div className="relative z-10 flex flex-col gap-7 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-5">
                  {leaderboard.previousRound.recipient.image ? (
                    <img
                      src={leaderboard.previousRound.recipient.image}
                      alt={leaderboard.previousRound.recipient.name}
                      className="h-24 w-24 shrink-0 rounded-2xl object-cover grayscale-[20%]"
                    />
                  ) : (
                    <div className="portrait-placeholder h-24 w-24 shrink-0 rounded-2xl" />
                  )}

                  <div className="min-w-0">
                    <p className="ritual-kicker">Last departure · case closed</p>
                    <h2 className="mt-2 truncate font-serif text-3xl font-bold text-stone-100 sm:text-4xl">
                      The list claimed another name.
                    </h2>
                    <p className="mt-2 text-stone-400">
                      <span className="font-bold text-stone-200">
                        {leaderboard.previousRound.recipient.name}
                      </span>{" "}
                      passed away on {formatDeathDate(leaderboard.previousRound.death_date)}.
                    </p>
                    {leaderboard.previousRound.recipient.description && (
                      <p className="mt-1 truncate text-sm text-stone-600">
                        {leaderboard.previousRound.recipient.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:min-w-[300px]">
                  <div className="verdict-stat p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-600">
                      Final prediction
                    </div>
                    <div className="mt-2 font-serif text-2xl font-bold text-stone-100">
                      {leaderboard.previousRound.recipient.rank
                        ? `#${leaderboard.previousRound.recipient.rank}`
                        : "Unranked"}
                    </div>
                    <div className="mt-1 text-xs text-stone-600">
                      {leaderboard.previousRound.recipient.rank === 1
                        ? "The crowd saw it coming."
                        : "The crowd did not see it coming."}
                    </div>
                  </div>
                  <div className="verdict-stat p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-600">
                      Votes received
                    </div>
                    <div className="mt-2 font-serif text-2xl font-bold text-stone-100">
                      {leaderboard.previousRound.recipient.votes}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-red-600">
                      {leaderboard.previousRound.recipient.percentage}% of the room
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="ranking-section relative">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
          <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="ritual-kicker">The full watchlist</p>
              <h2 className="mt-2 font-serif text-4xl font-bold tracking-tight text-stone-100">
                Current ranking
              </h2>
            </div>
            <div className="max-w-sm text-sm leading-6 text-stone-600 sm:text-right">
              Rankings update automatically every 10 seconds. The mob is fickle.
            </div>
          </div>

          <div className="ranking-table overflow-hidden">
            {leaderboard.leaderboard.map((person, index) => (
              <div
                key={person.id}
                className="ranking-row grid grid-cols-[48px_1fr_auto] items-center gap-4 p-4 sm:grid-cols-[58px_64px_1fr_110px_110px] sm:px-5"
              >
                <div className={`ranking-index text-center font-black ${index === 0 ? "text-red-500" : "text-stone-600"}`}>
                  {String(person.rank).padStart(2, "0")}
                </div>
                <div className="hidden sm:block">
                  {person.image ? (
                    <img
                      src={person.image}
                      alt=""
                      className="h-12 w-12 rounded-xl object-cover grayscale-[25%]"
                    />
                  ) : (
                    <div className="portrait-placeholder h-12 w-12 rounded-xl" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-bold text-stone-200">{person.name}</div>
                  <div className="truncate text-sm text-stone-600">
                    {person.description}
                  </div>
                </div>
                <div className="hidden text-right text-sm font-semibold text-stone-500 sm:block">
                  {person.votes} {person.votes === 1 ? "vote" : "votes"}
                </div>
                <div className="text-right font-serif text-xl font-bold text-stone-200">
                  {person.percentage}%
                </div>
              </div>
            ))}

            {leaderboard.leaderboard.length === 0 && (
              <div className="p-14 text-center">
                <div className="font-serif text-xl italic text-stone-500">No names on the list yet.</div>
                <div className="mt-2 text-sm text-stone-700">Suspicion requires participation.</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {leaderboard.history.length > 0 && (
        <section className="archive-section border-t border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
            <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="ritual-kicker">The archive</p>
                <h2 className="mt-2 font-serif text-4xl font-bold tracking-tight text-stone-100">
                  Previous departures
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-stone-600 sm:text-right">
                Every completed round stays on record, along with the actual date and where the crowd had them ranked.
              </p>
            </div>

            <div className="archive-list overflow-hidden">
              {leaderboard.history.map((round) => (
                <div
                  key={round.id}
                  className="archive-row grid gap-4 p-5 sm:grid-cols-[64px_1fr_190px_120px_120px] sm:items-center"
                >
                  <div>
                    {round.recipient.image ? (
                      <img
                        src={round.recipient.image}
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover grayscale-[25%]"
                      />
                    ) : (
                      <div className="portrait-placeholder h-14 w-14 rounded-xl" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate font-bold text-stone-200">
                      {round.recipient.name}
                    </div>
                    <div className="truncate text-sm text-stone-600">
                      {round.recipient.description || round.title || `Round ${round.id}`}
                    </div>
                  </div>

                  <div>
                    <div className="archive-label">Date of death</div>
                    <div className="mt-1 font-serif font-bold text-stone-300">
                      {formatDeathDate(round.death_date)}
                    </div>
                  </div>

                  <div>
                    <div className="archive-label">Final rank</div>
                    <div className="mt-1 font-serif text-xl font-bold text-stone-300">
                      {round.recipient.rank ? `#${round.recipient.rank}` : "Unranked"}
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <div className="archive-label">Predictions</div>
                    <div className="mt-1 font-serif text-xl font-bold text-stone-300">
                      {round.recipient.votes}
                    </div>
                    <div className="text-xs text-red-700">
                      {round.recipient.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-white/[0.05] px-6 py-8 text-center text-xs text-stone-700">
        Predictions are anonymous. Mortality is not.
      </footer>
    </main>
  );
}

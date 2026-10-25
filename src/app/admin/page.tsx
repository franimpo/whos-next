"use client";

import { useEffect, useState } from "react";

type Person = {
  id: number;
  name: string;
  image: string | null;
  votes: number;
  rank: number;
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [recipientId, setRecipientId] = useState<number | "">("");
  const [deathDate, setDeathDate] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/leaderboard", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setPeople(data.leaderboard ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function resetRound() {
    if (recipientId !== "" && !deathDate) {
      setMessage("Enter the date of death first.");
      return;
    }

    if (!confirm("Close the current round and start a new one?")) return;

    setMessage("Working…");
    const response = await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password,
        recipientPersonId: recipientId === "" ? null : recipientId,
        deathDate: recipientId === "" ? null : deathDate,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Round closed. A new round is now active." : data.error || "Failed");
    if (response.ok) {
      setRecipientId("");
      setDeathDate("");
      await load();
    }
  }

  return (
    <main className="min-h-screen bg-[#080809] p-6 text-stone-100">
      <div className="mx-auto max-w-2xl py-12">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Control room</p>
        <h1 className="mt-2 font-serif text-4xl font-black">Close the case</h1>
        <p className="mt-3 max-w-xl text-stone-500">
          When someone on the list passes away, select them, record the actual date of death,
          and open a fresh round. The completed round stays in the public archive.
        </p>

        <div className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Admin password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-stone-100 outline-none focus:border-red-800"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold">Person who passed away</span>
            <select
              value={recipientId}
              onChange={(e) =>
                setRecipientId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-stone-100 outline-none focus:border-red-800"
            >
              <option value="">Unknown / not listed</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  #{person.rank} {person.name} — {person.votes} votes
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold">Date of death</span>
            <input
              type="date"
              value={deathDate}
              onChange={(e) => setDeathDate(e.target.value)}
              disabled={recipientId === ""}
              className="w-full rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-stone-100 outline-none disabled:cursor-not-allowed disabled:opacity-40 focus:border-red-800"
            />
            <span className="mt-2 block text-xs text-stone-600">
              This is the public date shown in the historical archive. It is separate from the time you close the round.
            </span>
          </label>

          <button
            onClick={resetRound}
            className="w-full rounded-xl bg-red-900 px-5 py-3 font-black text-stone-100 transition hover:bg-red-800"
          >
            Close case & start new round
          </button>

          {message && <p className="text-sm text-stone-400">{message}</p>}
        </div>
      </div>
    </main>
  );
}

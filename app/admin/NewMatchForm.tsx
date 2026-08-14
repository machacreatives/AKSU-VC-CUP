"use client";

import { useState } from "react";
import { Department, GroupId, Match } from "@/lib/types";

const GROUPS: GroupId[] = ["A", "B", "C", "D"];

const field =
  "w-full rounded-[6px] border border-line bg-surface2 px-2.5 py-1.5 text-[13.5px] text-white outline-none focus:border-accent";
const label = "text-[12px] font-semibold uppercase tracking-wide text-white";

export default function NewMatchForm({
  departments,
  onCreated,
  onClose,
}: {
  departments: Department[];
  onCreated: (match: Match) => void;
  onClose: () => void;
}) {
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [group, setGroup] = useState<GroupId>("A");
  const [round, setRound] = useState("");
  const [venue, setVenue] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Picking the home team suggests its group, since fixtures are almost always
  // within a group. Still editable for knockout ties.
  function chooseHome(id: string) {
    setHomeId(id);
    const dept = departments.find((d) => d.id === id);
    if (dept) setGroup(dept.group);
  }

  function reset() {
    setHomeId("");
    setAwayId("");
    setRound("");
    setVenue("");
    setKickoff("");
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!homeId || !awayId) return setError("Pick both teams.");
    if (homeId === awayId) return setError("A team cannot play itself.");

    setSaving(true);
    const res = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        home: { departmentId: homeId, score: 0 },
        away: { departmentId: awayId, score: 0 },
        group,
        round,
        venue,
        kickoff,
        status: "UPCOMING",
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (res.ok && body.match) {
      onCreated(body.match);
      reset();
      onClose();
    } else {
      setError(body.error ?? "Could not create the match.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-card border border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-white">New match</h3>
        <button
          type="button"
          onClick={() => {
            reset();
            onClose();
          }}
          className="text-[12.5px] font-bold text-white"
        >
          Cancel
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className={label}>Home team</span>
          <select value={homeId} onChange={(e) => chooseHome(e.target.value)} className={field}>
            <option value="">Select…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.shortName})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <span className={label}>Away team</span>
          <select value={awayId} onChange={(e) => setAwayId(e.target.value)} className={field}>
            <option value="">Select…</option>
            {departments
              .filter((d) => d.id !== homeId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.shortName})
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-1">
          <span className={label}>Group</span>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as GroupId)}
            className={field}
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                Group {g}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <span className={label}>Round</span>
          <input
            className={field}
            placeholder="Matchday 1"
            value={round}
            onChange={(e) => setRound(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <span className={label}>Venue</span>
          <input
            className={field}
            placeholder="AKSU Main Bowl, Ikot Akpaden"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <span className={label}>Kickoff (shown to viewers)</span>
          <input
            className={field}
            placeholder="Sat, 3:00 PM"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-[13px] font-medium text-loss">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-[8px] bg-accent px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create match"}
      </button>
    </form>
  );
}

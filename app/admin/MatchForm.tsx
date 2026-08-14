"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, useVenues } from "@/lib/api";
import { isoToKickoffInput } from "@/lib/kickoff";
import { Department, GroupId, Match } from "@/lib/types";
import { Banner, btnOutline, btnPrimary, fieldFull, label } from "./ui";

const GROUPS: GroupId[] = ["A", "B", "C", "D"];

/**
 * Create a fixture, or edit one that already exists.
 *
 * Both were the same form all along — a postponed match needs exactly the
 * fields that created it — so rather than a second near-copy this takes an
 * optional `match` and changes its title, its request and its button.
 */
export default function MatchForm({
  departments,
  match,
  onSaved,
  onClose,
}: {
  departments: Department[];
  match?: Match;
  onSaved: (match: Match) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const venuesQuery = useVenues();
  const venues = venuesQuery.data ?? [];

  const editing = Boolean(match);

  const [homeId, setHomeId] = useState(match?.home.departmentId ?? "");
  const [awayId, setAwayId] = useState(match?.away.departmentId ?? "");
  const [group, setGroup] = useState<GroupId>(match?.group ?? "A");
  const [round, setRound] = useState(match?.round ?? "");
  const [venue, setVenue] = useState(match?.venue ?? "");
  const [kickoffLocal, setKickoffLocal] = useState(isoToKickoffInput(match?.kickoffAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // A fixture saved before venues were a list keeps its own text, so editing it
  // does not quietly move the match to a different ground.
  const venueOptions = venue && !venues.some((v) => v.name === venue)
    ? [{ id: "__current", name: venue }, ...venues]
    : venues;

  // Picking the home team suggests its group, since fixtures are almost always
  // within a group. Still editable for knockout ties.
  function chooseHome(id: string) {
    setHomeId(id);
    const dept = departments.find((d) => d.id === id);
    if (dept) setGroup(dept.group);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!homeId || !awayId) return setError("Pick both teams.");
    if (homeId === awayId) return setError("A team cannot play itself.");
    if (!kickoffLocal) return setError("Pick the kickoff date and time.");
    if (!venue) return setError("Pick the venue.");

    setSaving(true);
    const res = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: match?.id,
        home: { departmentId: homeId, score: match?.home.score ?? 0 },
        away: { departmentId: awayId, score: match?.away.score ?? 0 },
        group,
        round,
        venue,
        kickoffLocal,
        status: match?.status ?? "UPCOMING",
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok || !body.match) {
      return setError(body.error ?? "Could not save the fixture.");
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.matches });
    if (match) queryClient.invalidateQueries({ queryKey: queryKeys.match(match.id) });
    onSaved(body.match);
    onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-premium">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-white">
          {editing ? "Edit fixture" : "New match"}
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className={label}>Home team</span>
          <select value={homeId} onChange={(e) => chooseHome(e.target.value)} className={fieldFull}>
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
          <select value={awayId} onChange={(e) => setAwayId(e.target.value)} className={fieldFull}>
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
            className={fieldFull}
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
            className={fieldFull}
            placeholder="Matchday 1"
            value={round}
            onChange={(e) => setRound(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <span className={label}>Venue</span>
          <select value={venue} onChange={(e) => setVenue(e.target.value)} className={fieldFull}>
            <option value="">Select…</option>
            {venueOptions.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
          {venues.length === 0 && !venuesQuery.isPending && (
            <p className="text-[11.5px] text-gold">
              No venues yet —{" "}
              <Link href="/admin/settings#venues" className="font-bold text-accent">
                add one in Settings
              </Link>
              .
            </p>
          )}
        </div>

        <div className="space-y-1">
          <span className={label}>Kickoff</span>
          <input
            type="datetime-local"
            className={fieldFull}
            value={kickoffLocal}
            onChange={(e) => setKickoffLocal(e.target.value)}
          />
          <p className="text-[11.5px] text-white/70">
            Local time. Change it here if the match is postponed.
          </p>
        </div>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving…" : editing ? "Save changes" : "Create match"}
        </button>
        <button type="button" onClick={onClose} className={btnOutline}>
          Cancel
        </button>
      </div>
    </form>
  );
}

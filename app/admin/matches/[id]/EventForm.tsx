"use client";

import { useEffect, useState } from "react";
import { usePlayers } from "@/lib/api";
import { computeClock, suggestedEventMinute } from "@/lib/match-clock";
import {
  Department,
  GOAL_TYPES,
  GOAL_TYPE_LABELS,
  GoalType,
  Match,
  MatchEventType,
  Player,
} from "@/lib/types";
import { Banner, btnPrimary, field } from "../../ui";

const TYPES: { id: MatchEventType; label: string }[] = [
  { id: "GOAL", label: "Goal" },
  { id: "YELLOW", label: "Yellow card" },
  { id: "RED", label: "Red card" },
  { id: "SUB", label: "Substitution" },
];

const POSITION_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 } as const;

function squadOptions(players: Player[], departmentId: string) {
  return players
    .filter((p) => p.departmentId === departmentId)
    .sort((a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.number - b.number);
}

export default function EventForm({
  match,
  home,
  away,
  ownDepartmentId = null,
  onAdded,
}: {
  match: Match;
  home: Department;
  away: Department;
  /** Null for a superadmin. A team admin records only their own team's events. */
  ownDepartmentId?: string | null;
  onAdded: () => void;
}) {
  const { data: allPlayers = [] } = usePlayers();

  const [type, setType] = useState<MatchEventType>("GOAL");
  const [deptId, setDeptId] = useState(ownDepartmentId ?? match.home.departmentId);
  const [playerId, setPlayerId] = useState("");
  const [assistId, setAssistId] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("OPEN_PLAY");
  const [subInId, setSubInId] = useState("");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // The minute follows the running clock until the operator types over it —
  // logging an event should not mean reading the clock and copying a number.
  const [now, setNow] = useState(() => Date.now());
  const [manualMinute, setManualMinute] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = computeClock(match, now);
  // Not clock.minute: that is null at half time and full time, which rendered
  // an empty field that submitted as minute 0.
  const liveMinute = suggestedEventMinute(match, now);
  const minuteValue = manualMinute ?? (liveMinute != null ? String(liveMinute) : "");

  const squad = squadOptions(allPlayers, deptId);
  const assistCandidates = squad.filter((p) => p.id !== playerId);
  const teamHasNoSquad = squad.length === 0;

  // Who can come on: the named bench for this side, and nobody else.
  //
  // This used to fall back to the whole squad when no bench had been named,
  // which defeated the point — the eleven who started are already on the pitch,
  // and offering them made it easy to record a player replacing themselves.
  // With no bench named there is nothing to pick, and the form says so.
  const side = deptId === match.home.departmentId ? match.home : match.away;
  const namedBench = (side.bench ?? [])
    .map((id) => squad.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));
  const benchIds = new Set(namedBench.map((p) => p.id));

  // Someone already brought on is on the pitch, not available to come on again.
  const cameOnAlready = new Set(
    match.events.filter((e) => e.type === "SUB" && e.subInPlayerId).map((e) => e.subInPlayerId!)
  );

  const subInCandidates = namedBench.filter(
    (p) => p.id !== playerId && !cameOnAlready.has(p.id)
  );

  // A substitute who has already come on can be taken off again later, so the
  // "going off" list is the squad minus whoever is still sitting on the bench.
  const onPitch =
    type === "SUB"
      ? squad.filter((p) => !benchIds.has(p.id) || cameOnAlready.has(p.id))
      : squad;

  // Changing team invalidates whoever was picked from the previous one.
  function chooseTeam(id: string) {
    setDeptId(id);
    setPlayerId("");
    setAssistId("");
    setSubInId("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!playerId) return setError(type === "SUB" ? "Pick the player going off." : "Pick the player.");
    if (type === "SUB" && !subInId) return setError("Pick the player coming on.");
    // An empty field is not minute zero. Number("") is 0, and 0 passed every
    // check below, so a blank minute silently became the first second of the
    // match.
    if (minuteValue.trim() === "") return setError("Enter the minute.");
    const minute = Number(minuteValue);
    if (!Number.isInteger(minute) || minute < 0) return setError("Enter the minute.");

    setSaving(true);
    const res = await fetch(`/api/admin/matches/${match.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minute,
        type,
        departmentId: deptId,
        playerId,
        assistPlayerId: type === "GOAL" && assistId ? assistId : undefined,
        goalType: type === "GOAL" ? goalType : undefined,
        subInPlayerId: type === "SUB" && subInId ? subInId : undefined,
        detail: detail || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) return setError(body.error ?? "Could not record the event.");

    // Reset for the next entry, and hand the minute back to the clock.
    setPlayerId("");
    setAssistId("");
    setSubInId("");
    setGoalType("OPEN_PLAY");
    setDetail("");
    setManualMinute(null);
    onAdded();
  }

  const teamName = (id: string) => (id === home.id ? home : away);

  return (
    <form onSubmit={submit} className="space-y-3 rounded-card border border-line bg-surface p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-white">
            Minute
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={130}
              value={minuteValue}
              onChange={(e) => setManualMinute(e.target.value)}
              placeholder="min"
              className={`${field} w-16`}
            />
            {clock.running && (
              <button
                type="button"
                onClick={() => setManualMinute(null)}
                title="Use the live match clock"
                className={`rounded-[6px] border px-2 py-1.5 text-[11.5px] font-bold transition-colors ${
                  manualMinute === null
                    ? "border-win/50 bg-win/15 text-win"
                    : "border-line bg-surface2 text-white hover:bg-surface3"
                }`}
              >
                {manualMinute === null ? `live ${clock.label}` : "use live"}
              </button>
            )}
          </div>
        </label>

        <label className="space-y-1">
          <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-white">
            Type
          </span>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as MatchEventType);
              setAssistId("");
              setSubInId("");
            }}
            className={`${field} w-32`}
          >
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-white">
            Team
          </span>
          <select
            value={deptId}
            onChange={(e) => chooseTeam(e.target.value)}
            className={`${field} w-28`}
            disabled={ownDepartmentId !== null}
          >
            {(ownDepartmentId === null || ownDepartmentId === match.home.departmentId) && (
              <option value={match.home.departmentId}>{home.shortName}</option>
            )}
            {(ownDepartmentId === null || ownDepartmentId === match.away.departmentId) && (
              <option value={match.away.departmentId}>{away.shortName}</option>
            )}
          </select>
        </label>

        <label className="min-w-[180px] flex-1 space-y-1">
          <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-white">
            {type === "SUB" ? "Player coming off" : "Player"}
          </span>
          <select
            value={playerId}
            onChange={(e) => {
              setPlayerId(e.target.value);
              if (e.target.value === assistId) setAssistId("");
            }}
            className={`${field} w-full`}
            disabled={teamHasNoSquad}
          >
            <option value="">Select player…</option>
            {onPitch.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} {p.name} ({p.position})
              </option>
            ))}
          </select>
        </label>

        {/* Every goal can have an assist, so it is captured with the goal
            rather than typed into a free-text note nothing reads. */}
        {type === "GOAL" && (
          <label className="min-w-[180px] flex-1 space-y-1">
            <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-white">
              Assist (optional)
            </span>
            <select
              value={assistId}
              onChange={(e) => setAssistId(e.target.value)}
              className={`${field} w-full`}
              disabled={teamHasNoSquad}
            >
              <option value="">No assist</option>
              {assistCandidates.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.name} ({p.position})
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Recorded as a value rather than typed into the detail note, because
            the lineup graphic marks a penalty and a free kick with their own
            symbol and cannot read prose. */}
        {type === "GOAL" && (
          <label className="space-y-1">
            <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-white">
              How
            </span>
            <select
              value={goalType}
              onChange={(e) => setGoalType(e.target.value as GoalType)}
              className={`${field} w-32`}
            >
              {GOAL_TYPES.map((g) => (
                <option key={g} value={g}>
                  {GOAL_TYPE_LABELS[g]}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* A substitution is two players, and only naming the one going off
            leaves the timeline saying somebody left the pitch and nobody
            replaced them. */}
        {type === "SUB" && (
          <label className="min-w-[180px] flex-1 space-y-1">
            <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-white">
              Player coming on
            </span>
            <select
              value={subInId}
              onChange={(e) => setSubInId(e.target.value)}
              className={`${field} w-full`}
              disabled={teamHasNoSquad || namedBench.length === 0}
            >
              <option value="">
                {namedBench.length === 0 ? "No substitutes named" : "Select player…"}
              </option>
              {subInCandidates.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.name} ({p.position})
                </option>
              ))}
            </select>
            <span className="block text-[11px] text-white/70">
              {namedBench.length === 0
                ? "Name the bench below first"
                : subInCandidates.length === 0
                ? "Everyone named has already come on"
                : `${subInCandidates.length} available on the bench`}
            </span>
          </label>
        )}

        <label className="min-w-[140px] flex-1 space-y-1">
          <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-white">
            Detail
          </span>
          <input
            placeholder={type === "GOAL" ? "Penalty, header…" : "Optional"}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            className={`${field} w-full`}
          />
        </label>

        <button type="submit" disabled={saving || teamHasNoSquad} className={btnPrimary}>
          {saving ? "Adding…" : "Add event"}
        </button>
      </div>

      {teamHasNoSquad && (
        <Banner tone="info">
          {teamName(deptId).name} has no players yet, so there is nobody to record this against. Add
          the squad first.
        </Banner>
      )}
      {type === "SUB" && !teamHasNoSquad && namedBench.length === 0 && (
        <Banner tone="info">
          {teamName(deptId).name} has no substitutes named for this match, so there is nobody to
          bring on. Use{" "}
          <a href="#substitutes" className="font-bold text-accent">
            Substitutes
          </a>{" "}
          above to pick who is on the bench — then they appear here.
        </Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}
    </form>
  );
}

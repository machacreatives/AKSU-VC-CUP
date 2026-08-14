"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, usePlayers } from "@/lib/api";
import {
  DEFAULT_FORMATION,
  FORMATIONS,
  rowLabels,
  rowsFromFormation,
} from "@/lib/formation";
import { Department, Match, Player } from "@/lib/types";
import { Banner, btnOutline, btnPrimary, btnSm, field } from "../../ui";

const POSITION_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 } as const;

/**
 * The teamsheet for one side: formation, starting eleven, captain and bench.
 *
 * The eleven is stored as an ordered array where index n is slot n on the
 * pitch, which is what the public Lineups tab draws. So this is built as one
 * picker per slot, grouped into the formation's rows, rather than a flat
 * multi-select — otherwise the order would be whatever order they were ticked
 * in and the graphic would put the goalkeeper at centre-forward.
 */
function SideEditor({
  match,
  side,
  team,
  squad,
  locked,
  onSaved,
}: {
  match: Match;
  side: "home" | "away";
  team: Department;
  squad: Player[];
  locked: boolean;
  onSaved: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const stored = match[side];

  const [formation, setFormation] = useState(stored.formation ?? DEFAULT_FORMATION);
  const [xi, setXi] = useState<string[]>(stored.startingXI ?? []);
  const [captainId, setCaptainId] = useState(stored.captainId ?? "");
  const [bench, setBench] = useState<string[]>(stored.bench ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => rowsFromFormation(formation), [formation]);
  const labels = useMemo(() => rowLabels(formation), [formation]);
  const slotCount = rows.reduce((sum, n) => sum + n, 0);

  // Changing formation keeps whoever is already picked, in order, and grows or
  // trims the list to the new shape — switching 4-4-2 to 4-3-3 should not mean
  // choosing eleven players again.
  useEffect(() => {
    setXi((prev) => {
      const next = prev.slice(0, slotCount);
      while (next.length < slotCount) next.push("");
      return next;
    });
  }, [slotCount]);

  const chosen = xi.filter(Boolean);
  const complete = chosen.length === slotCount && new Set(chosen).size === slotCount;

  // A player already on the pitch cannot fill a second slot or sit on the bench.
  const available = (slotIndex: number) =>
    squad.filter((p) => !xi.includes(p.id) || xi[slotIndex] === p.id);
  const benchCandidates = squad.filter((p) => !xi.includes(p.id));

  function setSlot(index: number, playerId: string) {
    setXi((prev) => prev.map((id, i) => (i === index ? playerId : id)));
    // Someone promoted off the bench should not still be listed on it.
    if (playerId) setBench((prev) => prev.filter((id) => id !== playerId));
    if (captainId && captainId === xi[index] && playerId !== captainId) setCaptainId("");
  }

  async function save() {
    setError("");
    setSaving(true);
    const res = await fetch(`/api/admin/matches/${match.id}/lineup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        side,
        formation,
        startingXI: xi,
        captainId: captainId || undefined,
        bench,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) return setError(body.error ?? "Could not save the teamsheet.");

    queryClient.setQueryData(queryKeys.match(match.id), body.match);
    queryClient.invalidateQueries({ queryKey: queryKeys.matches });
    setOpen(false);
    onSaved(`${team.shortName} teamsheet saved.`);
  }

  const savedCount = stored.startingXI?.length ?? 0;
  const isSet = savedCount === 11;

  let slot = -1;

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: team.color }}
          aria-hidden
        />
        <span className="text-[13.5px] font-bold text-white">{team.name}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
            isSet ? "border-win/40 bg-win/15 text-win" : "border-gold/40 bg-gold/10 text-gold"
          }`}
        >
          {isSet ? `XI set · ${stored.formation ?? DEFAULT_FORMATION}` : "No teamsheet"}
        </span>
        {locked ? (
          <span className="ml-auto text-[11.5px] font-semibold text-white/60">Locked</span>
        ) : (
          <button onClick={() => setOpen((v) => !v)} className={`${btnOutline} ${btnSm} ml-auto`}>
            {open ? "Close" : isSet ? "Edit" : "Set teamsheet"}
          </button>
        )}
      </div>

      {locked && isSet && (
        <p className="text-[12.5px] text-white/70">
          {stored.formation} · {savedCount} named
          {(stored.bench?.length ?? 0) > 0 ? ` · ${stored.bench!.length} on the bench` : ""}
        </p>
      )}

      {squad.length === 0 && !locked && (
        <Banner tone="info">
          {team.name} has no squad yet, so there is nobody to pick. Add players under Teams first.
        </Banner>
      )}

      {!open && isSet && !locked && (
        <p className="text-[12.5px] text-white/70">
          {(stored.bench?.length ?? 0) > 0
            ? `${stored.bench!.length} substitute${stored.bench!.length === 1 ? "" : "s"} named.`
            : "No substitutes named."}
          {stored.captainId &&
            ` Captain: ${squad.find((p) => p.id === stored.captainId)?.name ?? "—"}.`}
        </p>
      )}

      {open && !locked && squad.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-white">
                Formation
              </span>
              <select
                value={formation}
                onChange={(e) => setFormation(e.target.value)}
                className={`${field} w-28`}
              >
                {FORMATIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-[180px] flex-1 space-y-1">
              <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-white">
                Captain
              </span>
              <select
                value={captainId}
                onChange={(e) => setCaptainId(e.target.value)}
                className={`${field} w-full`}
              >
                <option value="">No captain</option>
                {chosen.map((id) => {
                  const p = squad.find((x) => x.id === id);
                  return p ? (
                    <option key={id} value={id}>
                      #{p.number} {p.name}
                    </option>
                  ) : null;
                })}
              </select>
            </label>

            <span
              className={`text-[12.5px] font-semibold ${complete ? "text-win" : "text-gold"}`}
            >
              {chosen.length} of {slotCount} chosen
            </span>
          </div>

          {/* One block per row of the formation, back to front — the same order
              the pitch graphic draws them in. */}
          <div className="space-y-2">
            {rows.map((count, rowIndex) => (
              <div key={rowIndex} className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">
                  {labels[rowIndex]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: count }).map(() => {
                    slot += 1;
                    const index = slot;
                    return (
                      <select
                        key={index}
                        value={xi[index] ?? ""}
                        onChange={(e) => setSlot(index, e.target.value)}
                        className={`${field} min-w-[150px] flex-1 ${
                          xi[index] ? "" : "border-gold/40"
                        }`}
                        aria-label={`${labels[rowIndex]} position ${index + 1}`}
                      >
                        <option value="">Empty</option>
                        {available(index).map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.number} {p.name} ({p.position})
                          </option>
                        ))}
                      </select>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1 border-t border-line pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">
              Substitutes {bench.length > 0 && `· ${bench.length}`}
            </p>
            {benchCandidates.length === 0 ? (
              <p className="text-[12.5px] text-white/70">
                Everyone in the squad is in the starting eleven — add more players to name a bench.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {benchCandidates.map((p) => {
                  const on = bench.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setBench((prev) =>
                          on ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                        )
                      }
                      aria-pressed={on}
                      className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                        on
                          ? "border-accent bg-accent/15 text-white"
                          : "border-line bg-surface2 text-white/80 hover:bg-surface3"
                      }`}
                    >
                      #{p.number} {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <Banner tone="error">{error}</Banner>}

          <div className="flex flex-wrap gap-2">
            <button onClick={save} disabled={saving || !complete} className={btnPrimary}>
              {saving ? "Saving…" : "Save teamsheet"}
            </button>
            <button onClick={() => setOpen(false)} className={btnOutline}>
              Cancel
            </button>
            {!complete && (
              <span className="self-center text-[12px] text-gold">
                All {slotCount} positions have to be filled.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LineupEditor({
  match,
  home,
  away,
  locked,
  ownDepartmentId = null,
  onSaved,
}: {
  match: Match;
  home: Department;
  away: Department;
  locked: boolean;
  /** Null for a superadmin, who owns both. */
  ownDepartmentId?: string | null;
  onSaved: (message: string) => void;
}) {
  const { data: allPlayers = [] } = usePlayers();

  const squadFor = (departmentId: string) =>
    allPlayers
      .filter((p) => p.departmentId === departmentId)
      .sort(
        (a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.number - b.number
      );

  const ready =
    (match.home.startingXI?.length ?? 0) === 11 && (match.away.startingXI?.length ?? 0) === 11;

  return (
    <section id="teamsheets" className="scroll-mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">Teamsheets</h2>
        <span
          className={`text-[12px] font-semibold ${
            locked ? "text-white/60" : ready ? "text-win" : "text-gold"
          }`}
        >
          {locked
            ? "Locked — the match has kicked off"
            : ready
            ? "Both sides named — ready to kick off"
            : "Needed before kick-off"}
        </span>
      </div>

      {!locked && ownDepartmentId && (
        <Banner tone="info">
          You name your own eleven. The opposition&apos;s teamsheet is theirs to set, and the match
          cannot kick off until both are in.
        </Banner>
      )}

      {locked && (
        <Banner tone="info">
          Teamsheets are fixed once a match starts, so the record of who was on the pitch cannot
          change under events already recorded. Use <strong>Reset clock</strong> on the dashboard if
          the match was started by mistake.
        </Banner>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        <SideEditor
          match={match}
          side="home"
          team={home}
          squad={squadFor(match.home.departmentId)}
          locked={locked || (ownDepartmentId !== null && ownDepartmentId !== match.home.departmentId)}
          onSaved={onSaved}
        />
        <SideEditor
          match={match}
          side="away"
          team={away}
          squad={squadFor(match.away.departmentId)}
          locked={locked || (ownDepartmentId !== null && ownDepartmentId !== match.away.departmentId)}
          onSaved={onSaved}
        />
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DeptBadge from "@/components/DeptBadge";
import { useConfirm } from "@/components/ConfirmDialog";
import { queryKeys, useDepartments, usePlayers } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  PLAYER_STATUSES,
  PLAYER_STATUS_LABELS,
  POSITIONS,
  Player,
  PlayerPosition,
  PlayerStatus,
  SQUAD_ROLES,
  SQUAD_ROLE_LABELS,
  SquadRole,
  Department,
} from "@/lib/types";
import { Skeleton, SkeletonPageHeader, SkeletonRows, SkeletonScreen } from "@/components/Skeleton";
import {
  Banner,
  EmptyState,
  Notice,
  PageHeader,
  btnOutline,
  btnPrimary,
  field,
  useNotice,
} from "../../ui";
import TeamForm from "../TeamForm";
import CsvImport from "./CsvImport";

const POSITION_ORDER: Record<PlayerPosition, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

const blankDraft = {
  name: "",
  number: "",
  position: "MF" as PlayerPosition,
  squadRole: "PLAYER" as SquadRole,
  status: "ACTIVE" as PlayerStatus,
};

export default function TeamSquadPage() {
  const params = useParams<{ id: string }>();
  const confirm = useConfirm();

  const queryClient = useQueryClient();
  const teamsQuery = useDepartments();
  const playersQuery = usePlayers();

  // Coming from the teams list, both of these are already cached — the squad
  // paints straight away instead of flashing a loader.
  const team = (teamsQuery.data ?? []).find((d) => d.id === params.id) ?? null;
  const squad = (playersQuery.data ?? [])
    .filter((pl) => pl.departmentId === params.id)
    .sort((a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.number - b.number);

  const loading = teamsQuery.isPending || playersQuery.isPending;

  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useNotice();
  const [editingTeam, setEditingTeam] = useState(false);
  const [importing, setImporting] = useState(false);

  const [draft, setDraft] = useState(blankDraft);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowDraft, setRowDraft] = useState(blankDraft);

  const error = localError || teamsQuery.error?.message || playersQuery.error?.message || "";
  const setError = setLocalError;

  const load = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.players });
    await queryClient.invalidateQueries({ queryKey: queryKeys.departments });
  };

  async function savePlayer(payload: Record<string, unknown>, onDone: () => void) {
    setError("");
    const res = await fetch("/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, departmentId: params.id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not save the player.");
      return false;
    }
    // Reload rather than patching locally: promoting a captain demotes someone
    // else server-side, so the local list would be a half-truth.
    await load();
    onDone();
    return true;
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const ok = await savePlayer(
      { ...draft, number: Number(draft.number) },
      () => setNotice(`Added ${draft.name}.`)
    );
    setAdding(false);
    if (ok) {
      setDraft(blankDraft);
      document.getElementById("new-player-number")?.focus();
    }
  }

  async function removePlayer(player: Player) {
    const ok = await confirm({
      title: `Remove ${player.name}?`,
      body: (
        <>
          <p>They are taken off the squad and out of the leaderboards.</p>
          <p>Events already recorded in matches keep their name in the timeline.</p>
        </>
      ),
      confirmLabel: "Remove player",
      busyLabel: "Removing…",
      tone: "danger",
      onConfirm: async () => {
        const res = await fetch("/api/admin/players", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: player.id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not remove the player.");
      },
    });
    if (!ok) return;
    load();
    setNotice(`Removed ${player.name}.`);
  }

  function startEdit(player: Player) {
    setEditingId(player.id);
    setRowDraft({
      name: player.name,
      number: String(player.number),
      position: player.position,
      squadRole: player.squadRole,
      status: player.status,
    });
  }

  if (loading) {
    return (
      <SkeletonScreen label="Loading squad">
        <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
          <Skeleton className="h-3.5 w-28" />
          <SkeletonPageHeader />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <SkeletonRows rows={6} />
          <Skeleton className="h-[58px] w-full rounded-card" />
        </div>
      </SkeletonScreen>
    );
  }

  if (!team) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-6">
        <Link href="/admin/teams" className="text-[13px] font-bold text-accent">
          &larr; Back to teams
        </Link>
        <Banner tone="error">This team no longer exists.</Banner>
      </div>
    );
  }

  const roleTaken = (role: SquadRole) => squad.find((p) => p.squadRole === role && p.id !== editingId);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
      <Link href="/admin/teams" className="text-[13px] font-bold text-accent">
        &larr; Back to teams
      </Link>

      <PageHeader
        title={team.name}
        subtitle={`${team.shortName} · ${team.faculty} · Group ${team.group}`}
        action={
          !editingTeam && (
            <button onClick={() => setEditingTeam(true)} className={btnOutline}>
              Edit team
            </button>
          )
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      <Notice>{notice}</Notice>

      {editingTeam && (
        <TeamForm
          team={team}
          onCancel={() => setEditingTeam(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.departments });
            setEditingTeam(false);
            setNotice("Team updated.");
          }}
        />
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <DeptBadge department={team} size={26} />
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">Squad</h2>
          <span className={`text-[12px] font-semibold ${squad.length >= 11 ? "text-white" : "text-gold"}`}>
            {squad.length} player{squad.length === 1 ? "" : "s"}
            {squad.length < 11 && " — a starting XI needs 11"}
          </span>
          {!importing && (
            <button onClick={() => setImporting(true)} className="ml-auto text-[12.5px] font-bold text-accent">
              Import CSV
            </button>
          )}
        </div>

        {importing && (
          <CsvImport
            teamId={team.id}
            teamName={team.name}
            onClose={() => setImporting(false)}
            onImported={(count) => {
              setImporting(false);
              setNotice(`Imported ${count} player${count === 1 ? "" : "s"}.`);
              load();
            }}
          />
        )}

        {squad.length === 0 ? (
          <EmptyState
            title="No players yet"
            body="Add them one at a time below, or import a whole squad from a CSV file."
          />
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-surface shadow-premium">
            {squad.map((player) => {
              const isEditing = editingId === player.id;
              return (
                <div
                  key={player.id}
                  className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 last:border-b-0"
                >
                  {isEditing ? (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={rowDraft.number}
                        onChange={(e) => setRowDraft({ ...rowDraft, number: e.target.value })}
                        className={`${field} w-16`}
                      />
                      <input
                        value={rowDraft.name}
                        onChange={(e) => setRowDraft({ ...rowDraft, name: e.target.value })}
                        className={`${field} min-w-[150px] flex-1`}
                      />
                      <select
                        value={rowDraft.position}
                        onChange={(e) => setRowDraft({ ...rowDraft, position: e.target.value as PlayerPosition })}
                        className={`${field} w-20`}
                      >
                        {POSITIONS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <select
                        value={rowDraft.squadRole}
                        onChange={(e) => setRowDraft({ ...rowDraft, squadRole: e.target.value as SquadRole })}
                        className={`${field} w-32`}
                      >
                        {SQUAD_ROLES.map((r) => (
                          <option key={r} value={r}>{SQUAD_ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      <select
                        value={rowDraft.status}
                        onChange={(e) => setRowDraft({ ...rowDraft, status: e.target.value as PlayerStatus })}
                        className={`${field} w-28`}
                      >
                        {PLAYER_STATUSES.map((s) => (
                          <option key={s} value={s}>{PLAYER_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          savePlayer(
                            { id: player.id, ...rowDraft, number: Number(rowDraft.number) },
                            () => {
                              setEditingId(null);
                              setNotice("Player updated.");
                            }
                          )
                        }
                        className="text-[12.5px] font-bold text-accent"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-[12.5px] font-bold text-white">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="tabular w-8 text-[14px] font-bold text-white">{player.number}</span>
                      <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-white">
                        {player.name}
                      </span>
                      <span className="rounded-[4px] bg-surface2 px-1.5 py-0.5 text-[11px] font-bold text-white">
                        {player.position}
                      </span>
                      {player.squadRole !== "PLAYER" && (
                        <span className="rounded-[4px] bg-gold/20 px-1.5 py-0.5 text-[11px] font-bold text-gold">
                          {player.squadRole === "CAPTAIN" ? "C" : "VC"}
                        </span>
                      )}
                      {player.status !== "ACTIVE" && (
                        <span className="rounded-[4px] bg-loss/15 px-1.5 py-0.5 text-[11px] font-bold text-loss">
                          {PLAYER_STATUS_LABELS[player.status]}
                        </span>
                      )}
                      <button onClick={() => startEdit(player)} className="text-[12.5px] font-bold text-accent">
                        Edit
                      </button>
                      <button onClick={() => removePlayer(player)} className="text-[12px] font-bold text-loss">
                        Remove
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add form stays open and refocuses, so a squad can be typed in one go */}
        <form onSubmit={addPlayer} className="flex flex-wrap items-end gap-2 rounded-card border border-line bg-surface p-3">
          <input
            id="new-player-number"
            type="number"
            min={1}
            max={99}
            placeholder="#"
            value={draft.number}
            onChange={(e) => setDraft({ ...draft, number: e.target.value })}
            className={`${field} w-16`}
          />
          <input
            placeholder="Player name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className={`${field} min-w-[160px] flex-1`}
          />
          <select
            value={draft.position}
            onChange={(e) => setDraft({ ...draft, position: e.target.value as PlayerPosition })}
            className={`${field} w-20`}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={draft.squadRole}
            onChange={(e) => setDraft({ ...draft, squadRole: e.target.value as SquadRole })}
            className={`${field} w-32`}
          >
            {SQUAD_ROLES.map((r) => (
              <option key={r} value={r}>{SQUAD_ROLE_LABELS[r]}</option>
            ))}
          </select>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as PlayerStatus })}
            className={`${field} w-28`}
          >
            {PLAYER_STATUSES.map((s) => (
              <option key={s} value={s}>{PLAYER_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button type="submit" disabled={adding} className={btnPrimary}>
            {adding ? "Adding…" : "Add player"}
          </button>
        </form>

        {draft.squadRole !== "PLAYER" && roleTaken(draft.squadRole) && (
          <p className="px-1 text-[12.5px] text-gold">
            {roleTaken(draft.squadRole)!.name} is currently {SQUAD_ROLE_LABELS[draft.squadRole].toLowerCase()} and
            will be moved back to player.
          </p>
        )}
      </section>
    </div>
  );
}

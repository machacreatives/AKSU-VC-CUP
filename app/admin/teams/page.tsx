"use client";

import { useState } from "react";
import Link from "next/link";
import DeptBadge from "@/components/DeptBadge";
import { useConfirm } from "@/components/ConfirmDialog";
import { queryKeys, useDepartments, usePlayers } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { CAMPUS_GROUPS, CAMPUS_LABELS, Campus, Department, Player } from "@/lib/types";
import { Skeleton, SkeletonPageHeader, SkeletonRows, SkeletonScreen } from "@/components/Skeleton";
import { Banner, EmptyState, Notice, PageHeader, btnDanger, btnPrimary, btnSm, useNotice } from "../ui";
import TeamForm from "./TeamForm";

const CAMPUSES: Campus[] = ["main", "obioakpa"];

export default function TeamsPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const teamsQuery = useDepartments();
  const playersQuery = usePlayers();

  const teams: Department[] = teamsQuery.data ?? [];
  const players: Player[] = playersQuery.data ?? [];
  // Only the very first visit has nothing cached; after that the list is
  // painted immediately and refreshed quietly in the background.
  const loading = teamsQuery.isPending || playersQuery.isPending;
  const queryError = teamsQuery.error?.message ?? playersQuery.error?.message ?? "";

  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useNotice();
  const [creating, setCreating] = useState(false);
  const error = localError || queryError;
  const setError = setLocalError;

  function squadSize(teamId: string) {
    return players.filter((p) => p.departmentId === teamId).length;
  }

  async function removeTeam(team: Department) {
    const size = squadSize(team.id);
    const ok = await confirm({
      title: `Delete ${team.name}?`,
      body: (
        <>
          <p>
            {size > 0
              ? `Its ${size} player${size === 1 ? "" : "s"} will be deleted with it.`
              : "This team has no players."}
          </p>
          <p>This cannot be undone.</p>
        </>
      ),
      confirmLabel: "Delete team",
      busyLabel: "Deleting…",
      tone: "danger",
      onConfirm: async () => {
        const res = await fetch("/api/admin/departments", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: team.id }),
        });
        const body = await res.json().catch(() => ({}));
        // A team with fixtures is refused by the API; surfacing the message in
        // the dialog keeps it attached to the action that failed.
        if (!res.ok) throw new Error(body.error ?? "Could not delete the team.");
      },
    });
    if (!ok) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.departments });
    queryClient.invalidateQueries({ queryKey: queryKeys.players });
    setNotice(`Deleted ${team.name}.`);
  }

  if (loading) {
    return (
      <SkeletonScreen label="Loading teams">
        <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
          <SkeletonPageHeader />
          {[0, 1].map((campus) => (
            <div key={campus} className="space-y-3">
              <Skeleton className="h-3.5 w-32" />
              {[0, 1].map((group) => (
                <div key={group} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <div className="grid min-w-0 gap-2 lg:grid-cols-2">
                    <SkeletonRows rows={2} />
                    <SkeletonRows rows={2} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </SkeletonScreen>
    );
  }

  const unassigned = teams.filter((t) => !CAMPUS_GROUPS[t.campus]?.includes(t.group));

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
      <PageHeader
        title="Teams"
        subtitle="Every fixture, table and squad starts from a team."
        action={
          !creating && (
            <button onClick={() => setCreating(true)} className={btnPrimary}>
              + New team
            </button>
          )
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      <Notice>{notice}</Notice>

      {creating && (
        <TeamForm
          onCancel={() => setCreating(false)}
          onSaved={(team) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.departments });
            setNotice(`Created ${team.name}.`);
            setCreating(false);
          }}
        />
      )}

      {teams.length === 0 && !creating && (
        <EmptyState
          title="No teams yet"
          body="Add the departments taking part. You can then build their squads and create fixtures between them."
          action={
            <button onClick={() => setCreating(true)} className={btnPrimary}>
              + New team
            </button>
          }
        />
      )}

      {unassigned.length > 0 && (
        <Banner tone="info">
          {unassigned.length} team{unassigned.length === 1 ? " is" : "s are"} in a group that does not
          belong to their campus, so they show under the wrong campus on the public table.{" "}
          <Link href="/admin/table" className="font-bold text-accent">
            Fix in Groups
          </Link>
        </Banner>
      )}

      {CAMPUSES.map((campus) => {
        const campusTeams = teams.filter((t) => t.campus === campus);
        if (campusTeams.length === 0) return null;

        return (
          <section key={campus} className="min-w-0 space-y-3">
            <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-accent">
              {CAMPUS_LABELS[campus]}
            </h2>

            {CAMPUS_GROUPS[campus].map((group) => {
              const groupTeams = campusTeams.filter((t) => t.group === group);
              return (
                <div key={group} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-white">
                      Group {group}
                    </h3>
                    <span
                      className={`text-[11.5px] font-semibold ${
                        groupTeams.length === 4 ? "text-white" : "text-gold"
                      }`}
                    >
                      {groupTeams.length} team{groupTeams.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {groupTeams.length === 0 ? (
                    <p className="px-1 text-[13px] text-white">No teams in this group yet.</p>
                  ) : (
                    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                      {groupTeams.map((team) => {
                        const size = squadSize(team.id);
                        return (
                          <article
                            key={team.id}
                            className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-3.5 shadow-premium transition-colors hover:border-white/15"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              {/* The team's colour is its identity in every
                                  table and card, so it leads here too. */}
                              <DeptBadge department={team} size={34} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-bold text-white">
                                  {team.name}
                                </p>
                                <p className="truncate text-[12px] text-white/70">
                                  {team.shortName}
                                  {team.faculty ? ` · ${team.faculty}` : ""}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-bold ${
                                  size >= 11
                                    ? "border-line bg-surface2 text-white"
                                    : "border-gold/40 bg-gold/10 text-gold"
                                }`}
                                title={
                                  size >= 11
                                    ? "Enough players for a starting eleven"
                                    : "Fewer than eleven players"
                                }
                              >
                                {size} player{size === 1 ? "" : "s"}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                              <Link
                                href={`/admin/teams/${team.id}`}
                                className={`${btnPrimary} ${btnSm}`}
                              >
                                Manage squad
                              </Link>
                              <button
                                onClick={() => removeTeam(team)}
                                className={`${btnDanger} ${btnSm} ml-auto`}
                              >
                                Delete
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

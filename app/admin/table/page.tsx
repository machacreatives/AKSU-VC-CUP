"use client";

import { useState } from "react";
import Link from "next/link";
import DeptBadge from "@/components/DeptBadge";
import { CAMPUS_GROUPS, CAMPUS_LABELS, Campus, Department, GroupId } from "@/lib/types";
import { Skeleton, SkeletonPageHeader, SkeletonScreen } from "@/components/Skeleton";
import { queryKeys, useDepartments } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Banner, EmptyState, PageHeader, field } from "../ui";

const CAMPUSES: Campus[] = ["main", "obioakpa"];

export default function GroupsPage() {
  const queryClient = useQueryClient();
  const teamsQuery = useDepartments();
  const teams: Department[] = teamsQuery.data ?? [];
  const loading = teamsQuery.isPending;

  const [localError, setLocalError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const error = localError || (teamsQuery.error?.message ?? "");
  const setError = setLocalError;

  // Each change saves on its own. There is no Save button because there is no
  // batch to get half-written: one team, one assignment, one request.
  async function assign(team: Department, patch: { campus?: Campus; group?: GroupId }) {
    const campus = patch.campus ?? team.campus;
    // Moving campus has to move the group too, or the team lands in a group
    // that belongs to the other campus and renders under the wrong heading.
    const group =
      patch.group ?? (CAMPUS_GROUPS[campus].includes(team.group) ? team.group : CAMPUS_GROUPS[campus][0]);

    const updated = { ...team, campus, group };
    const writeTeam = (next: Department) =>
      queryClient.setQueryData<Department[]>(queryKeys.departments, (prev) =>
        (prev ?? []).map((t) => (t.id === next.id ? next : t))
      );

    writeTeam(updated); // optimistic
    setSavingId(team.id);
    setError("");

    const res = await fetch("/api/admin/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    const body = await res.json().catch(() => ({}));
    setSavingId(null);

    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments });
    } else {
      setError(body.error ?? "Could not move the team.");
      writeTeam(team); // roll back
    }
  }

  if (loading) {
    return (
      <SkeletonScreen label="Loading groups">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
          <SkeletonPageHeader />
          <div className="grid gap-5 lg:grid-cols-2">
            {[0, 1].map((campus) => (
              <div key={campus} className="space-y-3">
                <Skeleton className="h-3.5 w-32" />
                {[0, 1].map((group) => (
                  <div key={group} className="space-y-2 rounded-card border border-line bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                    {[0, 1, 2, 3].map((row) => (
                      <div key={row} className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-3.5 flex-1" />
                        <Skeleton className="h-8 w-28 rounded-[6px]" />
                        <Skeleton className="h-8 w-20 rounded-[6px]" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </SkeletonScreen>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
      <PageHeader
        title="Groups"
        subtitle="Which teams play in which group, on each campus. Changes save as you make them."
      />

      {error && <Banner tone="error">{error}</Banner>}

      {teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          body="Add teams first — then you can arrange them into groups here."
          action={
            <Link href="/admin/teams" className="text-[13px] font-bold text-accent">
              Go to Teams &rarr;
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {CAMPUSES.map((campus) => (
            <section key={campus} className="min-w-0 space-y-3">
              <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-accent">
                {CAMPUS_LABELS[campus]}
              </h2>

              {CAMPUS_GROUPS[campus].map((group) => {
                const groupTeams = teams.filter((t) => t.campus === campus && t.group === group);
                return (
                  <div key={group} className="space-y-2 rounded-card border border-line bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-white">
                        Group {group}
                      </h3>
                      <span
                        className={`text-[11.5px] font-semibold ${
                          groupTeams.length === 4 ? "text-white" : "text-gold"
                        }`}
                      >
                        {groupTeams.length} of 4
                      </span>
                    </div>

                    {groupTeams.length === 0 && (
                      <p className="text-[12.5px] text-white">Empty.</p>
                    )}

                    {groupTeams.map((team) => (
                      <div key={team.id} className="flex flex-wrap items-center gap-2">
                        <DeptBadge department={team} size={24} />
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">
                          {team.name}
                        </span>
                        {savingId === team.id && (
                          <span className="shrink-0 text-[11px] text-white">saving…</span>
                        )}
                        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                          <select
                            value={team.campus}
                            onChange={(e) => assign(team, { campus: e.target.value as Campus })}
                            className={`${field} min-w-0 flex-1 sm:w-28 sm:flex-none`}
                            aria-label={`Campus for ${team.name}`}
                          >
                            {CAMPUSES.map((c) => (
                              <option key={c} value={c}>
                                {c === "main" ? "Main" : "Obio Akpa"}
                              </option>
                            ))}
                          </select>
                          <select
                            value={team.group}
                            onChange={(e) => assign(team, { group: e.target.value as GroupId })}
                            className={`${field} min-w-0 flex-1 sm:w-20 sm:flex-none`}
                            aria-label={`Group for ${team.name}`}
                          >
                            {CAMPUS_GROUPS[team.campus].map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}

      <Banner tone="info">
        The public Table tab shows Groups A and B under Main Campus, and C and D under Obio Akpa. A team
        can only be placed in a group belonging to its own campus.
      </Banner>
    </div>
  );
}

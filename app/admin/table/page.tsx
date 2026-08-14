"use client";

import { useState } from "react";
import Link from "next/link";
import DeptBadge from "@/components/DeptBadge";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  CAMPUSES,
  CAMPUS_LABELS,
  Campus,
  Department,
  Group,
  GroupId,
  groupsForCampus,
} from "@/lib/types";
import { Skeleton, SkeletonPageHeader, SkeletonScreen } from "@/components/Skeleton";
import { queryKeys, useDepartments, useGroups } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Banner, EmptyState, Notice, PageHeader, RequireSuperadmin, btnDanger, btnOutline, btnPrimary, btnSm, field, useNotice } from "../ui";
import GroupForm from "./GroupForm";

function GroupsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const teamsQuery = useDepartments();
  const groupsQuery = useGroups();

  const teams: Department[] = teamsQuery.data ?? [];
  const groups: Group[] = groupsQuery.data ?? [];
  const loading = teamsQuery.isPending || groupsQuery.isPending;

  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useNotice();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<Campus | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const error = localError || teamsQuery.error?.message || groupsQuery.error?.message || "";
  const setError = setLocalError;

  const refreshGroups = () => queryClient.invalidateQueries({ queryKey: queryKeys.groups });
  const refreshTeams = () => queryClient.invalidateQueries({ queryKey: queryKeys.departments });

  // Each change saves on its own. There is no Save button because there is no
  // batch to get half-written: one team, one assignment, one request.
  async function assign(team: Department, patch: { campus?: Campus; group?: GroupId }) {
    const campus = patch.campus ?? team.campus;
    // Moving campus has to move the group too, or the team lands in a group
    // that belongs to the other campus and renders under the wrong heading.
    const campusGroups = groupsForCampus(groups, campus);
    const group =
      patch.group ??
      (campusGroups.some((g) => g.id === team.group) ? team.group : campusGroups[0]?.id);

    if (!group) {
      return setError(
        `${CAMPUS_LABELS[campus]} has no groups yet — create one before moving teams there.`
      );
    }

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

    if (res.ok) refreshTeams();
    else {
      setError(body.error ?? "Could not move the team.");
      writeTeam(team); // roll back
    }
  }

  async function removeGroup(group: Group) {
    const members = teams.filter((t) => t.group === group.id);
    const siblings = groupsForCampus(groups, group.campus).filter((g) => g.id !== group.id);

    // Nowhere for the teams to go. Say so plainly rather than opening a
    // confirmation whose only honest button is "cancel".
    if (members.length > 0 && siblings.length === 0) {
      setError(
        `Group ${group.name} holds ${members.length} team${
          members.length === 1 ? "" : "s"
        } and is the only group on ${CAMPUS_LABELS[group.campus]}. Create another group there first, or move those teams to the other campus.`
      );
      return;
    }

    // With teams still in it the delete would be refused, so offer the only
    // thing that makes it possible: send them somewhere else on the way out.
    const moveTo = members.length > 0 ? siblings[0].id : "";

    const ok = await confirm({
      title: `Delete Group ${group.name}?`,
      body:
        members.length === 0 ? (
          <p>It has no teams in it, so nothing else changes.</p>
        ) : (
          <>
            <p>
              Its {members.length} team{members.length === 1 ? "" : "s"} will move to{" "}
              <strong>Group {siblings[0].name}</strong>, along with any fixtures recorded under it.
            </p>
            <p className="text-white/70">{members.map((t) => t.shortName).join(", ")}</p>
          </>
        ),
      confirmLabel: members.length > 0 ? "Move teams and delete" : "Delete group",
      busyLabel: "Deleting…",
      tone: "danger",
      onConfirm: async () => {
        const res = await fetch("/api/admin/groups", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: group.id, moveTo: moveTo || undefined }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not delete the group.");
      },
    });
    if (!ok) return;

    refreshGroups();
    refreshTeams();
    setNotice(`Deleted Group ${group.name}.`);
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
        subtitle="Create the groups the tournament is played in, and arrange the teams inside them."
        action={
          !creatingFor &&
          !editingGroup && (
            <button onClick={() => setCreatingFor("main")} className={btnPrimary}>
              + New group
            </button>
          )
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      <Notice>{notice}</Notice>

      {(creatingFor || editingGroup) && (
        <GroupForm
          group={editingGroup ?? undefined}
          defaultCampus={creatingFor ?? undefined}
          existing={groups}
          onClose={() => {
            setCreatingFor(null);
            setEditingGroup(null);
          }}
          onSaved={(g, created) =>
            setNotice(created ? `Created Group ${g.name}.` : `Renamed to Group ${g.name}.`)
          }
        />
      )}

      {groups.length === 0 && !creatingFor ? (
        <EmptyState
          title="No groups yet"
          body="A group is where teams are drawn and the table is counted. Create one for each campus, then place the teams."
          action={
            <button onClick={() => setCreatingFor("main")} className={btnPrimary}>
              + New group
            </button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {CAMPUSES.map((campus) => {
            const campusGroups = groupsForCampus(groups, campus);

            return (
              <section key={campus} className="min-w-0 space-y-3">
                <div className="flex items-center justify-between gap-2 px-1">
                  <h2 className="text-[13px] font-bold uppercase tracking-wide text-accent">
                    {CAMPUS_LABELS[campus]}
                  </h2>
                  <button
                    onClick={() => {
                      setEditingGroup(null);
                      setCreatingFor(campus);
                    }}
                    className={`${btnOutline} ${btnSm}`}
                  >
                    + Group
                  </button>
                </div>

                {campusGroups.length === 0 && (
                  <p className="rounded-card border border-line bg-surface px-3 py-4 text-[13px] text-white/70">
                    No groups on this campus yet.
                  </p>
                )}

                {campusGroups.map((group) => {
                  const groupTeams = teams.filter(
                    (t) => t.campus === campus && t.group === group.id
                  );
                  return (
                    <div
                      key={group.id}
                      className="space-y-2 rounded-card border border-line bg-surface p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-white">
                          Group {group.name}
                        </h3>
                        <span
                          className={`text-[11.5px] font-semibold ${
                            groupTeams.length === 4 ? "text-white/70" : "text-gold"
                          }`}
                        >
                          {groupTeams.length} team{groupTeams.length === 1 ? "" : "s"}
                        </span>
                        <div className="ml-auto flex gap-1.5">
                          <button
                            onClick={() => {
                              setCreatingFor(null);
                              setEditingGroup(group);
                            }}
                            className={`${btnOutline} ${btnSm}`}
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => removeGroup(group)}
                            className={`${btnDanger} ${btnSm}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {groupTeams.length === 0 && (
                        <p className="text-[12.5px] text-white/70">Empty.</p>
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
                              onChange={(e) => assign(team, { group: e.target.value })}
                              className={`${field} min-w-0 flex-1 sm:w-24 sm:flex-none`}
                              aria-label={`Group for ${team.name}`}
                            >
                              {groupsForCampus(groups, team.campus).map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
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
            );
          })}
        </div>
      )}

      <Banner tone="info">
        A group belongs to one campus, and a team can only be placed in a group on its own campus.
        The public Table tab shows each campus with its groups underneath, and the{" "}
        <Link href="/admin/standings" className="font-bold text-accent">
          Tables
        </Link>{" "}
        page counts them from results.
      </Banner>
    </div>
  );
}

// Fixtures, groups, tables and the team list belong to whoever runs the
// tournament. A team admin who reaches this URL gets an explanation.
export default function Guarded() {
  return (
    <RequireSuperadmin>
      <GroupsPage />
    </RequireSuperadmin>
  );
}

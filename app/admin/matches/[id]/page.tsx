"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Match, MatchEvent, Department } from "@/lib/types";
import { Skeleton, SkeletonRows, SkeletonScreen } from "@/components/Skeleton";
import { queryKeys, useDepartments, useMatch } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminMatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const matchQuery = useMatch(params.id);
  const departmentsQuery = useDepartments();

  const match = matchQuery.data ?? null;
  const departments: Department[] = departmentsQuery.data ?? [];

  const [minute, setMinute] = useState("");
  const [type, setType] = useState<MatchEvent["type"]>("GOAL");
  const [deptId, setDeptId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [detail, setDetail] = useState("");
  const [localError, setLocalError] = useState("");

  const error = localError || matchQuery.error?.message || departmentsQuery.error?.message || "";
  const setError = setLocalError;

  // Adding or removing an event changes this match and, once scores derive from
  // events, the list too — so both caches are refreshed.
  const load = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.match(params.id) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.matches });
  };

  // The team select defaults to the home side once the match arrives.
  useEffect(() => {
    if (match && !deptId) setDeptId(match.home.departmentId);
  }, [match, deptId]);

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!minute || !playerName || !deptId) return;
    await fetch(`/api/admin/matches/${params.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minute: Number(minute), type, departmentId: deptId, playerName, detail: detail || undefined }),
    });
    setMinute("");
    setPlayerName("");
    setDetail("");
    load();
  }

  async function removeEvent(eventId: number) {
    await fetch(`/api/admin/matches/${params.id}/events`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    load();
  }

  if (error)
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-6">
        <Link href="/admin" className="text-[13px] font-bold text-accent">&larr; Back to dashboard</Link>
        <p className="rounded-card border border-loss/40 bg-loss/10 px-3 py-2 text-[13.5px] text-white">{error}</p>
      </div>
    );

  if (!match) {
    return (
      <SkeletonScreen label="Loading match">
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-[54px] w-full rounded-card" />
          <Skeleton className="h-3.5 w-20" />
          <SkeletonRows rows={4} />
        </div>
      </SkeletonScreen>
    );
  }

  function deptName(id: string) {
    return departments.find((d) => d.id === id)?.shortName ?? id;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
      <Link href="/admin" className="text-[13px] font-bold text-accent">&larr; Back to dashboard</Link>
      <h1 className="text-[18px] font-extrabold text-white lg:text-[22px]">
        {deptName(match.home.departmentId)} {match.home.score} - {match.away.score} {deptName(match.away.departmentId)}
      </h1>

      <section className="space-y-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">Add event</h2>
        <form onSubmit={addEvent} className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-3">
          <input
            type="number"
            placeholder="min"
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            className="w-16 rounded-[6px] border border-line bg-surface2 px-2 py-1 text-[13px] text-white"
          />
          <select value={type} onChange={(e) => setType(e.target.value as MatchEvent["type"])} className="rounded-[6px] border border-line bg-surface2 px-2 py-1 text-[13px] text-white">
            <option value="GOAL">GOAL</option>
            <option value="YELLOW">YELLOW</option>
            <option value="RED">RED</option>
            <option value="SUB">SUB</option>
          </select>
          <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="rounded-[6px] border border-line bg-surface2 px-2 py-1 text-[13px] text-white">
            <option value={match.home.departmentId}>{deptName(match.home.departmentId)}</option>
            <option value={match.away.departmentId}>{deptName(match.away.departmentId)}</option>
          </select>
          <input
            placeholder="Player name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="min-w-[140px] flex-1 rounded-[6px] border border-line bg-surface2 px-2 py-1 text-[13px] text-white"
          />
          <input
            placeholder="Detail (optional)"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            className="min-w-[140px] flex-1 rounded-[6px] border border-line bg-surface2 px-2 py-1 text-[13px] text-white"
          />
          <button type="submit" className="rounded-[6px] bg-accent px-3 py-1.5 text-[13px] font-bold text-white">
            Add
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">Events</h2>
        <div className="divide-y divide-line rounded-card border border-line bg-surface">
          {match.events.map((e, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-[13.5px] text-white">
              <span>{e.minute}&apos; &mdash; {e.type} &mdash; {e.playerName} ({deptName(e.departmentId)}){e.detail ? ` \u2014 ${e.detail}` : ""}</span>
              <button
                onClick={() => e.id != null && removeEvent(e.id)}
                className="text-[12px] font-bold text-loss"
              >
                Remove
              </button>
            </div>
          ))}
          {match.events.length === 0 && <p className="px-3 py-4 text-[13.5px] text-white">No events yet.</p>}
        </div>
      </section>
    </div>
  );
}

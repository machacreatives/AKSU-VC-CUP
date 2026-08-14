"use client";

import Link from "next/link";
import { StandingsRow } from "@/lib/types";
import { useDepartmentLookup } from "@/lib/data-context";
import DeptBadge from "./DeptBadge";
import FormGuide from "./FormGuide";

export default function StandingsTable({ rows, title }: { rows: StandingsRow[]; title?: string }) {
  const getDepartment = useDepartmentLookup();

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-premium">
      {title && (
        <div className="border-b border-line bg-surface2 px-3 py-2">
          <span className="text-[13px] font-extrabold uppercase tracking-wide text-accent">{title}</span>
        </div>
      )}
      <div className="grid grid-cols-[1.4rem_1fr_1.6rem_1.6rem_1.6rem_1.6rem_2.2rem_2.4rem] lg:grid-cols-[2rem_1fr_2.6rem_2.6rem_2.6rem_2.6rem_3.2rem_3.4rem_5.5rem] items-center gap-1 border-b border-line px-3 py-2 text-[11.5px] font-bold uppercase tracking-wide text-white lg:px-4">
        <span>#</span>
        <span>Department</span>
        <span className="text-center">P</span>
        <span className="text-center">W</span>
        <span className="text-center">D</span>
        <span className="text-center">L</span>
        <span className="text-center">GD</span>
        <span className="text-center">Pts</span>
        <span className="hidden text-center lg:block">Form</span>
      </div>
      {/* A group with no teams in it yet — now possible, since groups can be
          created before the draw. Without this the card is a header row and
          nothing else, which reads as a table that failed to load. */}
      {rows.length === 0 && (
        <p className="px-3 py-5 text-center text-[13.5px] text-white/70 lg:px-4">
          No teams in this group yet.
        </p>
      )}
      {rows.map((row, i) => {
        const d = getDepartment(row.departmentId);
        const gd = row.goalsFor - row.goalsAgainst;
        return (
          <div
            key={row.departmentId}
            className={`grid grid-cols-[1.4rem_1fr_1.6rem_1.6rem_1.6rem_1.6rem_2.2rem_2.4rem] lg:grid-cols-[2rem_1fr_2.6rem_2.6rem_2.6rem_2.6rem_3.2rem_3.4rem_5.5rem] items-center gap-1 px-3 py-2.5 text-[14.5px] ${
              i !== rows.length - 1 ? "border-b border-line" : ""
            } ${i % 2 === 1 ? "bg-white/[0.02]" : ""} lg:px-4 lg:py-3`}
          >
            <span className="tabular font-bold text-white">{i + 1}</span>
            {/* The table is where people look a team up, so it is the natural
                way into that team's profile. */}
            <Link
              href={`/team/${d.id}`}
              className="flex min-w-0 items-center gap-2 hover:underline"
            >
              <DeptBadge department={d} size={20} />
              <span className="truncate font-semibold text-white">{d.shortName}</span>
              <span className="sr-only">{d.name} team profile</span>
            </Link>
            <span className="tabular text-center text-white">{row.played}</span>
            <span className="tabular text-center text-white">{row.won}</span>
            <span className="tabular text-center text-white">{row.drawn}</span>
            <span className="tabular text-center text-white">{row.lost}</span>
            <span className="tabular text-center text-white">{gd > 0 ? `+${gd}` : gd}</span>
            <span className="tabular text-center text-[15.5px] font-extrabold text-white">{row.points}</span>
            <FormGuide
                form={row.form}
                className="hidden items-center justify-center gap-[3px] lg:flex"
                emptyClassName="hidden text-center text-[12px] text-white/30 lg:block"
              />
          </div>
        );
      })}
    </div>
  );
}

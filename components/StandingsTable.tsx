"use client";

import { StandingsRow } from "@/lib/types";
import { useDepartmentLookup } from "@/lib/data-context";
import DeptBadge from "./DeptBadge";

export default function StandingsTable({ rows, title }: { rows: StandingsRow[]; title?: string }) {
  const getDepartment = useDepartmentLookup();

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-premium">
      {title && (
        <div className="border-b border-line bg-surface2 px-3 py-2">
          <span className="text-[13px] font-extrabold uppercase tracking-wide text-accent">{title}</span>
        </div>
      )}
      <div className="grid grid-cols-[1.4rem_1fr_1.6rem_1.6rem_1.6rem_1.6rem_2.2rem_2.4rem] lg:grid-cols-[2rem_1fr_2.6rem_2.6rem_2.6rem_2.6rem_3.2rem_3.4rem] items-center gap-1 border-b border-line px-3 py-2 text-[11.5px] font-bold uppercase tracking-wide text-white lg:px-4">
        <span>#</span>
        <span>Department</span>
        <span className="text-center">P</span>
        <span className="text-center">W</span>
        <span className="text-center">D</span>
        <span className="text-center">L</span>
        <span className="text-center">GD</span>
        <span className="text-center">Pts</span>
      </div>
      {rows.map((row, i) => {
        const d = getDepartment(row.departmentId);
        const gd = row.goalsFor - row.goalsAgainst;
        return (
          <div
            key={row.departmentId}
            className={`grid grid-cols-[1.4rem_1fr_1.6rem_1.6rem_1.6rem_1.6rem_2.2rem_2.4rem] lg:grid-cols-[2rem_1fr_2.6rem_2.6rem_2.6rem_2.6rem_3.2rem_3.4rem] items-center gap-1 px-3 py-2.5 text-[14.5px] ${
              i !== rows.length - 1 ? "border-b border-line" : ""
            } ${i % 2 === 1 ? "bg-white/[0.02]" : ""} lg:px-4 lg:py-3`}
          >
            <span className="tabular font-bold text-white">{i + 1}</span>
            <span className="flex min-w-0 items-center gap-2">
              <DeptBadge department={d} size={20} />
              <span className="truncate font-semibold text-white">{d.shortName}</span>
            </span>
            <span className="tabular text-center text-white">{row.played}</span>
            <span className="tabular text-center text-white">{row.won}</span>
            <span className="tabular text-center text-white">{row.drawn}</span>
            <span className="tabular text-center text-white">{row.lost}</span>
            <span className="tabular text-center text-white">{gd > 0 ? `+${gd}` : gd}</span>
            <span className="tabular text-center text-[15.5px] font-extrabold text-white">{row.points}</span>
          </div>
        );
      })}
    </div>
  );
}

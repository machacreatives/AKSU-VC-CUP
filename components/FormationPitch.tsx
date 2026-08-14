"use client";

import { Department, Match } from "@/lib/types";
import { usePlayerLookup } from "@/lib/data-context";
import { layoutFormation } from "@/lib/formation";
import { MARKS, PlayerMarks, buildPlayerMarks, marksFor } from "@/lib/player-marks";
import RatingPill from "./RatingPill";

/** The emoji badges for one player, rendered small enough to sit on a marker. */
function MarkRow({
  marks,
  isManOfTheMatch,
  className = "",
}: {
  marks?: PlayerMarks;
  isManOfTheMatch?: boolean;
  className?: string;
}) {
  const list = marksFor(marks, { isManOfTheMatch });
  if (list.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-[1px] ${className}`}>
      {list.map(({ kind, count }) => (
        <span key={kind} title={MARKS[kind].label} className="whitespace-nowrap leading-none">
          <span aria-hidden>{MARKS[kind].emoji}</span>
          <span className="sr-only">
            {MARKS[kind].label}
            {count > 1 ? ` ×${count}` : ""}
          </span>
          {count > 1 && (
            <span aria-hidden className="ml-[1px] text-[9px] font-bold">
              ×{count}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function TeamLayer({
  playerIds,
  formation,
  side,
  color,
  captainId,
  marks,
  manOfTheMatchId,
}: {
  playerIds: string[];
  formation: string;
  side: "home" | "away";
  color: string;
  captainId?: string;
  marks: Map<string, PlayerMarks>;
  manOfTheMatchId?: string | null;
}) {
  const findPlayer = usePlayerLookup();
  const slots = layoutFormation(formation, side);

  return (
    <>
      {playerIds.map((id, i) => {
        const player = findPlayer(id);
        const pos = slots[i];
        if (!pos) return null;
        return (
          <div
            key={id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div className="relative">
              {player.rating !== undefined && player.rating > 0 && (
                <div className="absolute -left-2 -top-2 z-10">
                  <RatingPill rating={player.rating} />
                </div>
              )}
              {captainId === id && (
                <div className="absolute -right-1.5 -top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-extrabold text-base">
                  C
                </div>
              )}
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-[14px] font-extrabold text-white shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                style={{ backgroundColor: `${color}CC`, borderColor: color }}
              >
                {player.number}
              </div>
              {/* What the player did, under the shirt number so it never covers
                  the rating or the captain's armband. */}
              <MarkRow
                marks={marks.get(id)}
                isManOfTheMatch={manOfTheMatchId === id}
                className="absolute -bottom-1.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/70 px-1 text-[10px]"
              />
            </div>
            <span className="max-w-[64px] truncate text-center text-[11px] font-semibold leading-tight text-white">
              {player.name.split(" ").slice(-1)[0]}
            </span>
          </div>
        );
      })}
    </>
  );
}

/**
 * The written teamsheet beside the graphic.
 *
 * The pitch shows shirt numbers and a surname, which is what fits inside a
 * marker — but it is not a teamsheet. This is: every player in full, in
 * formation order, with their substitutes underneath.
 */
function TeamSheet({
  team,
  xi,
  bench,
  formation,
  captainId,
  marks,
  manOfTheMatchId,
  mirror = false,
}: {
  team: Department;
  xi: string[];
  bench: string[];
  formation: string;
  captainId?: string;
  marks: Map<string, PlayerMarks>;
  manOfTheMatchId?: string | null;
  /** Flip to face the pitch — only once the sheets sit either side of it. */
  mirror?: boolean;
}) {
  const findPlayer = usePlayerLookup();
  const rowClass = mirror ? "xl:flex-row-reverse xl:text-right" : "";

  const line = (id: string, muted = false) => {
    const player = findPlayer(id);
    return (
      <li key={id} className={`flex items-center gap-2 py-[3px] ${rowClass}`}>
        <span
          className={`tabular w-5 shrink-0 text-[11.5px] font-bold ${
            muted ? "text-white/50" : "text-white/70"
          } ${mirror ? "xl:text-right" : ""}`}
        >
          {player.number}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-[13px] ${
            muted ? "text-white/70" : "font-semibold text-white"
          }`}
        >
          {player.name}
          {captainId === id && (
            <span className="ml-1 text-[10px] font-extrabold text-accent">(C)</span>
          )}
        </span>
        <MarkRow
          marks={marks.get(id)}
          isManOfTheMatch={manOfTheMatchId === id}
          className="shrink-0 text-[11px]"
        />
      </li>
    );
  };

  return (
    <div className="min-w-0">
      <div
        className={`mb-1.5 flex items-center gap-1.5 ${mirror ? "xl:flex-row-reverse" : ""}`}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
        <span className="truncate text-[13px] font-bold text-white">{team.shortName}</span>
        <span className="text-[12px] font-medium text-white/60">{formation}</span>
      </div>

      <ul className="min-w-0">{xi.map((id) => line(id))}</ul>

      {bench.length > 0 && (
        <>
          <p
            className={`mt-2 border-t border-line pt-2 text-[11px] font-bold uppercase tracking-wide text-white/50 ${
              mirror ? "xl:text-right" : ""
            }`}
          >
            Substitutes
          </p>
          <ul className="min-w-0">{bench.map((id) => line(id, true))}</ul>
        </>
      )}
    </div>
  );
}

export default function FormationPitch({
  match,
  home,
  away,
  homeXI,
  awayXI,
  homeFormation,
  awayFormation,
  homeCaptainId,
  awayCaptainId,
}: {
  match: Match;
  home: Department;
  away: Department;
  homeXI: string[];
  awayXI: string[];
  homeFormation: string;
  awayFormation: string;
  homeCaptainId?: string;
  awayCaptainId?: string;
}) {
  const marks = buildPlayerMarks(match);
  const motm = match.manOfTheMatchId;

  const homeSheet = (
    <TeamSheet
      team={home}
      xi={homeXI}
      bench={match.home.bench ?? []}
      formation={homeFormation}
      captainId={homeCaptainId}
      marks={marks}
      manOfTheMatchId={motm}
    />
  );
  const awaySheet = (
    <TeamSheet
      team={away}
      xi={awayXI}
      bench={match.away.bench ?? []}
      formation={awayFormation}
      captainId={awayCaptainId}
      marks={marks}
      manOfTheMatchId={motm}
      mirror
    />
  );

  return (
    <div className="space-y-3">
      {/* On a wide screen the two teamsheets flank the pitch, the way a
          matchday programme lays them out. Narrower than that they sit
          underneath it. Each sheet is rendered once and moved with grid
          placement rather than duplicated per breakpoint — two copies would
          read every player's name twice to a screen reader. */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,400px)_minmax(0,1fr)] xl:items-start xl:gap-5">
        <div className="order-first xl:order-none xl:col-start-2 xl:row-start-1">
          <div className="mx-auto w-full overflow-hidden rounded-card border border-line bg-surface shadow-premium sm:max-w-md xl:max-w-none">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-white">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: home.color }} />
                {home.shortName} <span className="font-medium text-white">{homeFormation}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-white">
                <span className="font-medium text-white">{awayFormation}</span> {away.shortName}
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: away.color }} />
              </span>
            </div>

            <div
              className="relative w-full"
              style={{
                aspectRatio: "68 / 100",
                background:
                  "repeating-linear-gradient(0deg, #123723 0px, #123723 40px, #0E2E1C 40px, #0E2E1C 80px)",
              }}
            >
              {/* pitch markings */}
              <div className="absolute inset-0 border-2 border-white/15" />
              <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
              <div className="absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/15" />
              <div className="absolute left-1/2 top-0 h-[14%] w-[50%] -translate-x-1/2 border-2 border-t-0 border-white/15" />
              <div className="absolute bottom-0 left-1/2 h-[14%] w-[50%] -translate-x-1/2 border-2 border-b-0 border-white/15" />

              <TeamLayer
                playerIds={homeXI}
                formation={homeFormation}
                side="home"
                color={home.color}
                captainId={homeCaptainId}
                marks={marks}
                manOfTheMatchId={motm}
              />
              <TeamLayer
                playerIds={awayXI}
                formation={awayFormation}
                side="away"
                color={away.color}
                captainId={awayCaptainId}
                marks={marks}
                manOfTheMatchId={motm}
              />
            </div>
          </div>
        </div>

        {/* `xl:contents` dissolves this wrapper at the wide breakpoint so the
            two sheets become grid items either side of the pitch. */}
        <div className="grid gap-4 rounded-card border border-line bg-surface p-3 sm:grid-cols-2 xl:contents">
          <div className="min-w-0 xl:col-start-1 xl:row-start-1">{homeSheet}</div>
          <div className="min-w-0 sm:border-l sm:border-line sm:pl-3 xl:col-start-3 xl:row-start-1 xl:border-l-0 xl:pl-0">
            {awaySheet}
          </div>
        </div>
      </div>

      <Legend />
    </div>
  );
}

/** Nobody is born knowing a boot means an assist. */
function Legend() {
  const shown: (keyof typeof MARKS)[] = [
    "goal",
    "penalty",
    "freeKick",
    "assist",
    "yellow",
    "red",
    "motm",
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11.5px] text-white/60">
      {shown.map((kind) => (
        <span key={kind} className="whitespace-nowrap">
          <span aria-hidden>{MARKS[kind].emoji}</span> {MARKS[kind].label}
        </span>
      ))}
    </div>
  );
}

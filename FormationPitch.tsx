import { Department } from "@/lib/types";
import { findPlayer } from "@/lib/mock-data";
import { layoutFormation } from "@/lib/formation";
import RatingPill from "./RatingPill";

function TeamLayer({
  playerIds,
  formation,
  side,
  color,
  captainId,
}: {
  playerIds: string[];
  formation: string;
  side: "home" | "away";
  color: string;
  captainId?: string;
}) {
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

export default function FormationPitch({
  home,
  away,
  homeXI,
  awayXI,
  homeFormation,
  awayFormation,
  homeCaptainId,
  awayCaptainId,
}: {
  home: Department;
  away: Department;
  homeXI: string[];
  awayXI: string[];
  homeFormation: string;
  awayFormation: string;
  homeCaptainId?: string;
  awayCaptainId?: string;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-premium">
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

        <TeamLayer playerIds={homeXI} formation={homeFormation} side="home" color={home.color} captainId={homeCaptainId} />
        <TeamLayer playerIds={awayXI} formation={awayFormation} side="away" color={away.color} captainId={awayCaptainId} />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import RatingPill from "@/components/RatingPill";
import { usePlayers } from "@/lib/api";
import { MatchRating, RATING_RULES, computeMatchRatings, hasKickedOff } from "@/lib/ratings";
import { Department, Match, Player } from "@/lib/types";
import { Banner } from "../../ui";

/**
 * Ratings for this match, with the arithmetic shown.
 *
 * Read-only on purpose: the whole point of computing ratings is that the same
 * performance always produces the same number and nobody has to defend a
 * judgement call. What an administrator does need is to answer "why is he a
 * 7.5?", so every rule that fired is listed with what it was worth.
 */
export default function MatchRatings({
  match,
  home,
  away,
}: {
  match: Match;
  home: Department;
  away: Department;
}) {
  const { data: allPlayers = [] } = usePlayers();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!hasKickedOff(match)) {
    return (
      <section className="space-y-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">Ratings</h2>
        <Banner tone="info">
          Ratings appear once the match kicks off. Everyone who plays starts at{" "}
          {RATING_RULES.BASE.toFixed(1)} and moves with what happens.
        </Banner>
      </section>
    );
  }

  const ratings = computeMatchRatings(match, allPlayers);
  const byId = new Map(allPlayers.map((p) => [p.id, p]));

  type Row = { player: Player; rating: MatchRating };

  const sides = (["home", "away"] as const).map((key) => {
    const team = key === "home" ? home : away;
    const rated: Row[] = [];
    for (const [id, rating] of ratings) {
      const player = byId.get(id);
      if (player && player.departmentId === match[key].departmentId) rated.push({ player, rating });
    }
    // Best first — the point of the panel is who had the afternoon.
    rated.sort((a, b) => b.rating.rating - a.rating.rating || a.player.number - b.player.number);
    return { key, team, rated };
  });

  const nobody = sides.every((s) => s.rated.length === 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">Ratings</h2>
        <span className="text-[12px] text-white/70">
          Calculated from the match — not editable
        </span>
      </div>

      {nobody ? (
        <Banner tone="info">
          No teamsheet and no events yet, so there is nobody to rate.
        </Banner>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {sides.map(({ key, team, rated }) => (
            <div key={key} className="rounded-card border border-line bg-surface p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-white">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: team.color }}
                  aria-hidden
                />
                {team.shortName}
              </p>

              {rated.length === 0 ? (
                <p className="text-[12.5px] text-white/70">Nobody recorded for this side.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {rated.map(({ player, rating }) => {
                    const open = expanded === player.id;
                    return (
                      <li key={player.id} className="py-2">
                        <button
                          onClick={() => setExpanded(open ? null : player.id)}
                          className="flex w-full items-center gap-2 text-left"
                          aria-expanded={open}
                        >
                          <span className="tabular w-5 shrink-0 text-[11.5px] font-bold text-white/70">
                            {player.number}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">
                            {player.name}
                            {rating.manOfTheMatch && (
                              <span className="ml-1.5 text-[11px]" title="Man of the match">
                                ⭐
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-[11px] text-white/50">
                            {open ? "hide" : "why"}
                          </span>
                          <RatingPill rating={rating.rating} />
                        </button>

                        {open && (
                          <ul className="mt-1.5 space-y-0.5 border-l border-line pl-3">
                            {rating.lines.map((line, i) => (
                              <li
                                key={i}
                                className="flex items-baseline justify-between gap-3 text-[12px]"
                              >
                                <span className="text-white/70">{line.label}</span>
                                <span
                                  className={`tabular shrink-0 font-bold ${
                                    line.delta < 0 ? "text-loss" : "text-white"
                                  }`}
                                >
                                  {line.delta > 0 && line.label !== "Base" ? "+" : ""}
                                  {line.delta.toFixed(1)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <details className="rounded-card border border-line bg-surface p-3">
        <summary className="cursor-pointer text-[12.5px] font-bold text-white">
          How ratings are worked out
        </summary>
        <ul className="mt-2 space-y-1 text-[12.5px] text-white/70">
          <li>Everyone who plays starts at {RATING_RULES.BASE.toFixed(1)}.</li>
          <li>
            Goal +{RATING_RULES.FIRST_GOAL.toFixed(1)}, then +
            {RATING_RULES.FURTHER_GOAL.toFixed(1)} for each after — a hat-trick reaches 10.0.
          </li>
          <li>Assist +{RATING_RULES.ASSIST.toFixed(1)} each.</li>
          <li>
            Clean sheet +{RATING_RULES.CLEAN_SHEET.toFixed(1)} for keepers and defenders.
          </li>
          <li>
            Over {RATING_RULES.POSSESSION_MIN - 1}% possession +
            {RATING_RULES.POSSESSION.toFixed(1)} for midfielders.
          </li>
          <li>
            {RATING_RULES.SHOTS_MIN}+ shots and {RATING_RULES.CORNERS_MIN}+ corners +
            {RATING_RULES.ATTACKING_OUTPUT.toFixed(1)} for forwards.
          </li>
          <li>
            Yellow {RATING_RULES.YELLOW.toFixed(1)}, red {RATING_RULES.RED.toFixed(1)}.
          </li>
          <li>Man of the match is 10.0 outright. Everything else stays between 4.0 and 10.0.</li>
          <li>
            Possession and shots come from the Match stats panel above — without them, midfielders
            and forwards get no team bonus.
          </li>
        </ul>
      </details>
    </section>
  );
}

import { ImageResponse } from "next/og";
import { getDepartments, getMatch } from "@/lib/db/queries";
import { STAGE_LABELS } from "@/lib/types";

// The picture that appears when a match link is shared.
//
// Generated per match rather than a single static banner, so a link previews as
// the actual scoreline. Drawn with the runtime's own renderer — no headless
// browser, no image files to keep in sync with the palette.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Match scoreline";

// The tokens from tailwind.config.ts. Duplicated because this renders outside
// Tailwind entirely — there is no stylesheet in an OG image.
const BASE = "#08090B";
const SURFACE = "#15171C";
const LINE = "#262A32";
const ACCENT = "#F2661F";
const WIN = "#1FD97A";
const WHITE = "#FFFFFF";

export default async function Image({ params }: { params: { id: string } }) {
  let home = "???";
  let away = "???";
  let homeName = "";
  let awayName = "";
  let homeColor = ACCENT;
  let awayColor = "#6B7280";
  let score: string | null = null;
  let state = "";
  let where = "";

  try {
    const [match, departments] = await Promise.all([getMatch(params.id), getDepartments()]);
    if (match) {
      const team = (id: string) => departments.find((d) => d.id === id);
      const h = team(match.home.departmentId);
      const a = team(match.away.departmentId);
      home = h?.shortName ?? "???";
      away = a?.shortName ?? "???";
      homeName = h?.name ?? "";
      awayName = a?.name ?? "";
      homeColor = h?.color ?? ACCENT;
      awayColor = a?.color ?? "#6B7280";

      score =
        match.status === "UPCOMING" ? null : `${match.home.score} - ${match.away.score}`;
      state =
        match.status === "UPCOMING"
          ? match.kickoff
          : match.status === "FT"
          ? "Full time"
          : match.status === "HT"
          ? "Half time"
          : "Live";
      where = [
        match.stage && match.stage !== "GROUP"
          ? STAGE_LABELS[match.stage]
          : match.group
          ? `Group ${match.group}`
          : null,
        match.venue,
      ]
        .filter(Boolean)
        .join("  ·  ");
    }
  } catch {
    // A share image is never worth a 500. Fall through to the placeholder.
  }

  const live = state === "Live" || state === "Half time";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BASE,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 14, height: 44, background: ACCENT, borderRadius: 3 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: WHITE, fontSize: 34, fontWeight: 800, letterSpacing: 1 }}>
              AKSU SCORE
            </span>
            <span style={{ color: "#9AA0A6", fontSize: 20, letterSpacing: 2 }}>
              VICE-CHANCELLOR&apos;S CUP
            </span>
          </div>
          {live && (
            <span
              style={{
                marginLeft: "auto",
                background: WIN,
                color: "#04180F",
                fontSize: 24,
                fontWeight: 800,
                padding: "8px 20px",
                borderRadius: 999,
              }}
            >
              LIVE
            </span>
          )}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 48,
            background: SURFACE,
            border: `2px solid ${LINE}`,
            borderRadius: 24,
            marginTop: 40,
          }}
        >
          <Side label={home} name={homeName} color={homeColor} />
          {/* Centred with flex rather than textAlign: satori honours flex
              alignment reliably and left-aligned the scoreline under
              textAlign, which put it visibly off the middle of the card. */}
          <div style={{ display: "flex", width: 300, justifyContent: "center" }}>
            <span
              style={{
                color: live ? WIN : WHITE,
                fontSize: score ? 128 : 72,
                fontWeight: 800,
              }}
            >
              {score ?? "vs"}
            </span>
          </div>
          <Side label={away} name={awayName} color={awayColor} />
        </div>

        <div style={{ display: "flex", marginTop: 32, alignItems: "baseline", gap: 20 }}>
          <span style={{ color: WHITE, fontSize: 30, fontWeight: 700 }}>{state}</span>
          {where && <span style={{ color: "#9AA0A6", fontSize: 26 }}>{where}</span>}
        </div>
      </div>
    ),
    size
  );
}

function Side({ label, name, color }: { label: string; name: string; color: string }) {
  // The badge carries the abbreviation the site uses everywhere; the line below
  // spells it out, because a share card is often seen by someone who does not
  // already know that CSC is Computer Science.
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        width: 260,
      }}
    >
      <div
        style={{
          width: 128,
          height: 128,
          borderRadius: 999,
          background: `${color}33`,
          border: `5px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: WHITE,
          fontSize: 44,
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <span
        style={{
          color: WHITE,
          fontSize: 30,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {name || label}
      </span>
    </div>
  );
}

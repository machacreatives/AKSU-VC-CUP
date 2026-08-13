import { Match } from "@/lib/types";

function scorersFor(match: Match, departmentId: string) {
  const goals = match.events.filter((e) => e.type === "GOAL" && e.departmentId === departmentId);
  const byPlayer = new Map<string, number[]>();
  goals.forEach((g) => {
    const list = byPlayer.get(g.playerName) ?? [];
    list.push(g.minute);
    byPlayer.set(g.playerName, list);
  });
  return Array.from(byPlayer.entries());
}

export default function ScorersLine({ match, departmentId, align }: { match: Match; departmentId: string; align: "left" | "right" }) {
  const scorers = scorersFor(match, departmentId);
  if (scorers.length === 0) return null;

  return (
    <div className={`flex flex-col gap-0.5 text-[12px] text-white ${align === "right" ? "items-end text-right" : "items-start text-left"}`}>
      {scorers.map(([name, minutes]) => (
        <span key={name} className="truncate font-medium">
          {name} <span className="tabular font-semibold">{minutes.map((m) => `${m}'`).join(", ")}</span>
        </span>
      ))}
    </div>
  );
}

const rounds: { label: string; matches: number }[] = [
  { label: "Quarter-Finals", matches: 4 },
  { label: "Semi-Finals", matches: 2 },
  { label: "Final", matches: 1 },
];

function TBDCard() {
  return (
    <div className="flex items-center justify-between rounded-card border border-dashed border-line bg-surface px-3 py-3">
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold text-white">TBD</span>
        <span className="text-[15px] font-semibold text-white">TBD</span>
      </div>
      <span className="text-[12px] font-bold uppercase tracking-wide text-white">vs</span>
    </div>
  );
}

export default function KnockoutBracket() {
  return (
    <div className="space-y-5">
      <div className="rounded-card border border-line bg-surface2 px-3.5 py-3">
        <p className="text-[14px] font-medium text-white">
          Knockout bracket opens once the group stage finishes. Slots below will fill in as teams qualify.
        </p>
      </div>

      {/* Stacked rounds on phones. On large screens the rounds become columns
          that read left to right, and each round is centred against the one
          before it so it reads as an actual bracket. */}
      <div className="space-y-5 lg:grid lg:grid-cols-3 lg:items-center lg:gap-6 lg:space-y-0">
        {rounds.map((round) => (
          <section key={round.label} className="space-y-2">
            <h2 className="px-1 text-[13px] font-extrabold uppercase tracking-wide text-accent lg:text-center lg:text-[14px]">
              {round.label}
            </h2>
            <div className="space-y-2 lg:space-y-4">
              {Array.from({ length: round.matches }).map((_, i) => (
                <TBDCard key={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const FORM_STYLES: Record<"W" | "D" | "L", string> = {
  W: "bg-win/20 text-win",
  D: "bg-surface3 text-white/70",
  L: "bg-loss/20 text-loss",
};

const FORM_LABELS: Record<"W" | "D" | "L", string> = { W: "Won", D: "Drew", L: "Lost" };

/**
 * The last five results, most recent first.
 *
 * Shared by the group table and the team profile. The table hides it below
 * `lg` — at 320px the team name is already squeezed into about forty pixels
 * and five more chips would take the rest — while the profile has a whole
 * page to itself and shows it at every width, so the wrapper classes are the
 * caller's to choose.
 */
export default function FormGuide({
  form,
  size = 15,
  className = "flex items-center gap-[3px]",
  emptyClassName = "text-[12px] text-white/30",
}: {
  form: ("W" | "D" | "L")[];
  size?: number;
  className?: string;
  emptyClassName?: string;
}) {
  if (form.length === 0) return <span className={emptyClassName}>&mdash;</span>;

  return (
    <span className={className}>
      {form.map((result, i) => (
        <span
          key={i}
          title={`${FORM_LABELS[result]}${i === 0 ? " (most recent)" : ""}`}
          className={`flex items-center justify-center rounded-[3px] font-extrabold ${FORM_STYLES[result]}`}
          style={{ height: size, width: size, fontSize: size * 0.67 }}
        >
          <span aria-hidden>{result}</span>
          <span className="sr-only">{FORM_LABELS[result]}</span>
        </span>
      ))}
    </span>
  );
}

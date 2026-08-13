export default function RatingPill({ rating }: { rating: number }) {
  const color =
    rating >= 8.0
      ? "bg-win text-[#04180F]"
      : rating >= 7.0
      ? "bg-gold text-[#241A02]"
      : "bg-accent text-white";

  return (
    <span
      className={`tabular inline-flex min-w-[2.2em] items-center justify-center rounded-[5px] px-1.5 py-0.5 text-[12.5px] font-extrabold ${color}`}
    >
      {rating.toFixed(1)}
    </span>
  );
}

"use client";

// Shared admin form furniture. These class strings were duplicated verbatim
// across NewMatchForm and AccountSection; every new screen would have copied
// them again.

// No width here on purpose. Callers that want a narrow control append w-16 etc,
// and a width baked in would fight them unpredictably.
export const field =
  "rounded-[6px] border border-line bg-surface2 px-2.5 py-1.5 text-[13.5px] text-white outline-none focus:border-accent";

export const fieldFull = `${field} w-full`;

export const label = "text-[12px] font-semibold uppercase tracking-wide text-white";

export const btnPrimary =
  "rounded-[8px] bg-accent px-4 py-2 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

export const btnOutline =
  "rounded-[8px] border border-line px-4 py-2 text-[13.5px] font-bold text-white transition-colors hover:bg-surface2 disabled:opacity-50";

export function Banner({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "border-loss/40 bg-loss/10",
    success: "border-win/40 bg-win/10",
    info: "border-line bg-surface2",
  }[tone];

  return (
    <p className={`rounded-card border px-3 py-2 text-[13.5px] font-medium text-white ${styles}`}>
      {children}
    </p>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h1 className="text-[18px] font-extrabold text-white lg:text-[22px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-white">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-card border border-line bg-surface px-4 py-8 text-center shadow-premium">
      <p className="text-[15px] font-bold text-white">{title}</p>
      {body && <p className="mx-auto max-w-md text-[13.5px] text-white">{body}</p>}
      {action}
    </div>
  );
}

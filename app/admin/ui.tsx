"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";
import { useMe } from "@/lib/api";

// Shared admin form furniture. These class strings were duplicated verbatim
// across NewMatchForm and AccountSection; every new screen would have copied
// them again.

// No width here on purpose. Callers that want a narrow control append w-16 etc,
// and a width baked in would fight them unpredictably.
export const field =
  "rounded-[6px] border border-line bg-surface2 px-2.5 py-1.5 text-[13.5px] text-white outline-none focus:border-accent";

export const fieldFull = `${field} w-full`;

export const label = "text-[12px] font-semibold uppercase tracking-wide text-white";

// Buttons. Everything an administrator can click is one of these — actions
// used to be bare coloured text, which read as body copy and gave no hit area
// worth aiming at on a phone. `btnBase` fixes the height and alignment so a row
// of mixed variants lines up.
const btnBase =
  "inline-flex select-none items-center justify-center gap-1.5 rounded-[8px] px-4 py-2 text-[13.5px] font-bold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const btnPrimary = `${btnBase} bg-accent text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] hover:bg-accent/90 active:bg-accent`;

export const btnOutline = `${btnBase} border border-line bg-surface text-white hover:border-white/25 hover:bg-surface2`;

/** Filled but quiet — for secondary actions sitting beside a primary one. */
export const btnSecondary = `${btnBase} border border-line bg-surface2 text-white hover:border-white/25 hover:bg-surface3`;

/** Destructive. Outlined until hover so a delete never dominates a card. */
export const btnDanger = `${btnBase} border border-loss/50 bg-loss/10 text-loss hover:bg-loss/20`;

/** Same shapes, tightened for dense rows inside cards. */
export const btnSm = "px-3 py-1.5 text-[12.5px]";

/**
 * A success message that clears itself.
 *
 * "Event added." used to sit on the page until something else replaced it, so
 * after a busy ten minutes the admin was looking at a confirmation for an
 * action they had long forgotten — and adding the same event twice showed no
 * change at all, because the banner never went away to come back.
 *
 * Setting the same text twice restarts the countdown, and re-announces it to a
 * screen reader, by way of the tick suffix on the returned key.
 */
export function useNotice(timeoutMs = 6000) {
  const [notice, setNoticeState] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const setNotice = useCallback(
    (message: string) => {
      clear();
      setNoticeState(message);
      if (message) timer.current = setTimeout(() => setNoticeState(""), timeoutMs);
    },
    [clear, timeoutMs]
  );

  // Without this a pending timer fires after the page has gone, setting state
  // on an unmounted component.
  useEffect(() => clear, [clear]);

  return [notice, setNotice] as const;
}

/** Success banner that fades out with the notice it carries. */
export function Notice({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="status"
      className="animate-[fade-in_180ms_ease-out] rounded-card border border-win/40 bg-win/10 px-3 py-2 text-[13.5px] font-medium text-white"
    >
      {children}
    </p>
  );
}

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

/**
 * Wraps a page that belongs to a superadmin.
 *
 * Middleware gates the /admin area but cannot check a role — it verifies the
 * cookie signature on the Edge with no database. So a team admin who types the
 * URL still loads the page shell, and without this they would see a screen of
 * empty panels and failed requests instead of an answer.
 *
 * This is not the security boundary. Every write behind these pages is refused
 * again by its own route handler.
 */
export function RequireSuperadmin({ children }: { children: React.ReactNode }) {
  const { data: me, isPending } = useMe();

  if (isPending) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        <Skeleton className="h-24 w-full rounded-card" />
      </div>
    );
  }

  if (me?.role !== "SUPERADMIN") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
        <EmptyState
          title="Not available for your account"
          body="This part of the dashboard belongs to a superadmin. Your account manages your own team — its squad, teamsheets, and the events and stats of its matches."
          action={
            <Link href="/admin" className="text-[13px] font-bold text-accent">
              Back to your matches &rarr;
            </Link>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
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

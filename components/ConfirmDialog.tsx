"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// A reusable confirmation modal that replaces window.confirm().
//
// Exposed as a promise so call sites read the way the native dialog did:
//
//   if (!(await confirm({ title: "Delete?", body: "..." }))) return;
//
// Pass `onConfirm` and the dialog will run the work itself: the confirm button
// shows a spinner, the dialog stays put until the request finishes, and only
// then closes. Without that, the modal vanishes the instant it is clicked and
// the user watches a still screen while the request is in flight, with no idea
// whether anything is happening.

export type ConfirmOptions = {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" paints the confirm button red, for destructive actions. */
  tone?: "default" | "danger";
  /**
   * Optional work to run on confirm. The dialog stays open with the button in
   * a loading state until it settles. Throwing shows the message in the dialog
   * and keeps it open so the action can be retried or cancelled.
   */
  onConfirm?: () => Promise<unknown>;
  /** Verb shown while onConfirm runs, e.g. "Deleting…". */
  busyLabel?: string;
  /**
   * Make the user type this exact word before the confirm button unlocks.
   *
   * For the handful of actions that destroy data no undo can bring back. A
   * click can be a reflex; typing RESET cannot.
   */
  requireText?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="4" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const typeFieldRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setBusy(false);
        setError("");
        setTyped("");
        setPending({ ...options, resolve });
      }),
    []
  );

  const close = useCallback((ok: boolean) => {
    setPending((current) => {
      current?.resolve(ok);
      return null;
    });
    setBusy(false);
    setError("");
    setTyped("");
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pending) return;

    if (!pending.onConfirm) {
      close(true);
      return;
    }

    setBusy(true);
    setError("");
    try {
      await pending.onConfirm();
      close(true);
    } catch (err) {
      // Keep the dialog open so the message is attached to the action that
      // failed, rather than closing and reporting it somewhere else.
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }, [pending, close]);

  // Escape cancels, and the confirm button takes focus so the dialog is
  // operable from the keyboard. Both are ignored mid-request, so a half-run
  // action cannot be dismissed.
  useEffect(() => {
    if (!pending) return;
    // With a word to type, the field is where the user has to go next.
    if (pending.requireText) typeFieldRef.current?.focus();
    else confirmButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, busy, close]);

  // Nothing to type means nothing to unlock.
  const locked = Boolean(pending?.requireText) && typed.trim() !== pending?.requireText;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-busy={busy}
        >
          <button
            aria-label="Cancel"
            tabIndex={-1}
            disabled={busy}
            onClick={() => !busy && close(false)}
            className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-sm rounded-card border border-line bg-surface p-5 shadow-premium lg:max-w-md">
            <h2 id="confirm-title" className="text-[16px] font-extrabold text-white">
              {pending.title}
            </h2>

            {pending.body && (
              <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-white">
                {pending.body}
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-[8px] border border-loss/40 bg-loss/10 px-3 py-2 text-[13px] font-medium text-white">
                {error}
              </p>
            )}

            {pending.requireText && (
              <div className="mt-4 space-y-1.5">
                <label
                  htmlFor="confirm-type"
                  className="block text-[12px] font-semibold text-white"
                >
                  Type <strong className="font-extrabold">{pending.requireText}</strong> to confirm
                </label>
                <input
                  id="confirm-type"
                  ref={typeFieldRef}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={busy}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-[8px] border border-line bg-surface2 px-3 py-2 text-[14px] font-bold tracking-wide text-white outline-none focus:border-white/30"
                />
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => close(false)}
                disabled={busy}
                className="rounded-[8px] border border-line px-4 py-2 text-[13.5px] font-bold text-white transition-colors hover:bg-surface2 disabled:opacity-40"
              >
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                ref={confirmButtonRef}
                onClick={handleConfirm}
                disabled={busy || locked}
                className={`inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-70 ${
                  pending.tone === "danger" ? "bg-loss" : "bg-accent"
                }`}
              >
                {busy && <Spinner />}
                {busy
                  ? pending.busyLabel ?? "Working…"
                  : pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

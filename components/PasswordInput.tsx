"use client";

import { useId, useState } from "react";

/**
 * A password field with a show/hide toggle.
 *
 * Deliberately standalone rather than living in app/admin/ui.tsx: the login and
 * setup pages use this, and that module now imports the React Query identity
 * hook, which those two pages have no business pulling in.
 *
 * Toggling swaps `type` between password and text. Password managers handle
 * that fine, and it is the only approach that keeps the browser's own
 * autocomplete working — rendering the characters by hand would not.
 */
export default function PasswordInput({
  className = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { className?: string }) {
  const [visible, setVisible] = useState(false);
  const labelId = useId();

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        // Room for the button, so a long password never runs underneath it.
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Not in the tab order: someone tabbing from the password field expects
        // the submit button next, not a toggle they did not ask for.
        tabIndex={-1}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-describedby={labelId}
        title={visible ? "Hide password" : "Show password"}
        className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-white/50 transition-colors hover:text-white"
      >
        {visible ? <EyeOff /> : <Eye />}
        <span id={labelId} className="sr-only">
          {visible ? "Password is showing" : "Password is hidden"}
        </span>
      </button>
    </div>
  );
}

// Inline so there is no icon dependency for two shapes. 16px, currentColor.
function Eye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a18 18 0 0 1-2.4 3.1M6.2 6.7A17.6 17.6 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1M3 3l18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

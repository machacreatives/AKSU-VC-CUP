"use client";

import { useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { useMe } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/types";
import { Banner, Notice, btnOutline, fieldFull, useNotice } from "./ui";

/**
 * Change your own password.
 *
 * Split out of AccountSection because that panel is the account roster, which
 * is superadmin-only — but every administrator needs to be able to change their
 * own password, team admins included.
 */
export default function PasswordSection() {
  const { data: me } = useMe();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useNotice();

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setChanging(true);
    const res = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const body = await res.json().catch(() => ({}));
    setChanging(false);

    if (!res.ok) return setError(body.error ?? "Could not change the password.");
    setNotice("Password changed.");
    setCurrentPassword("");
    setNewPassword("");
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">
          My account
        </h2>
        {me && (
          <span className="rounded-full border border-line bg-surface2 px-2.5 py-0.5 text-[11.5px] font-bold text-white">
            {me.username} · {ROLE_LABELS[me.role]}
          </span>
        )}
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      <Notice>{notice}</Notice>

      <form
        onSubmit={changePassword}
        className="space-y-2 rounded-card border border-line bg-surface p-3 lg:max-w-md"
      >
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-white">
          Change my password
        </h3>
        <input
          className={fieldFull}
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
        <input
          className={fieldFull}
          type="password"
          placeholder={`New password (min ${MIN_PASSWORD_LENGTH} characters)`}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button type="submit" disabled={changing} className={btnOutline}>
          {changing ? "Saving…" : "Change password"}
        </button>
      </form>
    </section>
  );
}

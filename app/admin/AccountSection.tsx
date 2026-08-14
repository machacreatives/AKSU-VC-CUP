"use client";

import { useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { useConfirm } from "@/components/ConfirmDialog";
import { api, queryKeys } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotice } from "./ui";

type AdminUser = {
  id: string;
  username: string;
  displayName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

const inputClass =
  "w-full rounded-[6px] border border-line bg-surface2 px-2.5 py-1.5 text-[13.5px] text-white outline-none focus:border-accent";

function formatDate(value: string | null) {
  if (!value) return "never";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AccountSection() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: () => api.getJson<AdminUser[]>("/api/admin/users"),
  });
  const users: AdminUser[] = usersQuery.data ?? [];
  const [error, setError] = useState("");
  const [notice, setNotice] = useNotice();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  const load = () => queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, displayName, password: newUserPassword }),
    });
    const body = await res.json().catch(() => ({}));
    setCreating(false);
    if (res.ok) {
      setNotice(`Created ${username}.`);
      setUsername("");
      setDisplayName("");
      setNewUserPassword("");
      load();
    } else {
      setError(body.error ?? "Could not create the account.");
    }
  }

  async function removeUser(id: string, name: string) {
    const ok = await confirm({
      title: `Remove ${name}?`,
      body: <p>They will no longer be able to sign in, and any active session is cut off.</p>,
      confirmLabel: "Remove administrator",
      busyLabel: "Removing…",
      tone: "danger",
      onConfirm: async () => {
        const res = await fetch("/api/admin/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not remove the account.");
      },
    });
    if (!ok) return;

    setError("");
    setNotice(`Removed ${name}.`);
    load();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setChanging(true);
    const res = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const body = await res.json().catch(() => ({}));
    setChanging(false);
    if (res.ok) {
      setNotice("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setError(body.error ?? "Could not change the password.");
    }
  }

  return (
    <section className="space-y-3 border-t border-line pt-4">
      <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">
        Administrators
      </h2>

      {error && (
        <p className="rounded-card border border-loss/40 bg-loss/10 px-3 py-2 text-[13.5px] text-white">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-card border border-win/40 bg-win/10 px-3 py-2 text-[13.5px] text-white">
          {notice}
        </p>
      )}

      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-semibold text-white">
                {u.username}
                {u.displayName ? <span className="font-normal"> — {u.displayName}</span> : null}
              </p>
              <p className="truncate text-[12px] text-white">Last signed in: {formatDate(u.lastLoginAt)}</p>
            </div>
            <button
              onClick={() => removeUser(u.id, u.username)}
              className="text-[12px] font-bold text-loss"
            >
              Remove
            </button>
          </div>
        ))}
        {users.length === 0 && (
          <p className="px-3 py-4 text-[13.5px] text-white">No administrators loaded.</p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <form onSubmit={addUser} className="space-y-2 rounded-card border border-line bg-surface p-3">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-white">Add administrator</h3>
          <input
            className={inputClass}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
          <input
            className={inputClass}
            placeholder="Display name (optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="off"
          />
          <input
            className={inputClass}
            type="password"
            placeholder={`Password (min ${MIN_PASSWORD_LENGTH} characters)`}
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-[8px] bg-accent px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-50"
          >
            {creating ? "Creating…" : "Add administrator"}
          </button>
        </form>

        <form
          onSubmit={changePassword}
          className="space-y-2 rounded-card border border-line bg-surface p-3"
        >
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-white">
            Change my password
          </h3>
          <input
            className={inputClass}
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <input
            className={inputClass}
            type="password"
            placeholder={`New password (min ${MIN_PASSWORD_LENGTH} characters)`}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={changing}
            className="rounded-[8px] border border-line px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-50"
          >
            {changing ? "Saving…" : "Change password"}
          </button>
        </form>
      </div>
    </section>
  );
}

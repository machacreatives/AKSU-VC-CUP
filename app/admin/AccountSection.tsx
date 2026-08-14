"use client";

import { useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { useConfirm } from "@/components/ConfirmDialog";
import { api, queryKeys, useDepartments, useMe } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_ROLES, AdminRole, ROLE_LABELS } from "@/lib/types";
import PasswordInput from "@/components/PasswordInput";
import {
  Banner,
  Notice,
  btnDanger,
  btnOutline,
  btnPrimary,
  btnSm,
  fieldFull,
  useNotice,
} from "./ui";

// Mirrors AdminUser in lib/db/users.ts. Kept local because that module pulls in
// the Postgres driver and this is a client component.
type AdminUser = {
  id: string;
  username: string;
  displayName: string | null;
  role: AdminRole;
  departmentId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "never";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * The account roster. Superadmin only — a team admin has no business knowing
 * who else can sign in, so the endpoint behind this refuses them too.
 */
export default function AccountSection() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data: teams = [] } = useDepartments();

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
  const [role, setRole] = useState<AdminRole>("TEAM_ADMIN");
  const [departmentId, setDepartmentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = () => queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
  const teamName = (id: string | null) =>
    id ? teams.find((t) => t.id === id)?.name ?? id : null;

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        displayName,
        password: newUserPassword,
        role,
        departmentId: role === "TEAM_ADMIN" ? departmentId : null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setCreating(false);

    if (!res.ok) return setError(body.error ?? "Could not create the account.");
    setNotice(`Created ${username}.`);
    setUsername("");
    setDisplayName("");
    setNewUserPassword("");
    setDepartmentId("");
    load();
  }

  async function changeRole(user: AdminUser, nextRole: AdminRole, nextTeam: string) {
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: user.id,
        role: nextRole,
        departmentId: nextRole === "TEAM_ADMIN" ? nextTeam : null,
      }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) return setError(body.error ?? "Could not update the account.");
    setEditing(null);
    setNotice(`Updated ${user.username}.`);
    load();
    // Their own role may have changed, which changes what this page offers.
    queryClient.invalidateQueries({ queryKey: queryKeys.me });
  }

  async function removeUser(user: AdminUser) {
    const ok = await confirm({
      title: `Remove ${user.username}?`,
      body: <p>They will no longer be able to sign in, and any active session is cut off.</p>,
      confirmLabel: "Remove administrator",
      busyLabel: "Removing…",
      tone: "danger",
      onConfirm: async () => {
        const res = await fetch("/api/admin/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: user.id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not remove the account.");
      },
    });
    if (!ok) return;
    setError("");
    setNotice(`Removed ${user.username}.`);
    load();
  }

  const teamsWithoutAdmin = teams.filter(
    (t) => !users.some((u) => u.departmentId === t.id)
  );

  return (
    <section className="space-y-3 border-t border-line pt-4">
      <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">
        Administrators
      </h2>

      {error && <Banner tone="error">{error}</Banner>}
      <Notice>{notice}</Notice>

      {teamsWithoutAdmin.length > 0 && (
        <Banner tone="info">
          {teamsWithoutAdmin.length} team{teamsWithoutAdmin.length === 1 ? " has" : "s have"} no
          administrator yet: {teamsWithoutAdmin.map((t) => t.shortName).join(", ")}.
        </Banner>
      )}

      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {users.map((u) => {
          const isMe = me?.id === u.id;
          return (
            <div key={u.id} className="space-y-2 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-white">
                    {u.username}
                    {u.displayName ? <span className="font-normal"> — {u.displayName}</span> : null}
                    {isMe && <span className="ml-1.5 text-[11.5px] text-accent">you</span>}
                  </p>
                  <p className="truncate text-[12px] text-white/70">
                    Last signed in: {formatDate(u.lastLoginAt)}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold ${
                    u.role === "SUPERADMIN"
                      ? "border-accent/50 bg-accent/15 text-white"
                      : "border-line bg-surface2 text-white"
                  }`}
                >
                  {ROLE_LABELS[u.role]}
                  {u.departmentId ? ` · ${teamName(u.departmentId)}` : ""}
                </span>

                <button
                  onClick={() => setEditing(editing === u.id ? null : u.id)}
                  className={`${btnOutline} ${btnSm}`}
                >
                  {editing === u.id ? "Cancel" : "Change role"}
                </button>
                {!isMe && (
                  <button onClick={() => removeUser(u)} className={`${btnDanger} ${btnSm}`}>
                    Remove
                  </button>
                )}
              </div>

              {editing === u.id && (
                <RoleEditor user={u} teams={teams} onSave={changeRole} />
              )}
            </div>
          );
        })}
        {users.length === 0 && (
          <p className="px-3 py-4 text-[13.5px] text-white">No administrators loaded.</p>
        )}
      </div>

      <form
        onSubmit={addUser}
        className="grid gap-2 rounded-card border border-line bg-surface p-3 sm:grid-cols-2"
      >
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-white sm:col-span-2">
          Add administrator
        </h3>
        <input
          className={fieldFull}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
        />
        <input
          className={fieldFull}
          placeholder="Display name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="off"
        />
        <PasswordInput
          className={fieldFull}
          placeholder={`Password (min ${MIN_PASSWORD_LENGTH} characters)`}
          value={newUserPassword}
          onChange={(e) => setNewUserPassword(e.target.value)}
          autoComplete="new-password"
        />
        <select
          className={fieldFull}
          value={role}
          onChange={(e) => setRole(e.target.value as AdminRole)}
        >
          {ADMIN_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>

        {role === "TEAM_ADMIN" && (
          <select
            className={`${fieldFull} sm:col-span-2`}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">Which team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.shortName})
                {users.some((u) => u.departmentId === t.id) ? " — already has one" : ""}
              </option>
            ))}
          </select>
        )}

        <p className="text-[11.5px] text-white/70 sm:col-span-2">
          {role === "SUPERADMIN"
            ? "A superadmin can do everything: fixtures, groups, venues, man of the match and accounts."
            : "A team admin manages one team only — its squad, teamsheets, and the events and stats of its own matches."}
        </p>

        <div className="sm:col-span-2">
          <button type="submit" disabled={creating} className={btnPrimary}>
            {creating ? "Creating…" : "Add administrator"}
          </button>
        </div>
      </form>
    </section>
  );
}

function RoleEditor({
  user,
  teams,
  onSave,
}: {
  user: AdminUser;
  teams: { id: string; name: string; shortName: string }[];
  onSave: (user: AdminUser, role: AdminRole, departmentId: string) => void;
}) {
  const [role, setRole] = useState<AdminRole>(user.role);
  const [departmentId, setDepartmentId] = useState(user.departmentId ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
      <select
        className={`${fieldFull} sm:w-40`}
        value={role}
        onChange={(e) => setRole(e.target.value as AdminRole)}
      >
        {ADMIN_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>

      {role === "TEAM_ADMIN" && (
        <select
          className={`${fieldFull} sm:w-56`}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <option value="">Which team…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.shortName})
            </option>
          ))}
        </select>
      )}

      <button
        onClick={() => onSave(user, role, departmentId)}
        className={`${btnPrimary} ${btnSm}`}
      >
        Save
      </button>
    </div>
  );
}

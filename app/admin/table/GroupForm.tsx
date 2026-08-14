"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api";
import { CAMPUSES, CAMPUS_LABELS, Campus, Group } from "@/lib/types";
import { Banner, btnOutline, btnPrimary, fieldFull, label } from "../ui";

/**
 * Create a group, or rename one.
 *
 * The name is what appears everywhere as "Group {name}" — usually a single
 * letter. The id a team stores is derived from the first name given and then
 * never changes, so renaming Group E to Group F does not orphan its teams.
 */
export default function GroupForm({
  group,
  defaultCampus,
  existing,
  onSaved,
  onClose,
}: {
  group?: Group;
  defaultCampus?: Campus;
  existing: Group[];
  onSaved: (group: Group, created: boolean) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const editing = Boolean(group);

  const [name, setName] = useState(group?.name ?? "");
  const [campus, setCampus] = useState<Campus>(group?.campus ?? defaultCampus ?? "main");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Suggest the next unused letter, which is what a fifth group almost always
  // is. Falls back to blank once the alphabet is exhausted or names stop being
  // letters at all.
  const suggestion = (() => {
    const used = new Set(existing.map((g) => g.name.toUpperCase()));
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!used.has(letter)) return letter;
    }
    return "";
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter the group name.");

    setSaving(true);
    const res = await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: group?.id, name, campus }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok || !body.group) return setError(body.error ?? "Could not save the group.");

    queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    onSaved(body.group, !editing);
    onClose();
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-card border border-line bg-surface p-3.5 shadow-premium"
    >
      <h3 className="text-[13px] font-bold uppercase tracking-wide text-white">
        {editing ? `Rename Group ${group!.name}` : "New group"}
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className={label}>Group name</span>
          <input
            className={fieldFull}
            placeholder={suggestion || "E"}
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="text-[11.5px] text-white/70">
            Shown as &ldquo;Group {name.trim() || suggestion || "E"}&rdquo;.
          </p>
        </div>

        <div className="space-y-1">
          <span className={label}>Campus</span>
          <select
            className={fieldFull}
            value={campus}
            onChange={(e) => setCampus(e.target.value as Campus)}
          >
            {CAMPUSES.map((c) => (
              <option key={c} value={c}>
                {CAMPUS_LABELS[c]}
              </option>
            ))}
          </select>
          <p className="text-[11.5px] text-white/70">
            Only teams on this campus can be placed in it.
          </p>
        </div>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving…" : editing ? "Save name" : "Create group"}
        </button>
        <button type="button" onClick={onClose} className={btnOutline}>
          Cancel
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api";
import { Department } from "@/lib/types";
import { Banner, btnPrimary, btnSm, field, label } from "../../ui";

/**
 * The one part of the team record a team admin owns.
 *
 * Separate from TeamForm, which is the superadmin's full editor — name, badge,
 * group, campus. A team admin can name their coach without being able to move
 * their own side into another group.
 */
export default function CoachEditor({ team }: { team: Department }) {
  const queryClient = useQueryClient();
  const [coach, setCoach] = useState(team.coach ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const dirty = (coach.trim() || null) !== (team.coach ?? null);

  async function save() {
    setError("");
    setSaved(false);
    setSaving(true);
    const res = await fetch(`/api/admin/departments/${team.id}/coach`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coach }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Could not save the coach.");
    setSaved(true);
    queryClient.invalidateQueries({ queryKey: queryKeys.departments });
  }

  return (
    <section className="space-y-2 rounded-card border border-line bg-surface p-3">
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">Coach</h2>
      {error && <Banner tone="error">{error}</Banner>}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1 space-y-1">
          <label htmlFor="coach-name" className={label}>
            Coach name
          </label>
          <input
            id="coach-name"
            className={`${field} w-full`}
            placeholder="Not named yet"
            maxLength={80}
            value={coach}
            onChange={(e) => {
              setCoach(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        <button onClick={save} disabled={saving || !dirty} className={`${btnPrimary} ${btnSm}`}>
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
      <p className="text-[11.5px] text-white/60">
        Shown on the public team profile. Leave it blank if nobody has been named.
      </p>
    </section>
  );
}

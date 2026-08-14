"use client";

import { useState } from "react";
import DeptBadge from "@/components/DeptBadge";
import { CAMPUS_GROUPS, CAMPUS_LABELS, Campus, Department, GroupId } from "@/lib/types";
import { Banner, btnOutline, btnPrimary, field, fieldFull, label } from "../ui";

const CAMPUSES: Campus[] = ["main", "obioakpa"];

const DEFAULT_COLOR = "#F2661F";

export default function TeamForm({
  team,
  onSaved,
  onCancel,
}: {
  team?: Department;
  onSaved: (d: Department) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [shortName, setShortName] = useState(team?.shortName ?? "");
  const [faculty, setFaculty] = useState(team?.faculty ?? "");
  const [campus, setCampus] = useState<Campus>(team?.campus ?? "main");
  const [group, setGroup] = useState<GroupId>(team?.group ?? "A");
  const [color, setColor] = useState(team?.color ?? DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Groups belong to a campus, so switching campus has to move the group with
  // it — otherwise a Main Campus team could sit in Group C and would render
  // under the wrong campus on the public table.
  function chooseCampus(next: Campus) {
    setCampus(next);
    if (!CAMPUS_GROUPS[next].includes(group)) setGroup(CAMPUS_GROUPS[next][0]);
  }

  const preview: Department = {
    id: team?.id ?? "preview",
    name: name || "Team name",
    shortName: shortName || "???",
    faculty,
    campus,
    group,
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: team?.id, name, shortName, faculty, campus, group, color }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && body.department) onSaved(body.department);
    else setError(body.error ?? "Could not save the team.");
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-card border border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-white">
          {team ? "Edit team" : "New team"}
        </h3>
        <button type="button" onClick={onCancel} className="text-[12.5px] font-bold text-white">
          Cancel
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className={label}>Team name</span>
          <input className={fieldFull} placeholder="Computer Science" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1">
          <span className={label}>Short name (badge)</span>
          <input
            className={fieldFull}
            placeholder="CSC"
            maxLength={3}
            value={shortName}
            onChange={(e) => setShortName(e.target.value.toUpperCase())}
          />
        </div>

        <div className="space-y-1">
          <span className={label}>Faculty</span>
          <input className={fieldFull} placeholder="Physical Sciences" value={faculty} onChange={(e) => setFaculty(e.target.value)} />
        </div>

        <div className="space-y-1">
          <span className={label}>Campus</span>
          <select className={fieldFull} value={campus} onChange={(e) => chooseCampus(e.target.value as Campus)}>
            {CAMPUSES.map((c) => (
              <option key={c} value={c}>
                {CAMPUS_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <span className={label}>Group</span>
          <select className={fieldFull} value={group} onChange={(e) => setGroup(e.target.value as GroupId)}>
            {CAMPUS_GROUPS[campus].map((g) => (
              <option key={g} value={g}>
                Group {g}
              </option>
            ))}
          </select>
          <p className="text-[11.5px] text-white">
            {CAMPUS_LABELS[campus]} uses {CAMPUS_GROUPS[campus].map((g) => `Group ${g}`).join(" and ")}.
          </p>
        </div>

        <div className="space-y-1">
          <span className={label}>Colour</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR}
              onChange={(e) => setColor(e.target.value.toUpperCase())}
              className="h-9 w-12 shrink-0 cursor-pointer rounded-[6px] border border-line bg-surface2"
              aria-label="Team colour"
            />
            <input className={`${field} min-w-0 flex-1`} value={color} onChange={(e) => setColor(e.target.value)} />
            {/* Shows the actual badge the public site will render */}
            <DeptBadge department={preview} size={34} />
          </div>
        </div>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving…" : team ? "Save team" : "Create team"}
        </button>
        <button type="button" onClick={onCancel} className={btnOutline}>
          Cancel
        </button>
      </div>
    </form>
  );
}

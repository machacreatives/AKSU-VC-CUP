"use client";

import { useState } from "react";
import { TEAM_CSV_TEMPLATE, TEAM_HEADERS, parseCsv, toRecords } from "@/lib/csv";
import { Banner, btnOutline, btnPrimary, field } from "../ui";

type Draft = {
  line: number;
  name: string;
  shortName: string;
  faculty: string;
  campus: string;
  group: string;
  color: string;
  coach: string;
};

type RowError = { line: number; field: string; message: string };

/**
 * Bulk team import.
 *
 * Same shape as the squad importer: paste or pick a file, get an editable
 * preview with every problem pinned to its line, check, then import. Rows stay
 * editable because the usual failure is a stray "Main Campus " or a missing
 * faculty, and sending someone back to their spreadsheet for that is punishing.
 */
export default function TeamCsvImport({
  onImported,
  onClose,
}: {
  onImported: (summary: { created: number; updated: number; newGroups: string[] }) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [mode, setMode] = useState<"append" | "update">("append");
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "error">("info");

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEAM_CSV_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "aksu-teams-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildPreview(raw: string) {
    setMessage("");
    setErrors([]);
    const records = toRecords(parseCsv(raw), TEAM_HEADERS);
    if (records.length === 0) {
      setDrafts(null);
      setTone("error");
      setMessage("No rows found. The first line must be the column headers.");
      return;
    }
    setDrafts(
      records.map(({ line, record }) => ({
        line,
        name: record.name ?? "",
        shortName: (record.shortName ?? "").toUpperCase(),
        faculty: record.faculty ?? "",
        campus: record.campus ?? "",
        group: record.group ?? "",
        color: record.color ?? "",
        coach: record.coach ?? "",
      }))
    );
  }

  async function readFile(file: File) {
    const raw = await file.text();
    setText(raw);
    buildPreview(raw);
  }

  async function send(dryRun: boolean) {
    if (!drafts) return;
    setBusy(dryRun ? "check" : "import");
    setErrors([]);
    setMessage("");

    const res = await fetch("/api/admin/departments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun, mode, rows: drafts }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);

    if (res.ok) {
      if (dryRun) {
        const bits = [
          body.creating ? `${body.creating} new` : "",
          body.updating ? `${body.updating} to update` : "",
        ].filter(Boolean);
        const groups = (body.newGroups ?? []) as { name: string }[];
        setTone("info");
        setMessage(
          `${body.ready} row${body.ready === 1 ? "" : "s"} ready${bits.length ? ` — ${bits.join(", ")}` : ""}.` +
            (groups.length
              ? ` Group ${groups.map((g) => g.name).join(", ")} will be created.`
              : "")
        );
      } else {
        onImported({
          created: body.created ?? 0,
          updated: body.updated ?? 0,
          newGroups: body.newGroups ?? [],
        });
      }
      return;
    }

    setErrors(body.rows ?? []);
    setTone("error");
    setMessage(body.error ?? "Could not import.");
  }

  const errorsByLine = new Map<number, RowError[]>();
  errors.forEach((e) => errorsByLine.set(e.line, [...(errorsByLine.get(e.line) ?? []), e]));

  const columns: { key: keyof Omit<Draft, "line">; label: string; width: string }[] = [
    { key: "name", label: "Team name", width: "w-full min-w-[10rem]" },
    { key: "shortName", label: "Short", width: "w-16" },
    { key: "faculty", label: "Faculty", width: "w-full min-w-[9rem]" },
    { key: "campus", label: "Campus", width: "w-28" },
    { key: "group", label: "Group", width: "w-20" },
    { key: "color", label: "Colour", width: "w-24" },
    { key: "coach", label: "Coach", width: "w-full min-w-[8rem]" },
  ];

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-3.5 shadow-premium">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-white">
          Import teams from CSV
        </h3>
        <div className="flex items-center gap-3">
          <button type="button" onClick={downloadTemplate} className="text-[12.5px] font-bold text-accent">
            Download template
          </button>
          <button type="button" onClick={onClose} className="text-[12.5px] font-bold text-white">
            Close
          </button>
        </div>
      </div>

      <p className="text-[12.5px] text-white/80">
        Columns: <span className="font-bold">name, short_name, faculty, campus, group, color, coach</span>.
        Campus is main or obioakpa. Group is the letter — one that does not exist yet is created on
        that campus. Colour is a hex value like #F2661F, and a blank one is chosen for you. Coach is
        optional.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-white">
            Choose a file
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
            className="w-full rounded-[6px] border border-line bg-surface2 px-2.5 py-1.5 text-[13px] text-white file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-[12px] file:font-bold file:text-white"
          />
        </div>
        <div className="space-y-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-white">
            …or paste rows
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text.trim() && buildPreview(text)}
            rows={3}
            placeholder={TEAM_CSV_TEMPLATE}
            className={`${field} w-full font-mono text-[12px]`}
          />
        </div>
      </div>

      {message && <Banner tone={tone}>{message}</Banner>}

      {drafts && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[12.5px] font-semibold text-white">
              {drafts.length} row{drafts.length === 1 ? "" : "s"}
            </span>
            {(["append", "update"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-[12.5px] text-white">
                <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
                {m === "append" ? "Add new teams only" : "Add and update existing"}
              </label>
            ))}
          </div>

          <div className="scroll-x">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-white">
                  <th className="p-1">Line</th>
                  {columns.map((c) => (
                    <th key={c.key} className="p-1">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, i) => {
                  const rowErrors = errorsByLine.get(d.line) ?? [];
                  const update = (patch: Partial<Draft>) =>
                    setDrafts(drafts.map((x, xi) => (xi === i ? { ...x, ...patch } : x)));
                  return (
                    <tr key={d.line} className={rowErrors.length ? "bg-loss/10" : ""}>
                      <td className="p-1 text-white">{d.line}</td>
                      {columns.map((c) => (
                        <td key={c.key} className="p-1">
                          <input
                            value={d[c.key]}
                            onChange={(e) =>
                              update({
                                [c.key]:
                                  c.key === "shortName"
                                    ? e.target.value.toUpperCase()
                                    : e.target.value,
                              } as Partial<Draft>)
                            }
                            className={`${field} ${c.width} ${
                              rowErrors.some((e) => e.field === c.key) ? "border-loss" : ""
                            }`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {errors.length > 0 && (
            <ul className="space-y-1 text-[12.5px] text-loss">
              {errors.map((e, i) => (
                <li key={i}>
                  Line {e.line} · {e.field}: {e.message}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={() => send(true)} disabled={busy !== null} className={btnOutline}>
              {busy === "check" ? "Checking…" : "Check rows"}
            </button>
            <button onClick={() => send(false)} disabled={busy !== null} className={btnPrimary}>
              {busy === "import"
                ? "Importing…"
                : `Import ${drafts.length} team${drafts.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { CSV_TEMPLATE, parseCsv, toRecords } from "@/lib/csv";
import { Banner, btnOutline, btnPrimary, field } from "../../ui";

type Draft = {
  line: number;
  name: string;
  number: string;
  position: string;
  squadRole: string;
  status: string;
};

type RowError = { line: number; field: string; message: string };

export default function CsvImport({
  teamId,
  teamName,
  onImported,
  onClose,
}: {
  teamId: string;
  teamName: string;
  onImported: (count: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [message, setMessage] = useState("");

  function downloadTemplate() {
    // Built in the browser so there is no route to hit and the filename can
    // carry the team's name.
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${teamName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-squad-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildPreview(raw: string) {
    setMessage("");
    setErrors([]);
    const records = toRecords(parseCsv(raw));
    if (records.length === 0) {
      setDrafts(null);
      setMessage("No rows found. The first line must be the column headers.");
      return;
    }
    setDrafts(
      records.map(({ line, record }) => ({
        line,
        name: record.name ?? "",
        number: record.number ?? "",
        position: (record.position ?? "").toUpperCase(),
        squadRole: record.squadRole ?? "player",
        status: record.status ?? "active",
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

    const res = await fetch(`/api/admin/departments/${teamId}/players/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun, mode, rows: drafts }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);

    if (res.ok) {
      if (dryRun) setMessage(`${body.ready} row${body.ready === 1 ? "" : "s"} ready to import.`);
      else onImported(body.imported);
      return;
    }
    setErrors(body.rows ?? []);
    setMessage(body.error ?? "Could not import.");
  }

  const errorsByLine = new Map<number, RowError[]>();
  errors.forEach((e) => errorsByLine.set(e.line, [...(errorsByLine.get(e.line) ?? []), e]));
  const fileLevelErrors = errors.filter((e) => e.line === 0);

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-white">Import squad from CSV</h3>
        <div className="flex items-center gap-3">
          <button type="button" onClick={downloadTemplate} className="text-[12.5px] font-bold text-accent">
            Download template
          </button>
          <button type="button" onClick={onClose} className="text-[12.5px] font-bold text-white">
            Close
          </button>
        </div>
      </div>

      <p className="text-[12.5px] text-white">
        Columns: <span className="font-bold">name, number, position, squad_role, status</span>. Position is
        GK, DF, MF or FW. Role is captain, vice_captain or player (blank means player). Status is active,
        injured or suspended (blank means active).
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-white">Choose a file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
            className="w-full rounded-[6px] border border-line bg-surface2 px-2.5 py-1.5 text-[13px] text-white file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-[12px] file:font-bold file:text-white"
          />
        </div>
        <div className="space-y-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-white">…or paste rows</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text.trim() && buildPreview(text)}
            rows={3}
            placeholder={CSV_TEMPLATE}
            className={`${field} w-full font-mono text-[12px]`}
          />
        </div>
      </div>

      {message && <Banner tone={errors.length > 0 ? "error" : "info"}>{message}</Banner>}
      {fileLevelErrors.map((e, i) => (
        <Banner key={i} tone="error">{e.message}</Banner>
      ))}

      {drafts && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[12.5px] font-semibold text-white">
              {drafts.length} row{drafts.length === 1 ? "" : "s"}
            </span>
            {(["append", "replace"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-[12.5px] text-white">
                <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
                {m === "append" ? "Add to squad" : "Replace whole squad"}
              </label>
            ))}
          </div>

          {/* Rows stay editable here: the usual failures are a stray "Gk" or a
              missing number, and sending people back to the spreadsheet for
              that is punishing. */}
          <div className="scroll-x">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-white">
                  <th className="p-1">Line</th>
                  <th className="p-1">Name</th>
                  <th className="p-1">#</th>
                  <th className="p-1">Pos</th>
                  <th className="p-1">Role</th>
                  <th className="p-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, i) => {
                  const rowErrors = errorsByLine.get(d.line) ?? [];
                  const bad = (f: string) => rowErrors.some((e) => e.field === f);
                  const update = (patch: Partial<Draft>) =>
                    setDrafts(drafts.map((x, xi) => (xi === i ? { ...x, ...patch } : x)));
                  return (
                    <tr key={d.line} className={rowErrors.length ? "bg-loss/10" : ""}>
                      <td className="p-1 text-white">{d.line}</td>
                      <td className="p-1">
                        <input value={d.name} onChange={(e) => update({ name: e.target.value })}
                          className={`${field} w-full ${bad("name") ? "border-loss" : ""}`} />
                      </td>
                      <td className="p-1">
                        <input value={d.number} onChange={(e) => update({ number: e.target.value })}
                          className={`${field} w-14 ${bad("number") ? "border-loss" : ""}`} />
                      </td>
                      <td className="p-1">
                        <input value={d.position} onChange={(e) => update({ position: e.target.value.toUpperCase() })}
                          className={`${field} w-16 ${bad("position") ? "border-loss" : ""}`} />
                      </td>
                      <td className="p-1">
                        <input value={d.squadRole} onChange={(e) => update({ squadRole: e.target.value })}
                          className={`${field} w-28 ${bad("squadRole") ? "border-loss" : ""}`} />
                      </td>
                      <td className="p-1">
                        <input value={d.status} onChange={(e) => update({ status: e.target.value })}
                          className={`${field} w-24 ${bad("status") ? "border-loss" : ""}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {errors.filter((e) => e.line !== 0).length > 0 && (
            <ul className="space-y-1 text-[12.5px] text-loss">
              {errors
                .filter((e) => e.line !== 0)
                .map((e, i) => (
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
                : `Import ${drafts.length} player${drafts.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

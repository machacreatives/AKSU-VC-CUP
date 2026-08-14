"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/Skeleton";
import { queryKeys, useVenues } from "@/lib/api";
import { Venue } from "@/lib/types";
import { Banner, Notice, btnDanger, btnOutline, btnPrimary, btnSm, field, useNotice } from "./ui";

/**
 * The list of grounds a fixture can be played at.
 *
 * The venue used to be free text on every fixture form, which meant "AKSU Main
 * Bowl", "Main Bowl" and "main bowl" were three different places as far as the
 * site was concerned. Kept as a plain list rather than a foreign key: fixtures
 * still store the name they were played at, so removing a ground from the list
 * never rewrites a match that has already been played.
 */
export default function VenueSection() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const venuesQuery = useVenues();
  const venues: Venue[] = venuesQuery.data ?? [];

  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useNotice();

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.venues });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter the venue name.");

    setSaving(true);
    const res = await fetch("/api/admin/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) return setError(body.error ?? "Could not add the venue.");
    setName("");
    refresh();
    setNotice(`Added ${body.venue.name}.`);
  }

  async function rename() {
    if (!editing) return;
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, name: editing.name }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) return setError(body.error ?? "Could not rename the venue.");
    setEditing(null);
    refresh();
    setNotice("Venue renamed.");
  }

  async function remove(venue: Venue) {
    const ok = await confirm({
      title: `Remove ${venue.name}?`,
      body: (
        <p>
          It stops appearing in the fixture form. Matches already scheduled there keep their venue —
          nothing on the public site changes.
        </p>
      ),
      confirmLabel: "Remove venue",
      busyLabel: "Removing…",
      tone: "danger",
      onConfirm: async () => {
        const res = await fetch("/api/admin/venues", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: venue.id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not remove the venue.");
      },
    });
    if (!ok) return;
    refresh();
    setNotice(`Removed ${venue.name}.`);
  }

  return (
    <section id="venues" className="space-y-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">Venues</h2>
        <span className="text-[12px] text-white/70">
          {venues.length} ground{venues.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-[13.5px] text-white">
        The grounds offered when creating a fixture. Renaming one here does not change matches
        already scheduled at it.
      </p>

      {error && <Banner tone="error">{error}</Banner>}
      <Notice>{notice}</Notice>

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1 space-y-1">
          <span className="block text-[12px] font-semibold uppercase tracking-wide text-white">
            Add a venue
          </span>
          <input
            className={`${field} w-full`}
            placeholder="AKSU Main Bowl, Ikot Akpaden"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving…" : "Add venue"}
        </button>
      </form>

      {venuesQuery.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-card" />
          ))}
        </div>
      ) : venues.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-3 py-4 text-[13.5px] text-white/70">
          No venues yet. Add the grounds the tournament is played at and they become selectable on
          every fixture.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {venues.map((venue) => (
            <li key={venue.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              {editing?.id === venue.id ? (
                <>
                  <input
                    className={`${field} min-w-0 flex-1`}
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    autoFocus
                  />
                  <button onClick={rename} disabled={saving} className={`${btnPrimary} ${btnSm}`}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => setEditing(null)} className={`${btnOutline} ${btnSm}`}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
                    {venue.name}
                  </span>
                  <button
                    onClick={() => setEditing({ id: venue.id, name: venue.name })}
                    className={`${btnOutline} ${btnSm}`}
                  >
                    Rename
                  </button>
                  <button onClick={() => remove(venue)} className={`${btnDanger} ${btnSm}`}>
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

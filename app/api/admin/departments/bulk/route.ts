import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireSuperadmin } from "@/lib/require-admin";
import { getDepartments, getGroups, upsertGroup } from "@/lib/db/queries";
import { CAMPUS_LABELS, Campus, Group } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_ROWS = 64;

type IncomingRow = {
  line?: number;
  name?: string;
  shortName?: string;
  faculty?: string;
  campus?: string;
  group?: string;
  color?: string;
};

type RowError = { line: number; field: string; message: string };

// Spreadsheets say "Main Campus" and "Obio Akpa", not "obioakpa".
const CAMPUS_ALIASES: Record<string, Campus> = {
  main: "main",
  "main campus": "main",
  mc: "main",
  ikotakpaden: "main",
  "ikot akpaden": "main",
  obioakpa: "obioakpa",
  "obio akpa": "obioakpa",
  "obio-akpa": "obioakpa",
  "obio akpa campus": "obioakpa",
  oac: "obioakpa",
};

// Assigned when the colour column is blank. Spread around the wheel so two
// teams imported together never come out looking the same on a badge.
const FALLBACK_COLORS = [
  "#F2661F", "#2E86DE", "#1FD97A", "#F4B740", "#B94592", "#00B8A9",
  "#FF6B6B", "#7B61FF", "#F0A500", "#4CAF50", "#E14D2A", "#3C6EE0",
  "#C0392B", "#16A085", "#8E44AD", "#D35400",
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function POST(req: Request) {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const dryRun = body.dryRun === true;
    // "update" refreshes teams that already exist, matched on short name.
    // There is deliberately no "replace": wiping every team would cascade the
    // squads away and break every fixture pointing at them.
    const mode = body.mode === "update" ? "update" : "append";
    const rows: IncomingRow[] = Array.isArray(body.rows) ? body.rows : [];

    if (rows.length === 0) {
      return NextResponse.json({ error: "Nothing to import." }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `That is ${rows.length} rows. Import at most ${MAX_ROWS} at a time.` },
        { status: 400 }
      );
    }

    const existingTeams = await getDepartments();
    const byShortName = new Map(existingTeams.map((t) => [t.shortName.toLowerCase(), t]));
    const groups = await getGroups();

    const errors: RowError[] = [];
    const seenShortNames = new Map<string, number>();
    // Groups named in the file that do not exist yet. Created on import rather
    // than rejected: on a fresh database there are no groups at all, and making
    // someone create four by hand before they can upload sixteen teams is the
    // opposite of a bulk import.
    const newGroups = new Map<string, Group>();

    const clean: {
      id: string;
      name: string;
      shortName: string;
      faculty: string;
      campus: Campus;
      group: string;
      color: string;
      isUpdate: boolean;
    }[] = [];

    rows.forEach((row, index) => {
      const line = row.line ?? index + 2;
      const name = String(row.name ?? "").trim();
      const shortName = String(row.shortName ?? "").trim().toUpperCase();
      const faculty = String(row.faculty ?? "").trim();
      const campusRaw = String(row.campus ?? "").trim();
      const groupRaw = String(row.group ?? "").trim();
      const colorRaw = String(row.color ?? "").trim();

      if (!name) errors.push({ line, field: "name", message: "Team name is required." });
      if (!faculty) errors.push({ line, field: "faculty", message: "Faculty is required." });

      const campus = CAMPUS_ALIASES[campusRaw.toLowerCase()];
      if (!campus) {
        errors.push({
          line,
          field: "campus",
          message: campusRaw
            ? `"${campusRaw}" is not a campus. Use main or obioakpa.`
            : "Campus is required. Use main or obioakpa.",
        });
      }

      const existing = byShortName.get(shortName.toLowerCase());
      if (!shortName) {
        errors.push({ line, field: "shortName", message: "Short name is required." });
      } else if (shortName.length < 2 || shortName.length > 3) {
        errors.push({
          line,
          field: "shortName",
          message: `"${shortName}" must be 2 or 3 characters — it is the badge label.`,
        });
      } else if (seenShortNames.has(shortName)) {
        errors.push({
          line,
          field: "shortName",
          message: `${shortName} is also on line ${seenShortNames.get(shortName)}.`,
        });
      } else {
        seenShortNames.set(shortName, line);
        if (existing && mode === "append") {
          errors.push({
            line,
            field: "shortName",
            message: `${shortName} already belongs to ${existing.name}. Switch to "Update existing" to overwrite it.`,
          });
        }
      }

      // The group is matched by name within the campus, so two campuses could
      // each have their own "A" without colliding.
      let groupId = "";
      if (!groupRaw) {
        errors.push({ line, field: "group", message: "Group is required." });
      } else if (campus) {
        const match =
          groups.find(
            (g) => g.campus === campus && g.name.toLowerCase() === groupRaw.toLowerCase()
          ) ??
          [...newGroups.values()].find(
            (g) => g.campus === campus && g.name.toLowerCase() === groupRaw.toLowerCase()
          );

        if (match) {
          groupId = match.id;
        } else {
          const elsewhere = groups.find((g) => g.name.toLowerCase() === groupRaw.toLowerCase());
          if (elsewhere) {
            errors.push({
              line,
              field: "group",
              message: `Group ${elsewhere.name} is on ${CAMPUS_LABELS[elsewhere.campus]}, but this team is on ${CAMPUS_LABELS[campus]}.`,
            });
          } else {
            const id = slugify(groupRaw) || `g${newGroups.size + 1}`;
            const created: Group = {
              id,
              name: groupRaw,
              campus,
              sortOrder: groups.length + newGroups.size + 1,
            };
            newGroups.set(id, created);
            groupId = id;
          }
        }
      }

      let color = colorRaw.toUpperCase();
      if (!color) {
        color = existing?.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
      } else if (!/^#[0-9A-F]{6}$/.test(color)) {
        errors.push({
          line,
          field: "color",
          message: `"${colorRaw}" is not a hex colour like #F2661F. Leave it blank to have one chosen.`,
        });
      }

      clean.push({
        id: existing?.id ?? `${slugify(shortName) || "team"}-${Date.now().toString(36).slice(-4)}`,
        name,
        shortName,
        faculty,
        campus: campus ?? "main",
        group: groupId,
        color,
        isUpdate: Boolean(existing),
      });
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: "Some rows need attention.", rows: errors }, { status: 400 });
    }

    const creating = clean.filter((r) => !r.isUpdate).length;
    const updating = clean.length - creating;

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        ready: clean.length,
        creating,
        updating,
        newGroups: [...newGroups.values()].map((g) => ({ name: g.name, campus: g.campus })),
      });
    }

    // Groups first — a team row cannot reference a group that is not there yet,
    // and the foreign key would reject the whole insert.
    for (const group of newGroups.values()) {
      await upsertGroup(group);
    }

    // One multi-row upsert: atomic on its own, so no explicit transaction is
    // needed with the HTTP-mode driver.
    await sql.query(
      `INSERT INTO departments (id, name, short_name, faculty, campus, "group", color)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, short_name = EXCLUDED.short_name, faculty = EXCLUDED.faculty,
         campus = EXCLUDED.campus, "group" = EXCLUDED."group", color = EXCLUDED.color`,
      [
        clean.map((r) => r.id),
        clean.map((r) => r.name),
        clean.map((r) => r.shortName),
        clean.map((r) => r.faculty),
        clean.map((r) => r.campus),
        clean.map((r) => r.group),
        clean.map((r) => r.color),
      ]
    );

    return NextResponse.json({
      ok: true,
      imported: clean.length,
      created: creating,
      updated: updating,
      newGroups: [...newGroups.values()].map((g) => g.name),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

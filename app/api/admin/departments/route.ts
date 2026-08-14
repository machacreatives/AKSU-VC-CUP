import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireAdmin } from "@/lib/require-admin";
import { deleteDepartment, getDepartments, upsertDepartment } from "@/lib/db/queries";
import { CAMPUS_GROUPS, Campus, Department, GroupId } from "@/lib/types";

export const dynamic = "force-dynamic";

const CAMPUSES: Campus[] = ["main", "obioakpa"];

// Teams are called "departments" in the database and the API because that is
// what they are — the UI says "teams" because that is what they are on a pitch.

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();

    const isUpdate = typeof body.id === "string" && body.id.length > 0;
    const existing = isUpdate ? (await getDepartments()).find((d) => d.id === body.id) : null;
    if (isUpdate && !existing) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    // Fall back to stored values so a partial payload cannot blank a field it
    // never mentioned.
    const name = String(body.name ?? existing?.name ?? "").trim();
    const shortName = String(body.shortName ?? existing?.shortName ?? "").trim().toUpperCase();
    const faculty = String(body.faculty ?? existing?.faculty ?? "").trim();
    const campus = (body.campus ?? existing?.campus) as Campus;
    const group = (body.group ?? existing?.group) as GroupId;
    const color = String(body.color ?? existing?.color ?? "").trim();

    if (!name) return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    if (shortName.length < 2 || shortName.length > 3) {
      // The public badge renders the first three characters, so anything longer
      // is silently truncated on the site.
      return NextResponse.json(
        { error: "Short name must be 2 or 3 characters (it is the badge label)." },
        { status: 400 }
      );
    }
    if (!faculty) return NextResponse.json({ error: "Faculty is required." }, { status: 400 });
    if (!CAMPUSES.includes(campus)) {
      return NextResponse.json({ error: "Pick a campus." }, { status: 400 });
    }
    if (!CAMPUS_GROUPS[campus].includes(group)) {
      return NextResponse.json(
        {
          error: `Group ${group ?? "?"} is not on that campus. ${
            campus === "main" ? "Main Campus" : "Obio Akpa Campus"
          } teams must be in Group ${CAMPUS_GROUPS[campus].join(" or ")}.`,
        },
        { status: 400 }
      );
    }
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      return NextResponse.json({ error: "Colour must be a hex value like #F2661F." }, { status: 400 });
    }

    // Short names are the badge, so they have to be distinguishable.
    const { rows: clash } = await sql`
      SELECT id, name FROM departments
      WHERE LOWER(short_name) = LOWER(${shortName}) AND id <> ${body.id ?? ""}
    `;
    if (clash.length > 0) {
      return NextResponse.json(
        { error: `Short name ${shortName} is already used by ${clash[0].name}.` },
        { status: 409 }
      );
    }

    const department: Department = {
      id: isUpdate ? body.id : `${slugify(shortName)}-${Date.now().toString(36).slice(-4)}`,
      name,
      shortName,
      faculty,
      campus,
      group,
      color: color.toUpperCase(),
    };

    await upsertDepartment(department);
    return NextResponse.json({ ok: true, department });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await req.json();
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Missing team id." }, { status: 400 });
    }

    // matches.home/away_department_id have no ON DELETE rule, so deleting a team
    // with fixtures raises a foreign key error the caller cannot interpret.
    // Check first and say something useful instead.
    const { rows: fixtures } = await sql`
      SELECT COUNT(*)::int AS n FROM matches
      WHERE home_department_id = ${id} OR away_department_id = ${id}
    `;
    if (fixtures[0].n > 0) {
      return NextResponse.json(
        {
          error: `This team appears in ${fixtures[0].n} fixture${
            fixtures[0].n === 1 ? "" : "s"
          }. Delete those first.`,
        },
        { status: 409 }
      );
    }

    await deleteDepartment(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

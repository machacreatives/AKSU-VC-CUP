import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/require-admin";
import { countMatchesAtVenue, deleteVenue, getVenues, upsertVenue } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const MAX_NAME = 80;

/** "AKSU Main Bowl, Ikot Akpaden" -> "aksu-main-bowl-ikot-akpaden" */
function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET() {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    return NextResponse.json(await getVenues());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");

    if (!name) return NextResponse.json({ error: "Enter the venue name." }, { status: 400 });
    if (name.length > MAX_NAME) {
      return NextResponse.json({ error: `Keep the name under ${MAX_NAME} characters.` }, { status: 400 });
    }

    const existing = await getVenues();
    const isRename = typeof body.id === "string" && body.id.length > 0;
    const id = isRename ? String(body.id) : slugify(name);

    if (!id) {
      return NextResponse.json({ error: "That name has no letters or numbers in it." }, { status: 400 });
    }
    if (isRename && !existing.some((v) => v.id === id)) {
      return NextResponse.json({ error: "Venue not found." }, { status: 404 });
    }
    // The unique index on LOWER(name) would reject this anyway, as a 23505 with
    // no explanation attached.
    if (existing.some((v) => v.id !== id && v.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: `${name} is already on the list.` }, { status: 409 });
    }
    if (!isRename && existing.some((v) => v.id === id)) {
      return NextResponse.json({ error: `${name} is already on the list.` }, { status: 409 });
    }

    await upsertVenue({ id, name });
    return NextResponse.json({ ok: true, venue: { id, name } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await req.json();
    if (typeof id !== "string") {
      return NextResponse.json({ error: "Missing venue id." }, { status: 400 });
    }

    const venue = (await getVenues()).find((v) => v.id === id);
    if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });

    // Fixtures keep the venue as text, so this is safe — but say how many are
    // affected so the count in the confirmation is the real one.
    const fixtures = await countMatchesAtVenue(venue.name);
    await deleteVenue(id);
    return NextResponse.json({ ok: true, fixtures });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

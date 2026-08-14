import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/require-admin";
import { recordAudit } from "@/lib/db/audit";
import {
  countGroupUsage,
  deleteGroup,
  getGroups,
  mergeGroupInto,
  upsertGroup,
} from "@/lib/db/queries";
import { CAMPUSES, Campus, Group } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_NAME = 24;

/** "E" -> "e", "Plate Final" -> "plate-final". The id a team stores. */
function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export async function POST(req: Request) {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    const campus = body.campus as Campus;

    if (!name) return NextResponse.json({ error: "Enter the group name." }, { status: 400 });
    if (name.length > MAX_NAME) {
      return NextResponse.json(
        { error: `Keep the group name under ${MAX_NAME} characters.` },
        { status: 400 }
      );
    }
    if (!CAMPUSES.includes(campus)) {
      return NextResponse.json({ error: "Pick a campus for the group." }, { status: 400 });
    }

    const existing = await getGroups();
    const isUpdate = typeof body.id === "string" && body.id.length > 0;
    const current = isUpdate ? existing.find((g) => g.id === body.id) : null;

    if (isUpdate && !current) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    // Two groups called "A" would be indistinguishable everywhere they appear.
    // The clash is reported under the *existing* group's name, not the one just
    // typed — "Group e already exists" when Group E is what's there reads like
    // a different problem.
    const clash = existing.find(
      (g) => g.id !== current?.id && g.name.toLowerCase() === name.toLowerCase()
    );
    if (clash) {
      return NextResponse.json({ error: `Group ${clash.name} already exists.` }, { status: 409 });
    }

    // The id is what teams and fixtures store, so it is fixed at creation —
    // renaming a group must not orphan everything pointing at it.
    const id = current?.id ?? slugify(name);
    if (!id) {
      return NextResponse.json(
        { error: "That name has no letters or numbers in it." },
        { status: 400 }
      );
    }
    const idClash = !current && existing.find((g) => g.id === id);
    if (idClash) {
      return NextResponse.json({ error: `Group ${idClash.name} already exists.` }, { status: 409 });
    }

    const sortOrder = Number.isInteger(body.sortOrder)
      ? Number(body.sortOrder)
      : current?.sortOrder ?? existing.length + 1;

    const group: Group = { id, name, campus, sortOrder };

    // Moving a group to the other campus would strand its teams on the wrong
    // one, since a team's campus and its group's campus have to agree.
    if (current && current.campus !== campus) {
      const usage = await countGroupUsage(id);
      if (usage.teams > 0) {
        return NextResponse.json(
          {
            error: `Group ${current.name} has ${usage.teams} team${
              usage.teams === 1 ? "" : "s"
            } on ${current.campus === "main" ? "Main Campus" : "Obio Akpa Campus"}. Move them out before changing its campus.`,
          },
          { status: 409 }
        );
      }
    }

    await upsertGroup(group);
    return NextResponse.json({ ok: true, group });
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
    const body = await req.json();
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing group id." }, { status: 400 });

    const groups = await getGroups();
    const group = groups.find((g) => g.id === id);
    if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

    const usage = await countGroupUsage(id);

    // `moveTo` lets the admin retire a group and send its teams somewhere in
    // one action, instead of reassigning each team by hand first.
    const moveTo = body.moveTo ? String(body.moveTo) : "";
    if (moveTo) {
      const target = groups.find((g) => g.id === moveTo);
      if (!target) return NextResponse.json({ error: "Unknown destination group." }, { status: 400 });
      if (target.id === id) {
        return NextResponse.json({ error: "Pick a different group to move into." }, { status: 400 });
      }
      if (target.campus !== group.campus) {
        return NextResponse.json(
          { error: `Group ${target.name} is on the other campus, so its teams cannot move there.` },
          { status: 400 }
        );
      }
      await mergeGroupInto(id, target.id);

      await recordAudit({
        actor: auth.user,
        action: "group.delete",
        targetType: "group",
        targetId: id,
        targetLabel: group.name,
        detail: { movedTo: target.name, teams: usage.teams, matches: usage.matches },
      });

      return NextResponse.json({ ok: true, movedTo: target.name, ...usage });
    }

    if (usage.teams > 0 || usage.matches > 0) {
      const parts = [
        usage.teams > 0 ? `${usage.teams} team${usage.teams === 1 ? "" : "s"}` : "",
        usage.matches > 0 ? `${usage.matches} fixture${usage.matches === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      return NextResponse.json(
        {
          error: `Group ${group.name} still has ${parts.join(" and ")}. Move them to another group first, or delete them.`,
          ...usage,
        },
        { status: 409 }
      );
    }

    await deleteGroup(id);

    await recordAudit({
      actor: auth.user,
      action: "group.delete",
      targetType: "group",
      targetId: id,
      targetLabel: group.name,
      detail: { campus: group.campus, teams: 0, matches: 0 },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/require-admin";
import { recordAudit } from "@/lib/db/audit";
import { getDepartments } from "@/lib/db/queries";
import { ADMIN_ROLES, AdminRole } from "@/lib/types";
import {
  countAdminUsers,
  countSuperadmins,
  createAdminUser,
  deleteAdminUser,
  getAdminUserById,
  isUniqueViolation,
  listAdminUsers,
  updateAdminUser,
} from "@/lib/db/users";
import { validatePassword } from "@/lib/password";

export const dynamic = "force-dynamic";

// Managing accounts is a superadmin job throughout. The roster itself is
// restricted too — a team admin has no business knowing who else can sign in.

/**
 * Validate a role and the team that must or must not accompany it.
 *
 * A TEAM_ADMIN without a team is an account that can reach nothing; a
 * SUPERADMIN with one is ambiguous about what it is scoped to.
 */
type RoleChoice =
  | { ok: true; role: AdminRole; departmentId: string | null }
  | { ok: false; error: string };

async function readRole(body: any): Promise<RoleChoice> {
  const role = (body.role ?? "TEAM_ADMIN") as AdminRole;
  if (!ADMIN_ROLES.includes(role)) {
    return { ok: false, error: "Pick a role." };
  }

  if (role === "SUPERADMIN") return { ok: true, role, departmentId: null };

  const departmentId = String(body.departmentId ?? "");
  if (!departmentId) {
    return { ok: false, error: "A team admin needs a team." };
  }
  const exists = (await getDepartments()).some((d) => d.id === departmentId);
  if (!exists) return { ok: false, error: "Unknown team." };

  return { ok: true, role, departmentId };
}

export async function GET() {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    return NextResponse.json(await listAdminUsers());
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
    const { username, password, displayName } = body;

    if (typeof username !== "string" || username.trim().length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters." },
        { status: 400 }
      );
    }
    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const role = await readRole(body);
    if (!role.ok) return NextResponse.json({ error: role.error }, { status: 400 });

    const user = await createAdminUser(
      username,
      password,
      displayName,
      role.role,
      role.departmentId
    );
    await recordAudit({
      actor: auth.user,
      action: "user.create",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.username,
      detail: { role: user.role, departmentId: user.departmentId },
    });

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Change an existing account's role or team. There was no way to edit an
// account at all before this; the only options were create and delete.
export async function PATCH(req: Request) {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing user id." }, { status: 400 });

    const target = await getAdminUserById(id);
    if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const role = await readRole(body);
    if (!role.ok) return NextResponse.json({ error: role.error }, { status: 400 });

    // Demoting the last superadmin leaves a tournament nobody can run: no
    // fixtures, no groups, and nobody who can promote anyone back.
    if (
      target.role === "SUPERADMIN" &&
      role.role !== "SUPERADMIN" &&
      (await countSuperadmins()) <= 1
    ) {
      return NextResponse.json(
        { error: "There must be at least one superadmin." },
        { status: 400 }
      );
    }

    const user = await updateAdminUser(id, {
      role: role.role,
      departmentId: role.departmentId,
      displayName: typeof body.displayName === "string" ? body.displayName.trim() : undefined,
    });
    // Only reachable if the row vanished between the lookup above and the
    // update -- two superadmins editing and deleting the same account at once.
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    // Only worth a line when the permissions actually moved. Renaming an
    // account is not a security event, and logging it would dilute the ones
    // that are.
    if (target.role !== user.role || target.departmentId !== user.departmentId) {
      await recordAudit({
        actor: auth.user,
        action: "user.role_change",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.username,
        detail: {
          from: { role: target.role, departmentId: target.departmentId },
          to: { role: user.role, departmentId: user.departmentId },
        },
      });
    }

    return NextResponse.json({ ok: true, user });
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
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    if (id === auth.user.id) {
      return NextResponse.json(
        { error: "You cannot delete the account you are signed in as." },
        { status: 400 }
      );
    }

    const target = await getAdminUserById(id);
    if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    // Never let the last administrator be removed, or the dashboard becomes
    // unreachable and setup is already closed.
    if ((await countAdminUsers()) <= 1) {
      return NextResponse.json(
        { error: "There must be at least one administrator." },
        { status: 400 }
      );
    }
    // Nor the last superadmin, even when other accounts remain — a room full of
    // team admins cannot create a fixture between them.
    if (target.role === "SUPERADMIN" && (await countSuperadmins()) <= 1) {
      return NextResponse.json(
        { error: "There must be at least one superadmin." },
        { status: 400 }
      );
    }

    await deleteAdminUser(id);

    await recordAudit({
      actor: auth.user,
      action: "user.delete",
      targetType: "user",
      targetId: id,
      targetLabel: target.username,
      detail: { role: target.role, departmentId: target.departmentId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

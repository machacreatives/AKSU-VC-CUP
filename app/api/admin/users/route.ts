import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import {
  countAdminUsers,
  createAdminUser,
  deleteAdminUser,
  isUniqueViolation,
  listAdminUsers,
} from "@/lib/db/users";
import { validatePassword } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
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
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { username, password, displayName } = await req.json();

    if (typeof username !== "string" || username.trim().length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters." },
        { status: 400 }
      );
    }
    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const user = await createAdminUser(username, password, displayName);
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

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
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

    // Never let the last administrator be removed, or the dashboard becomes
    // unreachable and setup is already closed.
    if ((await countAdminUsers()) <= 1) {
      return NextResponse.json(
        { error: "There must be at least one administrator." },
        { status: 400 }
      );
    }

    await deleteAdminUser(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

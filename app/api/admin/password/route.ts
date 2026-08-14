import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { recordAudit } from "@/lib/db/audit";
import { getAdminUserByUsername, setAdminPassword } from "@/lib/db/users";
import { validatePassword, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

// Change the signed-in administrator's own password. Requires the current
// password as well as the session, so someone who walks up to an unlocked
// machine cannot lock the real owner out.
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { currentPassword, newPassword } = await req.json();

    // Re-read by username to get the password hash, which requireAdmin omits.
    const user = await getAdminUserByUsername(auth.user.username);
    if (!user) return NextResponse.json({ error: "Account no longer exists." }, { status: 401 });

    if (typeof currentPassword !== "string" || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    await setAdminPassword(user.id, newPassword);

    // Not destructive, but the single most useful line in the log if an account
    // is ever suspected of being taken over.
    await recordAudit({
      actor: auth.user,
      action: "user.password_reset",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.username,
      detail: { self: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

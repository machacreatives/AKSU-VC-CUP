import { NextResponse } from "next/server";
import { COOKIE_NAME, createSessionToken, verifyCredentials } from "@/lib/auth";

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !(await verifyCredentials(username, password))
  ) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    // A `secure` cookie is dropped by the browser over plain http://localhost,
    // which silently broke login in development.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

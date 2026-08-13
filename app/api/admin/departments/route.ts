import { NextResponse } from "next/server";
import { upsertDepartment, deleteDepartment } from "@/lib/db/queries";
import { Department } from "@/lib/types";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const dept = (await req.json()) as Department;
  await upsertDepartment(dept);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await req.json();
  await deleteDepartment(id);
  return NextResponse.json({ ok: true });
}

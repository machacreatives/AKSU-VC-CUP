import { NextResponse } from "next/server";
import { upsertDepartment, deleteDepartment } from "@/lib/db/queries";
import { Department } from "@/lib/types";

export async function POST(req: Request) {
  const dept = (await req.json()) as Department;
  await upsertDepartment(dept);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await deleteDepartment(id);
  return NextResponse.json({ ok: true });
}

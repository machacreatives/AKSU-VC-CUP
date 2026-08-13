import { NextResponse } from "next/server";
import { getDepartments } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const departments = await getDepartments();
  return NextResponse.json(departments);
}

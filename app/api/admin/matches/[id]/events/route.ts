import { NextResponse } from "next/server";
import { addMatchEvent, deleteMatchEvent } from "@/lib/db/queries";
import { MatchEvent } from "@/lib/types";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const event = (await req.json()) as MatchEvent;
  await addMatchEvent(params.id, event);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { eventId } = await req.json();
  await deleteMatchEvent(eventId);
  return NextResponse.json({ ok: true });
}

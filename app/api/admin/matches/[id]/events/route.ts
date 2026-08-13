import { NextResponse } from "next/server";
import { addMatchEvent, deleteMatchEvent } from "@/lib/db/queries";
import { MatchEvent } from "@/lib/types";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const event = (await req.json()) as MatchEvent;
  await addMatchEvent(params.id, event);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { eventId } = await req.json();
  await deleteMatchEvent(eventId);
  return NextResponse.json({ ok: true });
}

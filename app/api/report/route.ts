import { NextResponse } from "next/server";
import { reportBodySchema } from "@/lib/validation";
import { resolveRoomByToken } from "@/lib/rooms";
import { triage } from "@/lib/triage";
import { computeDeadlines } from "@/lib/sla";
import { getServiceClient } from "@/lib/supabase";
import { nextTicketNumber } from "@/lib/ticket-number";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // 1. Validate input.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = reportBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // 2. Resolve the room from the QR token.
  const room = await resolveRoomByToken(input.roomToken);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // 3. AI triage (always returns a valid result; falls back on failure).
  const result = await triage({
    issueTypeHint: input.issueTypeHint ?? null,
    description: input.description,
    meetingImpact: input.meetingImpact,
    room: {
      name: room.name,
      roomType: room.roomType,
      assets: room.assets,
    },
  });

  // 4. SLA deadlines from the suggested priority.
  const now = new Date();
  const { responseDueAt, resolutionDueAt } = computeDeadlines(
    result.suggestedPriority,
    now
  );

  // 5. Ticket number (per-year sequence).
  const db = getServiceClient();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  const { count } = await db
    .from("ticket")
    .select("*", { count: "exact", head: true })
    .gte("created_at", yearStart);
  const ticketNumber = nextTicketNumber(now, count ?? 0);

  // 6. Insert.
  const { error } = await db.from("ticket").insert({
    ticket_number: ticketNumber,
    room_id: room.id,
    reporter_name: input.reporterName ?? null,
    reporter_contact: input.reporterContact ?? null,
    source: "QR",
    issue_type: result.issueType,
    description: input.description,
    photo_url: input.photoUrl ?? null,
    meeting_impact: input.meetingImpact,
    priority: result.suggestedPriority,
    ai_suggested_priority: result.suggestedPriority,
    ai_suggested_issue_type: result.issueType,
    ai_likely_cause: result.likelyCause,
    ai_recurring_flag: result.recurringIssue,
    ai_reasoning: result.reasoning,
    status: "NEW",
    created_at: now.toISOString(),
    response_due_at: responseDueAt.toISOString(),
    resolution_due_at: resolutionDueAt.toISOString(),
  });

  if (error) {
    return NextResponse.json(
      { error: "Could not create ticket" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ticketNumber }, { status: 201 });
}

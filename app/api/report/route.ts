import { NextResponse } from "next/server";
import { reportBodySchema } from "@/lib/validation";
import { resolveRoomByToken } from "@/lib/rooms";
import { triage } from "@/lib/triage";
import { computeDeadlines } from "@/lib/sla";
import { getServiceClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  // 0. Rate limit (best-effort, per-instance) BEFORE any expensive work,
  //    so bursts can't run up AI cost. See lib/rate-limit.ts.
  const rl = checkRateLimit(clientIp(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  // 1. Validate input (zod; length-capped, enum-bounded).
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
    room: { name: room.name, roomType: room.roomType, assets: room.assets },
  });

  // 4. SLA deadlines from the suggested priority.
  const now = new Date();
  const { responseDueAt, resolutionDueAt } = computeDeadlines(
    result.suggestedPriority,
    now
  );

  // 5. Insert. The DATABASE generates ticket_number atomically from a sequence
  //    default (see migration), so concurrent submissions never collide.
  const db = getServiceClient();
  const { data: inserted, error } = await db
    .from("ticket")
    .insert({
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
      ai_source: result.source, // 'ai' or 'fallback' — for verification
      status: "NEW",
      created_at: now.toISOString(),
      response_due_at: responseDueAt.toISOString(),
      resolution_due_at: resolutionDueAt.toISOString(),
    })
    .select("ticket_number")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: "Could not create ticket" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ticketNumber: inserted.ticket_number },
    { status: 201 }
  );
}

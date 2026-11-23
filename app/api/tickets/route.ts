import { NextResponse } from "next/server";
import { requireCoordinator } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { computeSlaState, type SlaState } from "@/lib/sla";
import type { Priority } from "@/lib/enums";

export const runtime = "nodejs";

const STATE_ORDER: Record<SlaState, number> = {
  BREACHED: 0,
  AT_RISK: 1,
  ON_TRACK: 2,
};
const PRIORITY_ORDER: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

export async function GET(req: Request) {
  const authz = await requireCoordinator(req);
  if (authz === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (authz === "FORBIDDEN") {
    return NextResponse.json(
      { error: "Forbidden: coordinators only" },
      { status: 403 }
    );
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from("ticket")
    .select(
      "id, ticket_number, issue_type, priority, status, meeting_impact, ai_suggested_priority, ai_likely_cause, ai_recurring_flag, ai_source, created_at, resolution_due_at, responded_at, resolved_at, room:room_id(name)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const now = new Date();
  const tickets = (data ?? []).map((t) => {
    const slaState = computeSlaState(now, {
      createdAt: new Date(t.created_at as string),
      resolutionDueAt: new Date(t.resolution_due_at as string),
      resolvedAt: t.resolved_at ? new Date(t.resolved_at as string) : null,
    });
    const room = t.room as unknown as { name: string } | null;
    return {
      id: t.id as string,
      ticketNumber: t.ticket_number as string,
      roomName: room?.name ?? "",
      issueType: t.issue_type as string,
      priority: t.priority as Priority,
      aiSuggestedPriority: t.ai_suggested_priority as Priority | null,
      status: t.status as string,
      meetingImpact: t.meeting_impact as string,
      likelyCause: t.ai_likely_cause as string | null,
      recurring: t.ai_recurring_flag as boolean,
      aiSource: (t.ai_source as string | null) ?? "fallback",
      createdAt: t.created_at as string,
      slaState,
    };
  });

  tickets.sort((a, b) => {
    const s = STATE_ORDER[a.slaState] - STATE_ORDER[b.slaState];
    if (s !== 0) return s;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });

  return NextResponse.json({ tickets });
}

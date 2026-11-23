import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { ticketPatchSchema } from "@/lib/validation";
import { computeDeadlines } from "@/lib/sla";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ticketPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = getServiceClient();
  const { data: existing, error: readErr } = await db
    .from("ticket")
    .select("created_at, responded_at, status")
    .eq("id", params.id)
    .maybeSingle();
  if (readErr || !existing) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const now = new Date();
  const update: Record<string, unknown> = {};

  // Priority change recomputes SLA deadlines from the original creation time.
  if (parsed.data.priority) {
    update.priority = parsed.data.priority;
    const { responseDueAt, resolutionDueAt } = computeDeadlines(
      parsed.data.priority,
      new Date(existing.created_at as string)
    );
    update.response_due_at = responseDueAt.toISOString();
    update.resolution_due_at = resolutionDueAt.toISOString();
  }

  if (parsed.data.status) {
    update.status = parsed.data.status;
    // First move off NEW records the response time.
    if (
      parsed.data.status !== "NEW" &&
      !existing.responded_at
    ) {
      update.responded_at = now.toISOString();
    }
    if (parsed.data.status === "RESOLVED") {
      update.resolved_at = now.toISOString();
    }
  }

  const { error } = await db.from("ticket").update(update).eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

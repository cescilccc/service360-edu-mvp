// SLA engine — pure functions, no I/O, so they are fully unit-testable.
// Business-hours clock: Mon–Fri 09:00–18:00 Asia/Manila (UTC+8, no DST).

import { AT_RISK_THRESHOLD, COVERAGE, SLA_POLICY } from "./sla-policy";
import type { Priority } from "./enums";

const OFFSET_MS = COVERAGE.utcOffsetMinutes * 60_000;

// A "local" Date whose UTC getters read Manila wall-clock values.
function toLocal(d: Date): Date {
  return new Date(d.getTime() + OFFSET_MS);
}
function fromLocal(d: Date): Date {
  return new Date(d.getTime() - OFFSET_MS);
}

function isWorkDay(local: Date): boolean {
  return (COVERAGE.workDays as readonly number[]).includes(local.getUTCDay());
}

function windowStart(local: Date): Date {
  const s = new Date(local);
  s.setUTCHours(COVERAGE.startHour, 0, 0, 0);
  return s;
}
function windowEnd(local: Date): Date {
  const e = new Date(local);
  e.setUTCHours(COVERAGE.endHour, 0, 0, 0);
  return e;
}

// Advance a local time to the next instant inside coverage (itself if already inside).
function nextOpen(local: Date): Date {
  let cur = new Date(local);
  for (let i = 0; i < 31; i++) {
    if (isWorkDay(cur)) {
      const ws = windowStart(cur);
      const we = windowEnd(cur);
      if (cur < ws) return ws;
      if (cur >= ws && cur < we) return cur;
    }
    const next = new Date(cur);
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(COVERAGE.startHour, 0, 0, 0);
    cur = next;
  }
  return cur;
}

/** Add business minutes to `start`, skipping nights and weekends. */
export function addBusinessMinutes(start: Date, minutes: number): Date {
  let local = nextOpen(toLocal(start));
  let remaining = minutes;
  let guard = 0;
  while (remaining > 0 && guard++ < 10000) {
    const we = windowEnd(local);
    const avail = Math.floor((we.getTime() - local.getTime()) / 60_000);
    if (remaining <= avail) {
      local = new Date(local.getTime() + remaining * 60_000);
      remaining = 0;
    } else {
      remaining -= avail;
      const nextDay = new Date(we);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      nextDay.setUTCHours(COVERAGE.startHour, 0, 0, 0);
      local = nextOpen(nextDay);
    }
  }
  return fromLocal(local);
}

/** Add wall-clock (calendar) minutes to `start`. */
export function addCalendarMinutes(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60_000);
}

export interface Deadlines {
  responseDueAt: Date;
  resolutionDueAt: Date;
}

export function computeDeadlines(priority: Priority, createdAt: Date): Deadlines {
  const rule = SLA_POLICY[priority];
  const add =
    rule.clock === "BUSINESS" ? addBusinessMinutes : addCalendarMinutes;
  return {
    responseDueAt: add(createdAt, rule.responseMinutes),
    resolutionDueAt: add(createdAt, rule.resolutionMinutes),
  };
}

export type SlaState = "ON_TRACK" | "AT_RISK" | "BREACHED";

export function computeSlaState(
  now: Date,
  ticket: {
    createdAt: Date;
    resolutionDueAt: Date;
    resolvedAt?: Date | null;
  }
): SlaState {
  if (ticket.resolvedAt) return "ON_TRACK"; // resolved tickets never show breached
  if (now.getTime() > ticket.resolutionDueAt.getTime()) return "BREACHED";
  const total = ticket.resolutionDueAt.getTime() - ticket.createdAt.getTime();
  const elapsed = now.getTime() - ticket.createdAt.getTime();
  if (total > 0 && elapsed / total >= AT_RISK_THRESHOLD) return "AT_RISK";
  return "ON_TRACK";
}

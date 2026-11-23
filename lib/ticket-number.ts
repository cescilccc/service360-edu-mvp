// Ticket number format: SR-YYYY-NNNNNN
//
// In production the DATABASE generates the number atomically from a sequence
// default (see supabase/migrations/0001_init.sql) so concurrent inserts never
// collide. This pure helper documents/validates the format and is handy for
// tests and any client-side display.

export function formatTicketNumber(year: number, sequence: number): string {
  return `SR-${year}-${String(sequence).padStart(6, "0")}`;
}

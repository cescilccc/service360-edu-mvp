// Human-friendly ticket number: SR-YYYY-NNNNNN

export function formatTicketNumber(year: number, sequence: number): string {
  return `SR-${year}-${String(sequence).padStart(6, "0")}`;
}

export function nextTicketNumber(
  now: Date,
  countThisYear: number
): string {
  return formatTicketNumber(now.getUTCFullYear(), countThisYear + 1);
}

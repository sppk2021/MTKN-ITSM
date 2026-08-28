/**
 * Helper utility to generate sequential 4-digit IDs starting at 0001
 * Example: TK-0001, TK-0002, TK-0003...
 * Example: RP-0001, RP-0002, RP-0003...
 */

export function generateNextTicketCode(existingTickets: Array<{ ticketCode?: string }> = []): string {
  let maxSeq = 0;

  for (const t of existingTickets) {
    if (!t.ticketCode) continue;
    const match = t.ticketCode.match(/(?:TK-)?(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextNumber = maxSeq + 1;
  return `TK-${String(nextNumber).padStart(4, '0')}`;
}

export function generateNextRepairCode(existingRepairs: Array<{ repairCode?: string }> = []): string {
  let maxSeq = 0;

  for (const r of existingRepairs) {
    if (!r.repairCode) continue;
    const match = r.repairCode.match(/(?:RP-)?(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextNumber = maxSeq + 1;
  return `RP-${String(nextNumber).padStart(4, '0')}`;
}

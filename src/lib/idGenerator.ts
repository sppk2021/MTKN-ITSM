/**
 * Helper utility to generate sequential 4-digit IDs starting at 0001
 * Example: TK-0001, TK-0002, TK-0003...
 * Example: RP-0001, RP-0002, RP-0003...
 */

export function generateNextTicketCode(existingTickets: Array<{ ticketCode?: string }> = []): string {
  let maxSeq = 0;

  for (const t of existingTickets) {
    if (!t.ticketCode) continue;
    
    // Check for standard TK-XXXX format
    const match = t.ticketCode.match(/^TK-(\d+)/i) || t.ticketCode.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) {
        // If it starts with leading zeroes or is within reasonable range
        if (t.ticketCode.match(/^TK-0/i) || num <= existingTickets.length + 10) {
          if (num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
  }

  const nextNumber = maxSeq > 0 ? maxSeq + 1 : (existingTickets.length > 0 ? existingTickets.length + 1 : 1);
  return `TK-${String(nextNumber).padStart(4, '0')}`;
}

export function generateNextRepairCode(existingRepairs: Array<{ repairCode?: string }> = []): string {
  let maxSeq = 0;

  for (const r of existingRepairs) {
    if (!r.repairCode) continue;

    // Check for standard RP-XXXX format
    const match = r.repairCode.match(/^RP-(\d+)/i) || r.repairCode.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) {
        // If it starts with leading zeroes or is within reasonable range
        if (r.repairCode.match(/^RP-0/i) || num <= existingRepairs.length + 10) {
          if (num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
  }

  const nextNumber = maxSeq > 0 ? maxSeq + 1 : (existingRepairs.length > 0 ? existingRepairs.length + 1 : 1);
  return `RP-${String(nextNumber).padStart(4, '0')}`;
}

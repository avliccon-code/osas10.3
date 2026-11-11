export function hasGuidanceSanction(rec?: { sanction?: string | null } | null): boolean {
  if (!rec || typeof rec.sanction !== 'string') return false;
  const trimmed = rec.sanction.trim();
  if (!trimmed) return false;
  if (trimmed.includes('Pending Sanction')) return false;
  return true;
}

export function getSanctionStatusLabel(status?: string | null): 'Completed' | 'Sanction (Active)' {
  return status === 'COMPLETED' ? 'Completed' : 'Sanction (Active)';
}

export function isSanctionEndDateReached(
  completionDate?: string | null,
  nowMs: number = Date.now()
): boolean {
  if (!completionDate || typeof completionDate !== 'string') return false;
  const trimmed = completionDate.trim();
  if (!trimmed || trimmed.toLowerCase() === 'ongoing') return false;

  // Handle standard YYYY-MM-DD date input in local time
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const endStartOfDayMs = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
    if (isNaN(endStartOfDayMs)) return false;
    return nowMs >= endStartOfDayMs;
  }

  const parsedMs = new Date(trimmed).getTime();
  if (isNaN(parsedMs)) return false;
  return nowMs >= parsedMs;
}

/**
 * Pure subscription helpers — no I/O, no server-only imports, so they are
 * shared by the service, the limit checks, and unit tests.
 */

/** Boundary check. Null limit = unlimited. Blocks AT the cap (used >= limit). */
export function isWithinLimit(used: number, limit: number | null): boolean {
  return limit === null || used < limit;
}

/** now + N calendar months. */
export function resolvePeriodEnd(
  intervalMonths: number,
  from: Date = new Date()
): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + intervalMonths);
  return end;
}

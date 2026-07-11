import { SampleRequestStatus } from '@prisma/client';

/**
 * Pure sample-request status machine — I/O-free so it is unit-testable and
 * shared between the service and the UI (button visibility).
 *
 *   PENDING ──accept──▶ ACCEPTED ──ship──▶ SHIPPED ──close──▶ CLOSED
 *      │                                              ▲
 *      ├──decline──▶ DECLINED          close (from PENDING/ACCEPTED too)
 */
export type SampleAction = 'accept' | 'decline' | 'ship' | 'close';

const SAMPLE_TRANSITIONS: Record<
  SampleAction,
  { from: SampleRequestStatus[]; to: SampleRequestStatus }
> = {
  accept: { from: [SampleRequestStatus.PENDING], to: SampleRequestStatus.ACCEPTED },
  decline: { from: [SampleRequestStatus.PENDING], to: SampleRequestStatus.DECLINED },
  ship: { from: [SampleRequestStatus.ACCEPTED], to: SampleRequestStatus.SHIPPED },
  close: {
    from: [
      SampleRequestStatus.PENDING,
      SampleRequestStatus.ACCEPTED,
      SampleRequestStatus.SHIPPED
    ],
    to: SampleRequestStatus.CLOSED
  }
};

export function checkSampleTransition(
  action: SampleAction,
  from: SampleRequestStatus
): SampleRequestStatus | null {
  const rule = SAMPLE_TRANSITIONS[action];
  return rule.from.includes(from) ? rule.to : null;
}

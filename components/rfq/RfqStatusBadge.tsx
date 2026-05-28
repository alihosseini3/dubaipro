import type { RfqRequestStatus, RfqUrgency } from '@prisma/client';

const STATUS_STYLES: Record<RfqRequestStatus, string> = {
  DRAFT:          'bg-slate-100 text-slate-600',
  PENDING_REVIEW: 'bg-purple-100 text-purple-700',
  OPEN:           'bg-emerald-100 text-emerald-700',
  NEGOTIATING:    'bg-blue-100 text-blue-700',
  QUOTED:         'bg-orange-100 text-orange-700',
  ACCEPTED:       'bg-teal-100 text-teal-700',
  FULFILLED:      'bg-green-100 text-green-700',
  CLOSED:         'bg-slate-200 text-slate-500',
  CANCELLED:      'bg-red-100 text-red-600',
  EXPIRED:        'bg-yellow-100 text-yellow-700',
};

const STATUS_LABELS: Record<RfqRequestStatus, string> = {
  DRAFT:          'Draft',
  PENDING_REVIEW: 'Pending Review',
  OPEN:           'Open',
  NEGOTIATING:    'Negotiating',
  QUOTED:         'Quoted',
  ACCEPTED:       'Accepted',
  FULFILLED:      'Fulfilled',
  CLOSED:         'Closed',
  CANCELLED:      'Cancelled',
  EXPIRED:        'Expired',
};

const URGENCY_STYLES: Record<RfqUrgency, string> = {
  STANDARD: 'bg-slate-100 text-slate-600',
  URGENT: 'bg-amber-100 text-amber-700',
  ASAP: 'bg-red-100 text-red-700',
};

const URGENCY_LABELS: Record<RfqUrgency, string> = {
  STANDARD: 'Standard',
  URGENT: 'Urgent',
  ASAP: 'ASAP',
};

export function RfqStatusBadge({ status }: { status: RfqRequestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RfqUrgencyBadge({ urgency }: { urgency: RfqUrgency }) {
  if (urgency === 'STANDARD') return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${URGENCY_STYLES[urgency]}`}
    >
      {urgency === 'ASAP' && (
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
        </svg>
      )}
      {URGENCY_LABELS[urgency]}
    </span>
  );
}

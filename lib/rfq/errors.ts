/** Typed error codes used across all RFQ domain modules. */
export const RfqError = {
  NOT_FOUND:            'rfq_not_found',
  FORBIDDEN:            'rfq_forbidden',
  CLOSED:               'rfq_closed',
  EXPIRED:              'rfq_expired',
  INVALID_STATUS:       'rfq_invalid_status',
  QUOTE_NOT_FOUND:      'quote_not_found',
  QUOTE_WITHDRAWN:      'quote_withdrawn',
  QUOTE_INVALID_STATUS: 'quote_invalid_status',
  UNAUTHORIZED:         'unauthorized',
  VALIDATION:           'validation_error',
} as const;

export type RfqErrorCode = (typeof RfqError)[keyof typeof RfqError];

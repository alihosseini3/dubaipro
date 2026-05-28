/**
 * Public barrel for the supplier domain.
 *
 * Consumers should `import { ... } from '@/lib/suppliers'` and never reach
 * into individual modules so we can re-organise the internals without
 * breaking call sites.
 */

export * from './types';
export * from './slug';
export * from './service';
export * from './public-service';
export * from './resolve';
export * from './query';
export * from './verification';
export * from './follow';
export * from './reviews';
export * from './certifications';

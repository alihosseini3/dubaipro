import { type ReactNode } from 'react';

import { getActiveVariant, type ActiveVariant } from '@/lib/experiments/server';

import { ExperimentTracker } from './ExperimentTracker';

type ChildrenFn = (variant: ActiveVariant | null) => ReactNode;

type Props = {
  /** Stable developer key registered in the admin (`Experiment.key`). */
  experimentKey: string;
  /** Render-prop receives the resolved variant (or null = default). */
  children: ChildrenFn;
};

/**
 * Server component that resolves the visitor's variant on the server
 * (no flicker) and mounts a tiny client tracker that fires one
 * IMPRESSION per session per experiment.
 *
 * Usage:
 *   <Experiment experimentKey="checkout_cta">
 *     {(v) => (
 *       <button style={{ background: v?.config.color ?? '#0f172a' }}>
 *         {(v?.config.label as string) ?? 'Add to cart'}
 *       </button>
 *     )}
 *   </Experiment>
 */
export async function Experiment({ experimentKey, children }: Props) {
  const variant = await getActiveVariant(experimentKey);

  return (
    <>
      {children(variant)}
      {variant && (
        <ExperimentTracker
          experimentId={variant.experimentId}
          variantId={variant.variantId}
          experimentKey={variant.experimentKey}
        />
      )}
    </>
  );
}

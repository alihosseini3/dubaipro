import { manualCreateIntent, manualProvider } from './manual';
import {
  mellatCreateIntent,
  mellatProvider,
  paypalCreateIntent,
  paypalProvider,
  tapCreateIntent,
  tapProvider,
  zarinpalCreateIntent,
  zarinpalProvider
} from './stubs';
import { stripeCreateIntent, stripeProvider } from './stripe';
import {
  PaymentError,
  type CreateIntentResult,
  type PaymentOrderInput,
  type PaymentProvider,
  type PaymentProviderName
} from './types';

/**
 * Provider registry. To add a new gateway:
 *   1. Implement `PaymentProvider` in `lib/payments/<name>.ts`
 *   2. Register it below
 *   3. Extend `PaymentProviderName` in `./types.ts`
 *
 * The `createIntent` dispatcher also lives here because some providers
 * (Stripe included) need to know our internal `paymentId` as metadata,
 * which is orthogonal to the provider interface.
 */

const providers: Record<PaymentProviderName, PaymentProvider | undefined> = {
  stripe: stripeProvider,
  paypal: paypalProvider,
  crypto: undefined,
  manual: manualProvider,
  mellat: mellatProvider,
  zarinpal: zarinpalProvider,
  tap: tapProvider
};

export function getProvider(name: string): PaymentProvider {
  const provider = providers[name as PaymentProviderName];
  if (!provider) {
    throw new PaymentError(
      'provider_misconfigured',
      400,
      `Provider "${name}" is not enabled`
    );
  }
  return provider;
}

export function listEnabledProviders(): PaymentProviderName[] {
  return (Object.keys(providers) as PaymentProviderName[]).filter(
    (k) => providers[k] !== undefined
  );
}

/**
 * Provider-aware dispatcher for creating an intent. Pass the internal
 * `paymentId` so the webhook can correlate without trusting the client.
 */
export async function dispatchCreateIntent(
  providerName: string,
  order: PaymentOrderInput,
  paymentId: string
): Promise<CreateIntentResult> {
  switch (providerName) {
    case 'stripe':
      return stripeCreateIntent(order, paymentId);
    case 'manual':
      return manualCreateIntent(order, paymentId);
    case 'mellat':
      return mellatCreateIntent(order, paymentId);
    case 'zarinpal':
      return zarinpalCreateIntent(order, paymentId);
    case 'tap':
      return tapCreateIntent(order, paymentId);
    case 'paypal':
      return paypalCreateIntent(order, paymentId);
    default:
      throw new PaymentError(
        'provider_misconfigured',
        400,
        `Provider "${providerName}" has no intent creator`
      );
  }
}

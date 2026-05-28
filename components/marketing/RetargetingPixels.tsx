import Script from 'next/script';

import { canFirePixels, readConsent } from '@/lib/marketing/consent';
import { getMarketingSettings } from '@/lib/marketing/settings';

import { ConsentBanner } from './ConsentBanner';

/**
 * Server component injected once into the public layout. Responsibilities:
 *
 *   1. If tracking is enabled AND (consent given OR consent not required),
 *      load Google gtag.js and Meta fbevents.js with the configured IDs.
 *   2. Always set up the `dataLayer`/`fbq` stubs and a `__mkt_track`
 *      helper, so the client `<TrackEvent>` can push events without
 *      caring whether the real libraries finished loading.
 *   3. Render the consent banner when the visitor hasn't answered yet.
 *
 * Critical: we use `Script` with `strategy="afterInteractive"` so pixels
 * never block first paint. Consent state is read from cookies on the
 * server, so the banner / pixels are correct on the very first SSR — no
 * flicker, no race with hydration.
 */
export async function RetargetingPixels() {
  const settings = await getMarketingSettings();
  const consent = await readConsent();
  const fire = canFirePixels(
    settings.trackingEnabled,
    settings.requireConsent,
    consent
  );
  const showBanner = settings.trackingEnabled && settings.requireConsent && consent === null;

  return (
    <>
      {/* dataLayer is *always* defined so consumer code never has to
          null-check. Buffered events push here pre-consent and get
          flushed once gtag/fbq load. */}
      <Script id="mkt-bootstrap" strategy="beforeInteractive">{`
        window.dataLayer = window.dataLayer || [];
        window.__mkt = window.__mkt || { fired: false, queue: [] };
      `}</Script>

      {fire && settings.googleAdsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${settings.googleAdsId}`}
            strategy="afterInteractive"
          />
          <Script id="mkt-gtag" strategy="afterInteractive">{`
            window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
            gtag('js', new Date());
            gtag('config', '${settings.googleAdsId}', { send_page_view: true });
            window.__mkt.fired = true;
          `}</Script>
        </>
      )}

      {fire && settings.metaPixelId && (
        <Script id="mkt-meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${settings.metaPixelId}');
          fbq('track', 'PageView');
          window.__mkt.fired = true;
        `}</Script>
      )}

      {showBanner && (
        <ConsentBanner
          requireConsent={settings.requireConsent}
          trackingEnabled={settings.trackingEnabled}
        />
      )}
    </>
  );
}

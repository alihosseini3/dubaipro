'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { captureUtmFromLocation } from '@/lib/utm/client';

/**
 * Mounts once at the root public layout. Re-captures UTM params whenever the
 * client navigates so campaigns that arrive via soft navigation still stick.
 */
export function UtmCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    captureUtmFromLocation();
  }, [pathname, searchParams]);

  return null;
}

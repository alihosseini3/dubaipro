'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

/**
 * Smart sticky shell wrapping the storefront header.
 *
 *  - `position: sticky; top: 0` keeps the header pinned.
 *  - On scroll-down past a small threshold, it slides out via
 *    `transform: translateY(-100%)`.
 *  - On scroll-up (or near the top), it slides back in.
 *  - Drawers/menus that use `position: fixed` still work because we
 *    no longer rely on a static `transform: translateZ(0)`; the
 *    transform we apply IS the stacking context.
 *
 * Implementation notes:
 *   - Uses `requestAnimationFrame` to coalesce scroll events so the
 *     state only flips once per frame (60fps max).
 *   - Touch/wheel scrolling are both passive listeners — no jank.
 */
export function StickyShell({ children }: Props) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    function update() {
      const y = window.scrollY;
      const delta = y - lastY.current;
      // Always show near the top — header is part of the hero.
      if (y < 80) {
        setHidden(false);
      } else if (delta > 8) {
        // Scrolling down → hide.
        setHidden(true);
      } else if (delta < -8) {
        // Scrolling up → show.
        setHidden(false);
      }
      lastY.current = y;
      ticking.current = false;
    }

    function onScroll() {
      if (!ticking.current) {
        ticking.current = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      data-hidden={hidden ? 'true' : 'false'}
      className={`sticky top-0 z-40 border-b border-slate-800/40 bg-gradient-to-b from-[#0F172A] to-[#020617] shadow-md transition-transform duration-300 ease-out will-change-transform ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {children}
    </header>
  );
}

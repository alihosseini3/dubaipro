import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from './i18n/routing';
import { AUTH_COOKIE_NAME } from './lib/auth/cookies';
import { verifyJwt } from './lib/auth/jwt';

const intlMiddleware = createMiddleware(routing);

const LOCALE_PATTERN = `(?:${routing.locales.join('|')})`;
const ADMIN_RE = new RegExp(`^/${LOCALE_PATTERN}/admin(?:/|$)`);
const AUTH_PAGE_RE = new RegExp(
  `^/${LOCALE_PATTERN}/(login|register|forgot-password|reset-password)(?:/|$)`
);

function extractLocale(pathname: string): string {
  const first = pathname.split('/')[1] ?? '';
  return (routing.locales as readonly string[]).includes(first)
    ? first
    : routing.defaultLocale;
}

/**
 * Global middleware:
 * 1. Gate /[locale]/admin behind a valid ADMIN session.
 * 2. Redirect logged-in users away from /login and /register.
 * 3. Delegate i18n routing to next-intl for everything else.
 * 4. Expose the current pathname via `x-pathname` so server layouts can
 *    skip the public chrome inside /admin and auth pages.
 */
function safeRedirect(request: NextRequest, targetPath: string, search = '') {
  // Prevent infinite loops: do not redirect to the same path we are on.
  if (request.nextUrl.pathname === targetPath && request.nextUrl.search === search) {
    return null;
  }
  const url = request.nextUrl.clone();
  url.pathname = targetPath;
  url.search = search;
  return NextResponse.redirect(url);
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = extractLocale(pathname);
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyJwt(token) : null;

  // --- Stale/invalid session: clear cookie so we don't loop on it --------
  const hasInvalidToken = !!token && !payload;

  // --- Admin gate ---------------------------------------------------------
  if (ADMIN_RE.test(pathname)) {
    if (!payload) {
      const redirect = safeRedirect(
        request,
        `/${locale}/login`,
        `?from=${encodeURIComponent(pathname)}`
      );
      if (redirect) {
        if (hasInvalidToken) redirect.cookies.delete(AUTH_COOKIE_NAME);
        return redirect;
      }
    } else if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
      const redirect = safeRedirect(request, `/${locale}`);
      if (redirect) return redirect;
    }
  }

  // --- Already-authenticated users shouldn't see login/register ----------
  // EXCEPTION: if ?from= is present, the user explicitly arrived here from
  // a guarded page. Do NOT auto-redirect — the LoginForm will navigate to
  // `from` after a successful submit. This prevents the /admin ↔ /login
  // ping-pong loop.
  if (payload && AUTH_PAGE_RE.test(pathname)) {
    const fromParam = request.nextUrl.searchParams.get('from');
    if (!fromParam) {
      const target =
        payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN'
          ? `/${locale}/admin`
          : `/${locale}`;
      const redirect = safeRedirect(request, target);
      if (redirect) return redirect;
    }
  }

  const response = intlMiddleware(request);
  response.headers.set('x-pathname', pathname);

  // Drop invalid auth cookies so the next request is treated as a guest.
  if (hasInvalidToken) {
    response.cookies.delete(AUTH_COOKIE_NAME);
  }

  // --- A/B test visitor id -----------------------------------------------
  // A stable, opaque id that lets `getActiveVariant()` deterministically
  // hash a visitor into the same arm across requests. We propagate the
  // generated id via `x-ab-vid` so the very first SSR render (where the
  // Set-Cookie hasn't taken effect yet) still sees a value and avoids
  // a flash of un-experimented content.
  let abVid = request.cookies.get('ab_vid')?.value;
  if (!abVid || abVid.length < 16) {
    abVid =
      globalThis.crypto?.randomUUID?.().replace(/-/g, '') ??
      Math.random().toString(36).slice(2) + Date.now().toString(36);
    response.cookies.set('ab_vid', abVid, {
      maxAge: 365 * 24 * 60 * 60,
      sameSite: 'lax',
      path: '/'
    });
  }
  response.headers.set('x-ab-vid', abVid);

  // --- Referral attribution ----------------------------------------------
  // First-touch wins: only set the cookie if it isn't already present, so
  // a later visit via a different affiliate's link can't steal credit.
  // We accept the param shape lazily here — strict validation happens at
  // signup time before we trust the value.
  const refParam = request.nextUrl.searchParams.get('ref');
  if (refParam && !request.cookies.get('ref')?.value) {
    const cleaned = refParam.trim().toUpperCase().slice(0, 16);
    if (/^[A-Z0-9]{4,16}$/.test(cleaned)) {
      response.cookies.set('ref', cleaned, {
        maxAge: 7 * 24 * 60 * 60,
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
      });
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};


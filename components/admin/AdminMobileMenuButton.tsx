'use client';

/**
 * Hamburger button for opening the AdminSidebar drawer on mobile.
 * Communicates with AdminSidebar via a window CustomEvent so we don't need
 * to lift state out of the server-rendered layout.
 */
export function AdminMobileMenuButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('admin:toggle-sidebar'))}
      aria-label="Open menu"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

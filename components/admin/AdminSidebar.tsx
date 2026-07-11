'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';

type NavKey =
  | 'dashboard' | 'analytics'
  | 'products' | 'reviewQueue' | 'categories' | 'suppliers' | 'supplierApplications' | 'orders'
  | 'shipping' | 'payments' | 'coupons' | 'currency' | 'plans' | 'subscriptions'
  | 'users' | 'reviews' | 'messages' | 'chat' | 'customers' | 'affiliate' | 'notifications'
  | 'marketing' | 'automation' | 'experiments'
  | 'homepage' | 'header' | 'gallery' | 'pages' | 'auctions' | 'filters' | 'attributes'
  | 'settings' | 'auditLogs';

type NavItem = { key: NavKey; href: string; icon: ReactElement };
type NavGroup = { labelKey: string; items: NavItem[] };

type AdminSidebarProps = { locale: string };

const ico = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] flex-none" aria-hidden>
    <path d={d} />
  </svg>
);

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'groupCore',
    items: [
      { key: 'dashboard', href: '/admin/dashboard', icon: ico('M3 12l9-9 9 9M5 10v10h14V10') },
      { key: 'analytics',  href: '/admin/analytics',  icon: ico('M3 3v18h18M7 15l4-4 4 4 5-5') },
    ],
  },
  {
    labelKey: 'groupCommerce',
    items: [
      { key: 'products',   href: '/admin/products',   icon: ico('M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7') },
      { key: 'reviewQueue', href: '/admin/products/review-queue', icon: ico('M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z') },
      { key: 'categories', href: '/admin/categories', icon: ico('M4 6h16M4 12h16M4 18h10') },
      { key: 'suppliers',  href: '/admin/suppliers',  icon: ico('M3 21V9l9-6 9 6v12H3zm6 0v-6h6v6') },
      { key: 'supplierApplications', href: '/admin/supplier-applications', icon: ico('M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z') },
      { key: 'orders',     href: '/admin/orders',     icon: ico('M6 2l2 4h8l2-4M4 6h16v14H4zM9 10v6m6-6v6') },
      { key: 'auctions',   href: '/admin/auctions',   icon: ico('m14 5 5 5-7 7-5-5zm-5 8-6 6 2 2 6-6m4-10 3-3 5 5-3 3') },
    ],
  },
  {
    labelKey: 'groupFinance',
    items: [
      { key: 'payments',   href: '/admin/payments',          icon: ico('M3 7h18v10H3zM3 11h18M7 15h2') },
      { key: 'coupons',    href: '/admin/coupons',           icon: ico('M20 12a2 2 0 0 1 0-4V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2z') },
      { key: 'shipping',   href: '/admin/shipping',          icon: ico('M3 7h13v10H3zM16 10h3l2 3v4h-5M7 20a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm10 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z') },
      { key: 'currency',   href: '/admin/settings/currency', icon: ico('M12 8c-2 0-3 1-3 2.5S10 13 12 13s3 1 3 2.5S14 18 12 18M12 6v2m0 10v2') },
      { key: 'plans',      href: '/admin/plans',             icon: ico('M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z') },
      { key: 'subscriptions', href: '/admin/subscriptions',  icon: ico('M4 4h16v4H4zM4 12h16v8H4zM8 16h4') },
    ],
  },
  {
    labelKey: 'groupCustomers',
    items: [
      { key: 'users',      href: '/admin/users',     icon: ico('M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0') },
      { key: 'customers',  href: '/admin/customers', icon: ico('M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0M19 4l2 2-2 2M21 6h-6') },
      { key: 'reviews',    href: '/admin/reviews',   icon: ico('M12 17.3l-6.16 3.7 1.64-7.03L2 9.24l7.19-.62L12 2l2.81 6.62 7.19.62-5.48 4.73 1.64 7.03z') },
      { key: 'messages',   href: '/admin/messages',  icon: ico('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z') },
      { key: 'affiliate',  href: '/admin/affiliate', icon: ico('M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0M19 7l2 2-2 2M21 9h-6') },
    ],
  },
  {
    labelKey: 'groupMarketing',
    items: [
      { key: 'marketing',    href: '/admin/marketing',    icon: ico('M3 11l18-7v16L3 13zM7 13v5l4 1v-5') },
      { key: 'notifications', href: '/admin/notifications', icon: ico('M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0') },
      { key: 'automation',   href: '/admin/automation',   icon: ico('M13 2L3 14h7l-1 8 10-12h-7l1-8z') },
      { key: 'experiments',  href: '/admin/experiments',  icon: ico('M9 3h6v4l4 6a4 4 0 0 1-3.45 6H8.45A4 4 0 0 1 5 13l4-6V3zM10 14h4') },
    ],
  },
  {
    labelKey: 'groupContent',
    items: [
      { key: 'homepage',   href: '/admin/homepage',          icon: ico('M3 12l9-9 9 9M5 10v10h14V10M9 21v-7h6v7') },
      { key: 'header',     href: '/admin/settings/header',   icon: ico('M3 5h18v4H3zM3 11h18v8H3zM7 15h6') },
      { key: 'pages',      href: '/admin/pages',             icon: ico('M6 2h9l5 5v15H6zM15 2v5h5M9 13h6M9 17h6') },
      { key: 'gallery',    href: '/admin/gallery',           icon: ico('M4 16l4-4 4 4 4-8 4 8M3 3h18v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3z') },
      { key: 'filters',    href: '/admin/settings/filters',  icon: ico('M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-.293.707L13 13.414V19a1 1 0 0 1-.553.894l-4 2A1 1 0 0 1 7 21v-7.586L3.293 6.707A1 1 0 0 1 3 6V4z') },
      { key: 'attributes', href: '/admin/attributes',        icon: ico('M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18') },
      { key: 'chat',       href: '/admin/settings/chat',     icon: ico('M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z') },
    ],
  },
  {
    labelKey: 'groupSystem',
    items: [
      { key: 'auditLogs', href: '/admin/audit-logs', icon: ico('M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h6') },
      { key: 'settings', href: '/admin/settings', icon: ico('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z') },
    ],
  },
];

export function AdminSidebar({ locale }: AdminSidebarProps) {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Listen for hamburger button clicks from AdminTopbar
  useEffect(() => {
    const handler = () => setMobileOpen((v) => !v);
    window.addEventListener('admin:toggle-sidebar', handler);
    return () => window.removeEventListener('admin:toggle-sidebar', handler);
  }, []);

  // Auto-close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
    <aside
      className={[
        'flex h-screen flex-col border-r border-white/[0.06] text-slate-200 transition-[width,transform] duration-300 ease-in-out',
        'bg-[#0F172A]',
        // Mobile: fixed drawer that slides in. Desktop: in-flow sidebar.
        'fixed inset-y-0 start-0 z-50 w-[260px] shadow-2xl lg:static lg:z-20 lg:shadow-none',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        collapsed ? 'lg:w-[64px]' : 'lg:w-[240px]',
      ].join(' ')}
      style={{ flexShrink: 0 }}
    >
      {/* Brand header */}
      <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-3">
        {!collapsed && (
          <Link
            href={`/${locale}/admin/dashboard`}
            className="flex items-center gap-2.5 overflow-hidden"
          >
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-orange-500 text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l18-7v16L3 13z" />
              </svg>
            </span>
            <span className="truncate text-[13px] font-bold tracking-tight text-white">
              {t('brand')}
            </span>
          </Link>
        )}
        {collapsed && (
          <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l18-7v16L3 13z" />
            </svg>
          </span>
        )}
        <div className="flex items-center gap-1">
          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* Desktop collapse button */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={[
              'hidden h-6 w-6 flex-none items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:flex',
              collapsed ? 'mx-auto' : '',
            ].join(' ')}
            aria-label="Toggle sidebar"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto py-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey} className="mb-1">
            {!collapsed && (
              <p className="mb-1 mt-3 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500 first:mt-2">
                {t(group.labelKey as Parameters<typeof t>[0])}
              </p>
            )}
            {collapsed && <div className="mb-1 mt-3 h-px w-8 self-center mx-auto bg-white/[0.06] first:mt-2" />}
            <ul className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const href = `/${locale}${item.href}`;
                const active = pathname === href || pathname.startsWith(href + '/') || (item.href !== '/admin/dashboard' && pathname.startsWith(href));
                return (
                  <li key={item.key}>
                    <Link
                      href={href}
                      title={collapsed ? t(item.key) : undefined}
                      className={[
                        'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150',
                        active
                          ? 'bg-orange-500/15 text-orange-400'
                          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                        collapsed ? 'justify-center' : '',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex-none transition-colors',
                          active ? 'text-orange-400' : 'text-slate-500 group-hover:text-slate-300',
                        ].join(' ')}
                      >
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className="truncate">{t(item.key)}</span>
                      )}
                      {active && !collapsed && (
                        <span className="ml-auto h-1.5 w-1.5 flex-none rounded-full bg-orange-400" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <p className="text-[10px] text-slate-600">{t('footer')}</p>
        </div>
      )}
    </aside>
    </>
  );
}

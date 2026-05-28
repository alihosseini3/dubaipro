import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string }> };

export const dynamic = 'force-dynamic';

/**
 * Settings hub. This is the single place an operator visits to discover
 * every configurable subsystem of the marketplace.
 *
 * Each card surfaces:
 *  - the business question it answers ("How are payouts handled?")
 *  - a live status pill (Active / Configured / Action needed)
 *  - a primary CTA into the dedicated management page
 *
 * Rationale for grouping: we cluster by *operator intent* (Storefront,
 * Engagement, Payments, Content, Access) rather than by data model, so
 * a new admin can find the right knob without knowing the schema.
 */
export default async function AdminSettingsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.settingsHub' });

  // Cheap parallel counts. Each is index-backed (or a singleton row
  // lookup), so this whole page renders in a few ms even at scale.
  const [
    currencyRates,
    shippingZones,
    shippingMethods,
    coupons,
    automationRules,
    referrals,
    pendingCommissions,
    whatsapp,
    paymentSettings,
    pendingPayments,
    totalReviews,
    contactInbox,
    adminUsers,
    totalUsers,
    activeExperiments,
    totalExperiments,
    marketingSettings,
    customerKpis
  ] = await Promise.all([
    prisma.currencyRate.count().catch(() => 0),
    prisma.shippingZone.count().catch(() => 0),
    prisma.shippingMethod.count().catch(() => 0),
    prisma.coupon.count({ where: { isActive: true } }).catch(() => 0),
    prisma.automationRule.count().catch(() => 0),
    prisma.referral.count().catch(() => 0),
    prisma.commission
      .count({ where: { status: { in: ['PENDING', 'APPROVED'] } } })
      .catch(() => 0),
    prisma.whatsAppSettings
      .findFirst({ select: { isEnabled: true, phone: true } })
      .catch(() => null),
    prisma.paymentSettings
      .findUnique({ where: { id: 'default' } })
      .catch(() => null),
    prisma.payment
      .count({ where: { status: 'MANUAL_REVIEW' } })
      .catch(() => 0),
    prisma.review.count().catch(() => 0),
    prisma.contactMessage
      .count({ where: { status: 'NEW' } })
      .catch(() => 0),
    prisma.user.count({ where: { role: 'ADMIN' } }).catch(() => 0),
    prisma.user.count().catch(() => 0),
    prisma.experiment.count({ where: { isActive: true } }).catch(() => 0),
    prisma.experiment.count().catch(() => 0),
    prisma.marketingSettings
      .findUnique({
        where: { id: 'default' },
        select: { trackingEnabled: true, googleAdsId: true, metaPixelId: true }
      })
      .catch(() => null),
    prisma.userMetrics
      .aggregate({
        _sum: { totalSpent: true },
        _count: { _all: true }
      })
      .catch(() => null)
  ]);

  const totalRevenue = Number(customerKpis?._sum.totalSpent ?? 0);
  const customerCount = customerKpis?._count._all ?? 0;

  const marketingPixels = marketingSettings
    ? [marketingSettings.googleAdsId, marketingSettings.metaPixelId].filter(Boolean).length
    : 0;

  // Count enabled payment gateways from the singleton.
  const paymentMethods = paymentSettings
    ? [
        paymentSettings.enableMellat,
        paymentSettings.enableZarinpal,
        paymentSettings.enableCardTransfer,
        paymentSettings.enableBankTransfer,
        paymentSettings.enableStripe,
        paymentSettings.enableTap,
        paymentSettings.enablePaypal
      ].filter(Boolean).length
    : 0;

  const sections: Section[] = [
    {
      title: t('groupStorefront'),
      description: t('groupStorefrontDesc'),
      cards: [
        {
          title: t('cards.currency.title'),
          desc: t('cards.currency.desc'),
          href: `/${locale}/admin/settings/currency`,
          status:
            currencyRates > 0
              ? { tone: 'ok', label: t('statusConfigured', { count: currencyRates }) }
              : { tone: 'warn', label: t('statusNotConfigured') }
        },
        {
          title: t('cards.shipping.title'),
          desc: t('cards.shipping.desc'),
          href: `/${locale}/admin/shipping`,
          status:
            shippingMethods > 0
              ? {
                  tone: 'ok',
                  label: t('cards.shipping.status', {
                    methods: shippingMethods,
                    zones: shippingZones
                  })
                }
              : { tone: 'warn', label: t('statusNotConfigured') }
        },
        {
          title: t('cards.coupons.title'),
          desc: t('cards.coupons.desc'),
          href: `/${locale}/admin/coupons`,
          status: {
            tone: coupons > 0 ? 'ok' : 'muted',
            label: t('cards.coupons.status', { count: coupons })
          }
        },
        {
          title: t('cards.filters.title'),
          desc: t('cards.filters.desc'),
          href: `/${locale}/admin/settings/filters`,
          status: { tone: 'ok', label: t('cards.filters.status') }
        }
      ]
    },
    {
      title: t('groupEngagement'),
      description: t('groupEngagementDesc'),
      cards: [
        {
          title: t('cards.whatsapp.title'),
          desc: t('cards.whatsapp.desc'),
          href: `/${locale}/admin/settings/whatsapp`,
          status: whatsapp?.isEnabled
            ? { tone: 'ok', label: t('statusEnabled') }
            : whatsapp?.phone
              ? { tone: 'warn', label: t('statusDisabled') }
              : { tone: 'warn', label: t('statusNotConfigured') }
        },
        {
          title: t('cards.chat.title'),
          desc: t('cards.chat.desc'),
          href: `/${locale}/admin/settings/chat`,
          status: { tone: 'muted', label: t('statusManage') }
        },
        {
          title: t('cards.automation.title'),
          desc: t('cards.automation.desc'),
          href: `/${locale}/admin/automation`,
          status:
            automationRules > 0
              ? {
                  tone: 'ok',
                  label: t('cards.automation.status', { count: automationRules })
                }
              : { tone: 'muted', label: t('statusUsingDefaults') }
        },
        {
          title: t('cards.affiliate.title'),
          desc: t('cards.affiliate.desc'),
          href: `/${locale}/admin/affiliate`,
          status:
            pendingCommissions > 0
              ? {
                  tone: 'warn',
                  label: t('cards.affiliate.statusPending', {
                    count: pendingCommissions
                  })
                }
              : {
                  tone: 'ok',
                  label: t('cards.affiliate.statusActive', { count: referrals })
                }
        },
        {
          title: t('cards.customers.title'),
          desc: t('cards.customers.desc'),
          href: `/${locale}/admin/customers`,
          status:
            customerCount > 0
              ? {
                  tone: 'ok',
                  label: t('cards.customers.status', {
                    count: customerCount,
                    revenue: totalRevenue.toLocaleString(undefined, {
                      maximumFractionDigits: 0
                    })
                  })
                }
              : { tone: 'muted', label: t('cards.customers.statusEmpty') }
        },
        {
          title: t('cards.marketing.title'),
          desc: t('cards.marketing.desc'),
          href: `/${locale}/admin/marketing`,
          status:
            marketingSettings?.trackingEnabled
              ? {
                  tone: 'ok',
                  label: t('cards.marketing.statusActive', { count: marketingPixels })
                }
              : marketingPixels > 0
                ? { tone: 'muted', label: t('cards.marketing.statusConfigured') }
                : { tone: 'muted', label: t('statusNotConfigured') }
        },
        {
          title: t('cards.experiments.title'),
          desc: t('cards.experiments.desc'),
          href: `/${locale}/admin/experiments`,
          status:
            activeExperiments > 0
              ? {
                  tone: 'ok',
                  label: t('cards.experiments.statusActive', {
                    count: activeExperiments
                  })
                }
              : totalExperiments > 0
                ? {
                    tone: 'muted',
                    label: t('cards.experiments.statusPaused', {
                      count: totalExperiments
                    })
                  }
                : { tone: 'muted', label: t('statusNotConfigured') }
        }
      ]
    },
    {
      title: t('groupPayments'),
      description: t('groupPaymentsDesc'),
      cards: [
        {
          title: t('cards.paymentProviders.title'),
          desc: t('cards.paymentProviders.desc'),
          href: `/${locale}/admin/settings/payments`,
          status:
            paymentMethods > 0
              ? {
                  tone: 'ok',
                  label: t('cards.paymentProviders.status', {
                    count: paymentMethods
                  })
                }
              : { tone: 'warn', label: t('statusNotConfigured') }
        },
        {
          title: t('cards.manualPayments.title'),
          desc: t('cards.manualPayments.desc'),
          href: `/${locale}/admin/payments`,
          status:
            pendingPayments > 0
              ? {
                  tone: 'warn',
                  label: t('cards.manualPayments.status', {
                    count: pendingPayments
                  })
                }
              : { tone: 'ok', label: t('statusInbox0') }
        }
      ]
    },
    {
      title: t('groupContent'),
      description: t('groupContentDesc'),
      cards: [
        {
          title: t('cards.reviews.title'),
          desc: t('cards.reviews.desc'),
          href: `/${locale}/admin/reviews`,
          status: {
            tone: 'muted',
            label: t('cards.reviews.status', { count: totalReviews })
          }
        },
        {
          title: t('cards.messages.title'),
          desc: t('cards.messages.desc'),
          href: `/${locale}/admin/messages`,
          status:
            contactInbox > 0
              ? {
                  tone: 'warn',
                  label: t('cards.messages.status', { count: contactInbox })
                }
              : { tone: 'ok', label: t('statusInbox0') }
        }
      ]
    },
    {
      title: t('groupAccess'),
      description: t('groupAccessDesc'),
      cards: [
        {
          title: t('cards.users.title'),
          desc: t('cards.users.desc'),
          href: `/${locale}/admin/users`,
          status: {
            tone: 'ok',
            label: t('cards.users.status', {
              admins: adminUsers,
              total: totalUsers
            })
          }
        }
      ]
    }
  ];

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
          {t('eyebrow')}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-200">{t('subtitle')}</p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {section.title}
            </h2>
            <p className="text-xs text-slate-500">{section.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {section.cards.map((card) => (
              <SettingsCard key={card.title} {...card} cta={t('manage')} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type StatusTone = 'ok' | 'warn' | 'muted';
type Card = {
  title: string;
  desc: string;
  href: string;
  status: { tone: StatusTone; label: string };
};
type Section = { title: string; description: string; cards: Card[] };

function SettingsCard({
  title,
  desc,
  href,
  status,
  cta
}: Card & { cta: string }) {
  const toneCls: Record<StatusTone, string> = {
    ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warn: 'bg-amber-50 text-amber-700 ring-amber-200',
    muted: 'bg-slate-100 text-slate-600 ring-slate-200'
  };
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span
          className={
            'whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ' +
            toneCls[status.tone]
          }
        >
          {status.label}
        </span>
      </div>
      <p className="mt-2 flex-1 text-xs text-slate-500">{desc}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 group-hover:text-slate-900">
        {cta}
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}

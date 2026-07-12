'use client';

import { useTranslations } from 'next-intl';
import type { CompanyType } from '@prisma/client';

import { COMPANY_TYPES } from '@/lib/supplier/registration';

import { ERROR, FIELD, LABEL } from '../fields';

type Props = {
  companyName: string;
  onCompanyName: (v: string) => void;
  tradeName: string;
  onTradeName: (v: string) => void;
  tradeLicenseNumber: string;
  onTradeLicenseNumber: (v: string) => void;
  companyType: CompanyType | '';
  onCompanyType: (v: CompanyType) => void;
  errors: Record<string, string>;
};

export function CompanyStep({
  companyName,
  onCompanyName,
  tradeName,
  onTradeName,
  tradeLicenseNumber,
  onTradeLicenseNumber,
  companyType,
  onCompanyType,
  errors
}: Props) {
  const t = useTranslations('supplierRegister');

  return (
    <div className="grid gap-4">
      <div>
        <label className={LABEL} htmlFor="reg-company">
          {t('companyName')}
        </label>
        <input
          id="reg-company"
          className={`mt-1 ${FIELD}`}
          value={companyName}
          onChange={(e) => onCompanyName(e.target.value)}
        />
        {errors.companyName && <p className={ERROR}>{errors.companyName}</p>}
      </div>

      <div>
        <label className={LABEL} htmlFor="reg-trade-name">
          {t('tradeName')}{' '}
          <span className="text-slate-400">{t('optional')}</span>
        </label>
        <input
          id="reg-trade-name"
          className={`mt-1 ${FIELD}`}
          value={tradeName}
          onChange={(e) => onTradeName(e.target.value)}
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="reg-license">
          {t('tradeLicenseNumber')}
        </label>
        <input
          id="reg-license"
          className={`mt-1 ${FIELD}`}
          value={tradeLicenseNumber}
          onChange={(e) => onTradeLicenseNumber(e.target.value)}
          dir="ltr"
        />
        {errors.tradeLicenseNumber && (
          <p className={ERROR}>{errors.tradeLicenseNumber}</p>
        )}
      </div>

      <div>
        <label className={LABEL}>{t('companyType')}</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {COMPANY_TYPES.map((ct) => (
            <button
              type="button"
              key={ct}
              onClick={() => onCompanyType(ct)}
              className={`rounded-xl border px-4 py-2.5 text-start text-sm font-medium transition ${
                companyType === ct
                  ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-500/20 dark:bg-orange-900/20'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:text-slate-200'
              }`}
            >
              {t(`type${ct}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
        {errors.companyType && <p className={ERROR}>{errors.companyType}</p>}
      </div>
    </div>
  );
}

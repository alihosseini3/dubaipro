'use client';

import { useTranslations } from 'next-intl';

import { UAE_EMIRATES } from '@/lib/supplier/registration';
import { MapLocationPicker } from '@/components/supplier/MapLocationPicker';

import { ERROR, FIELD, LABEL } from '../fields';

type Coords = { lat: number; lng: number } | null;

type Props = {
  country: string;
  onCountry: (v: string) => void;
  emirate: string;
  onEmirate: (v: string) => void;
  city: string;
  onCity: (v: string) => void;
  address: string;
  onAddress: (v: string) => void;
  coords: Coords;
  onCoords: (v: Coords) => void;
  errors: Record<string, string>;
};

export function LocationStep({
  country,
  onCountry,
  emirate,
  onEmirate,
  city,
  onCity,
  address,
  onAddress,
  coords,
  onCoords,
  errors
}: Props) {
  const t = useTranslations('supplierRegister');

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="reg-country">
            {t('country')}
          </label>
          <input
            id="reg-country"
            className={`mt-1 ${FIELD}`}
            value={country}
            onChange={(e) => onCountry(e.target.value)}
          />
          {errors.country && <p className={ERROR}>{errors.country}</p>}
        </div>
        <div>
          <label className={LABEL} htmlFor="reg-emirate">
            {t('emirate')}
          </label>
          <select
            id="reg-emirate"
            className={`mt-1 ${FIELD}`}
            value={emirate}
            onChange={(e) => onEmirate(e.target.value)}
          >
            <option value="">{t('selectEmirate')}</option>
            {UAE_EMIRATES.map((em) => (
              <option key={em} value={em}>
                {em}
              </option>
            ))}
          </select>
          {errors.emirate && <p className={ERROR}>{errors.emirate}</p>}
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="reg-city">
          {t('city')}
        </label>
        <input
          id="reg-city"
          className={`mt-1 ${FIELD}`}
          value={city}
          onChange={(e) => onCity(e.target.value)}
        />
        {errors.city && <p className={ERROR}>{errors.city}</p>}
      </div>

      <div>
        <label className={LABEL} htmlFor="reg-address">
          {t('address')}
        </label>
        <textarea
          id="reg-address"
          rows={2}
          className={`mt-1 ${FIELD}`}
          value={address}
          onChange={(e) => onAddress(e.target.value)}
        />
        {errors.address && <p className={ERROR}>{errors.address}</p>}
      </div>

      <div>
        <label className={LABEL}>{t('pinOnMap')}</label>
        <div className="mt-1.5">
          <MapLocationPicker value={coords} onChange={onCoords} />
        </div>
      </div>
    </div>
  );
}

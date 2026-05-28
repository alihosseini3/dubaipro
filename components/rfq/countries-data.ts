// ISO 3166-1 alpha-2 country codes grouped by continent.
// North Korea (KP) is intentionally excluded per business policy.

export type Continent = 'asia' | 'europe' | 'africa' | 'americas' | 'oceania';

export const COUNTRIES_BY_CONTINENT: Record<Continent, string[]> = {
  asia: [
    'AE', 'SA', 'QA', 'KW', 'OM', 'BH', 'JO', 'LB', 'SY', 'IQ',
    'IR', 'YE', 'IL', 'PS', 'TR', 'CY', 'GE', 'AM', 'AZ', 'KZ',
    'UZ', 'TM', 'KG', 'TJ', 'AF', 'PK', 'IN', 'BD', 'LK', 'NP',
    'BT', 'MV', 'MM', 'TH', 'LA', 'KH', 'VN', 'MY', 'SG', 'ID',
    'PH', 'BN', 'TL', 'CN', 'HK', 'MO', 'TW', 'JP', 'KR', 'MN',
  ],
  europe: [
    'GB', 'IE', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU',
    'CH', 'AT', 'DK', 'SE', 'NO', 'FI', 'IS', 'EE', 'LV', 'LT',
    'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'BA',
    'RS', 'ME', 'MK', 'AL', 'MD', 'UA', 'BY', 'RU', 'MT', 'AD',
    'MC', 'LI', 'SM', 'VA',
  ],
  africa: [
    'EG', 'LY', 'TN', 'DZ', 'MA', 'MR', 'SD', 'SS', 'ER', 'DJ',
    'SO', 'ET', 'KE', 'UG', 'RW', 'BI', 'TZ', 'MZ', 'MW', 'ZM',
    'ZW', 'BW', 'NA', 'ZA', 'LS', 'SZ', 'MG', 'MU', 'SC', 'KM',
    'CV', 'GM', 'SN', 'GN', 'GW', 'SL', 'LR', 'CI', 'GH', 'TG',
    'BJ', 'NG', 'NE', 'ML', 'BF', 'CM', 'CF', 'TD', 'GA', 'CG',
    'CD', 'GQ', 'ST', 'AO',
  ],
  americas: [
    'US', 'CA', 'MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA',
    'CU', 'JM', 'HT', 'DO', 'PR', 'BS', 'BB', 'TT', 'GD', 'LC',
    'VC', 'DM', 'AG', 'KN', 'AR', 'BR', 'CL', 'CO', 'PE', 'VE',
    'UY', 'PY', 'EC', 'BO', 'GY', 'SR',
  ],
  oceania: [
    'AU', 'NZ', 'FJ', 'PG', 'SB', 'VU', 'WS', 'TO', 'KI', 'FM',
    'MH', 'NR', 'PW', 'TV',
  ],
};

export const ALL_COUNTRY_CODES: string[] = Object.values(COUNTRIES_BY_CONTINENT).flat();

/** Convert ISO 3166-1 alpha-2 code to flag emoji. */
export function codeToFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)),
  );
}

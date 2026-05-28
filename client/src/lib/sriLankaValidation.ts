const SRI_LANKA_CANONICAL_COUNTRY = 'sri lanka';

export const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

export const SRI_LANKA_DISTRICTS = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kegalle',
  'Kilinochchi',
  'Kurunegala',
  'Mannar',
  'Matale',
  'Matara',
  'Monaragala',
  'Mullaitivu',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya',
] as const;

const normalizeDistrictKey = (value: string): string => {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
};

const DISTRICT_BY_KEY = new Map(
  SRI_LANKA_DISTRICTS.map((district) => [normalizeDistrictKey(district), district])
);

DISTRICT_BY_KEY.set('kaluthara', 'Kalutara');

export const resolveSriLankanDistrict = (value: string): string | null => {
  const key = normalizeDistrictKey(value);
  if (!key) return null;

  const exact = DISTRICT_BY_KEY.get(key);
  if (exact) return exact;

  const startsWithDistrict = SRI_LANKA_DISTRICTS.find((district) => {
    const districtKey = normalizeDistrictKey(district);
    return key.startsWith(`${districtKey} `) || key === districtKey;
  });

  return startsWithDistrict || null;
};

export const normalizeSriLankanPhone = (value: string): string => {
  const cleaned = value.replace(/[\s()-]/g, '');
  if (cleaned.startsWith('+94')) return `0${cleaned.slice(3)}`;
  if (cleaned.startsWith('94')) return `0${cleaned.slice(2)}`;
  return cleaned;
};

export const isValidSriLankanPhone = (value: string): boolean => {
  const normalizedPhone = normalizeSriLankanPhone(value).replace(/\D/g, '');
  return /^0(?:7\d{8}|[1-9]\d{8})$/.test(normalizedPhone);
};

export const normalizeSriLankanPostalCode = (value: string): string => value.trim();

export const isValidSriLankanPostalCode = (value: string): boolean => /^\d{5}$/.test(normalizeSriLankanPostalCode(value));

export const isSriLankanCountry = (value: string): boolean => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized === SRI_LANKA_CANONICAL_COUNTRY || normalized === 'lk' || normalized === 'lka';
};

export const isValidSriLankanPersonName = (value: string): boolean => {
  const normalized = normalizeWhitespace(value);
  return normalized.length >= 2
    && normalized.length <= 80
    && /^[\p{L} .'-]+$/u.test(normalized);
};

export const isValidSriLankanCity = (value: string): boolean => {
  const normalized = normalizeWhitespace(value);
  return normalized.length >= 2
    && normalized.length <= 60
    && /^(?=.*[\p{L}])[\p{L}0-9 .'-]+$/u.test(normalized);
};

export const isValidSriLankanDistrict = (value: string): boolean => {
  return resolveSriLankanDistrict(value) !== null;
};

export const hasControlCharacters = (value: string): boolean => {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return (code >= 0 && code <= 31) || code === 127;
  });
};

export const isValidSriLankanAddress = (value: string): boolean => {
  const normalized = normalizeWhitespace(value);
  return normalized.length >= 8 && normalized.length <= 160 && !hasControlCharacters(normalized);
};

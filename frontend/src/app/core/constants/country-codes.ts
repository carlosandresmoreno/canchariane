export interface CountryDialCode {
  code: string;
  name: string;
  dial_code: string;
  flag: string;
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { code: 'CO', name: 'Colombia', dial_code: '+57', flag: '🇨🇴' },
  { code: 'US', name: 'Estados Unidos / Canadá', dial_code: '+1', flag: '🇺🇸' },
  { code: 'ES', name: 'España', dial_code: '+34', flag: '🇪🇸' },
  { code: 'MX', name: 'México', dial_code: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', dial_code: '+54', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', dial_code: '+56', flag: '🇨🇱' },
  { code: 'PE', name: 'Perú', dial_code: '+51', flag: '🇵🇪' },
  { code: 'EC', name: 'Ecuador', dial_code: '+593', flag: '🇪🇨' },
  { code: 'VE', name: 'Venezuela', dial_code: '+58', flag: '🇻🇪' },
  { code: 'PA', name: 'Panamá', dial_code: '+507', flag: '🇵🇦' },
  { code: 'CR', name: 'Costa Rica', dial_code: '+506', flag: '🇨🇷' },
  { code: 'UY', name: 'Uruguay', dial_code: '+598', flag: '🇺🇾' },
  { code: 'PY', name: 'Paraguay', dial_code: '+595', flag: '🇵🇾' },
  { code: 'BO', name: 'Bolivia', dial_code: '+591', flag: '🇧🇴' },
  { code: 'BR', name: 'Brasil', dial_code: '+55', flag: '🇧🇷' },
];

export const DEFAULT_DIAL_CODE = '+57';

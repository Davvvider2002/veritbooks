// Mobile phone numbers, kept in international form (+234 803 123 4567 is stored +2348031234567)
// so they work for calls, SMS and WhatsApp from any country.

export const MOBILE_HINT = 'With the country code, for example +234 803 123 4567, +233 24 123 4567 or +27 82 123 4567.';

/** The number in international form, or an error message saying what to fix. */
export function normaliseMobile(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  let s = raw.trim().replace(/[\s\-.() ]/g, '');
  if (!s) return { ok: false, message: 'Enter your mobile phone number.' };
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+')) {
    return {
      ok: false,
      message: /^0\d/.test(s)
        ? 'Add the country code in place of the first 0: +234 for Nigeria, +233 Ghana, +232 Sierra Leone, +231 Liberia, +220 The Gambia, +27 South Africa.'
        : 'Start the number with + and the country code, for example +234.',
    };
  }
  const digits = s.slice(1);
  if (!/^\d+$/.test(digits)) return { ok: false, message: 'A phone number holds only digits after the +.' };
  if (digits.startsWith('0')) return { ok: false, message: 'A country code never starts with 0. Check the number.' };
  if (digits.length < 8 || digits.length > 15) return { ok: false, message: 'That number is too short or too long. Check it.' };
  return { ok: true, value: '+' + digits };
}

/** The number as people read it: +234 803 123 4567. */
export function showMobile(v: string | null | undefined): string {
  if (!v) return '';
  if (!/^\+\d{8,15}$/.test(v)) return v;
  // Country codes in our markets: three digits (234, 233, 232, 231, 220) or two (27).
  const cc = /^(27|44|1)/.test(v.slice(1)) ? v.slice(1).match(/^(27|44|1)/)![1] : v.slice(1, 4);
  const rest = v.slice(1 + cc.length);
  const groups = rest.length > 7 ? [rest.slice(0, rest.length - 7), rest.slice(-7, -4), rest.slice(-4)] : [rest.slice(0, -4), rest.slice(-4)];
  return `+${cc} ${groups.filter(Boolean).join(' ')}`;
}

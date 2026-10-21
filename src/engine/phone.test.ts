import { describe, expect, it } from 'vitest';
import { normaliseMobile, showMobile } from './phone';

describe('mobile numbers', () => {
  it('keeps them in international form', () => {
    expect(normaliseMobile('+234 803 123 4567')).toEqual({ ok: true, value: '+2348031234567' });
    expect(normaliseMobile('00 27 (82) 123-4567')).toEqual({ ok: true, value: '+27821234567' });
  });
  it('asks for the country code when a local number is typed', () => {
    const r = normaliseMobile('0803 123 4567');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/\+234 for Nigeria/);
  });
  it('refuses blanks, letters and wrong lengths', () => {
    expect(normaliseMobile('').ok).toBe(false);
    expect(normaliseMobile('+234 80A').ok).toBe(false);
    expect(normaliseMobile('+12345').ok).toBe(false);
  });
  it('shows them grouped', () => {
    expect(showMobile('+2348031234567')).toBe('+234 803 123 4567');
    expect(showMobile('+27821234567')).toBe('+27 82 123 4567');
  });
});

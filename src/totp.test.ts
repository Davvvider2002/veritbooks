import { describe, expect, it } from 'vitest';
import { checkCode, codeAt } from './totp';

describe('one-time codes', () => {
  // RFC 6238 test secret "12345678901234567890" in base32, SHA-1, 6 digits.
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  it('matches the published test values', async () => {
    expect(await codeAt(secret, 59_000)).toBe('287082');
    expect(await codeAt(secret, 1111111109_000)).toBe('081804');
    expect(await codeAt(secret, 2000000000_000)).toBe('279037');
  });
  it('allows one step either side and no more', async () => {
    const t = 1111111109_000;
    expect(await checkCode(secret, '081804', t + 30_000)).toBe(true);
    expect(await checkCode(secret, '081804', t + 90_000)).toBe(false);
  });
});

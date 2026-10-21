import { describe, expect, it } from 'vitest';
import { isBreached, listedIn } from './breached';

// SHA-1 of "password" is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8.
const SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

describe('breached password check', () => {
  it('reads the range response', () => {
    expect(listedIn(`0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${SUFFIX}:9659365`, SUFFIX)).toBe(true);
    expect(listedIn(`${SUFFIX}:0`, SUFFIX)).toBe(false); // padding rows carry a count of 0
    expect(listedIn('ABC:3', SUFFIX)).toBe(false);
  });

  it('sends only the first five characters of the hash', async () => {
    let asked = '';
    const fake = (async (url: string) => {
      asked = url;
      return new Response(`${SUFFIX}:12`);
    }) as unknown as typeof fetch;
    expect(await isBreached('password', fake)).toBe(true);
    expect(asked).toBe('https://api.pwnedpasswords.com/range/5BAA6');
  });

  it('lets the person through when the service cannot be reached', async () => {
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await isBreached('password', down)).toBe(false);
  });
});

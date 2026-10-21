// Refuse passwords already published in data breaches, using the Have I Been Pwned range API.
// Only the first five characters of the password's SHA-1 hash leave the browser; the password
// itself, and its full hash, never do (k-anonymity). If the service cannot be reached the check
// is skipped rather than blocking sign-up.

export const BREACHED_MESSAGE =
  'That password has appeared in a known data breach, so it is easy for others to guess. Choose a different one.';

async function sha1Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Whether the range response lists this hash suffix with a count above zero. */
export function listedIn(rangeBody: string, suffix: string): boolean {
  for (const line of rangeBody.split(/\r?\n/)) {
    const [s, n] = line.trim().split(':');
    if (s && s.toUpperCase() === suffix && Number(n) > 0) return true;
  }
  return false;
}

/** True when the password is in a known breach; false when it is not, or the check could not run. */
export async function isBreached(password: string, fetcher: typeof fetch = fetch, timeoutMs = 4000): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetcher(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' }, signal: ctrl.signal });
      if (!res.ok) return false;
      return listedIn(await res.text(), hash.slice(5));
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

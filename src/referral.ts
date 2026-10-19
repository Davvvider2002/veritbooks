import { repo } from './data';
import { campaignTag, normaliseCode, validCode } from './engine/partners';

/**
 * A partner's link (veritbooks.com/?ref=CODE&c=campaign) is remembered in this browser, so a
 * visitor who signs up days later is still credited to the partner. The visit is counted once
 * per browser session. Storage that is unavailable simply means no credit is remembered.
 */
const KEY = 'veritbooks.ref';
const DAYS = 90;

export interface StoredReferral {
  code: string;
  campaign: string;
  at: string;
}

export function captureReferral(search = window.location.search, path = window.location.pathname): StoredReferral | null {
  const q = new URLSearchParams(search);
  const raw = q.get('ref');
  if (!raw || !validCode(raw)) return storedReferral();
  const ref: StoredReferral = { code: normaliseCode(raw), campaign: campaignTag(q.get('c') ?? ''), at: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(ref));
    const seen = `veritbooks.ref.counted.${ref.code}.${ref.campaign}`;
    if (!sessionStorage.getItem(seen)) {
      sessionStorage.setItem(seen, '1');
      void repo.partnerClick(ref.code, ref.campaign, path, (q.get('country') ?? '').slice(0, 2)).catch(() => undefined);
    }
  } catch {
    // Storage unavailable: the code can still be typed at sign-up.
  }
  return ref;
}

/** The partner link this browser came through, within the programme's window (90 days unless set otherwise). */
export function storedReferral(maxDays = DAYS): StoredReferral | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as StoredReferral | null;
    if (!r || !validCode(r.code) || Date.now() - Date.parse(r.at) > maxDays * 86_400_000) return null;
    return r;
  } catch {
    return null;
  }
}

export function forgetReferral(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}

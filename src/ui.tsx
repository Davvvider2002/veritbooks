import { useRef, useCallback, useEffect, useState, type ReactNode } from 'react';
import { fmt, cur } from './engine/money';
import type { Period, Row, Source } from './engine/statements';

/** A figure the reader has asked to open: what it is, which column it sits in, and where it comes from. */
export interface Opened {
  label: string;
  period: Period;
  source: Source;
}
export type OnTrace = (o: Opened) => void;
export const canOpen = (s: Source) => !!s.code || (s.parts?.length ?? 0) > 0;

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="small muted" style={{ fontWeight: 400, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="banner bad" role="alert">
      {error}
    </div>
  );
}

export const message = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  // A dropped connection reaches here as a bare browser error.
  if (/^(TypeError: )?(failed to fetch|networkerror when attempting to fetch resource\.?|load failed|network request failed)$/i.test(m))
    return 'VeritBooks could not be reached. Check the internet connection and try again. This last action was not saved.';
  return m;
};

/**
 * Typing on a step marks the step as having unsaved changes until an action succeeds. Leaving the
 * step, or closing the tab, then asks first, so a long note is not lost to a stray click.
 */
export const unsaved = { dirty: false };
const LEAVE = 'You have typed on this step and not saved it. Leave without saving?';
const TYPED = new Set(['text', 'number', 'date', 'email', 'tel', 'url', '']);
export const confirmLeave = () => {
  if (!unsaved.dirty) return true;
  if (!window.confirm(LEAVE)) return false;
  unsaved.dirty = false;
  return true;
};
export function useUnsavedGuard(step: string | undefined) {
  useEffect(() => {
    unsaved.dirty = false;
  }, [step]);
  useEffect(() => {
    const onInput = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t || !t.closest('main') || t.closest('[data-no-dirty]')) return;
      if (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && TYPED.has((t as HTMLInputElement).type) && !(t as HTMLInputElement).readOnly)) unsaved.dirty = true;
    };
    const onClick = (e: MouseEvent) => {
      if (!unsaved.dirty) return;
      const a = (e.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!a || a.hasAttribute('download') || a.target === '_blank' || a.href.startsWith('blob:') || a.href.startsWith('data:')) return;
      if (new URL(a.href, location.href).pathname === location.pathname) return;
      if (!confirmLeave()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!unsaved.dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('input', onInput, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);
}

/** Runs an async action, tracking busy and error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A second click, or Enter pressed while the first save is still going, is ignored, so one
  // action cannot be saved twice before the screen has caught up.
  const running = useRef(false);
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
      unsaved.dirty = false;
    } catch (e) {
      setError(message(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, error, run, setError };
}

/** Loads data on mount and whenever deps change. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    fn().then(
      (d) => live && setData(d),
      (e) => live && setError(message(e)),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}

export function StatementTable({
  rows,
  curLabel,
  priorLabel,
  notes = false,
  onTrace,
}: {
  rows: Row[];
  curLabel: string;
  priorLabel?: string | null;
  notes?: boolean;
  /** When given, figures that come straight from accounts can be opened to show their source. */
  onTrace?: OnTrace;
}) {
  const cell = (r: Row, period: Period) => {
    const v = period === 'current' ? r.cur : r.prior;
    if (r.style === 'heading') return '';
    if (!onTrace || !canOpen(r) || v === null || r.style === 'check') return fmt(v);
    return (
      <button className="trace" title="Show where this figure comes from" aria-label={`${r.label}, ${period} year: ${fmt(v)}. Show source`} onClick={() => onTrace({ label: r.label || 'Total', period, source: r })}>
        {fmt(v)}
      </button>
    );
  };
  return (
    <table className="fs">
      <thead>
        <tr>
          <th></th>
          {notes && <th style={{ textAlign: 'center' }}>Note</th>}
          <th className="num">{curLabel}<br />{cur()}</th>
          {priorLabel && <th className="num">{priorLabel}<br />{cur()}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={r.style}>
            <td>{r.label}</td>
            {notes && <td className="note">{r.note ?? ''}</td>}
            <td className="num">{cell(r, 'current')}</td>
            {priorLabel && <td className="num">{cell(r, 'prior')}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

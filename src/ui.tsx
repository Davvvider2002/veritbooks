import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { fmt } from './engine/money';
import type { Row } from './engine/statements';

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

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Runs an async action, tracking busy and error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
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
}: {
  rows: Row[];
  curLabel: string;
  priorLabel?: string | null;
  notes?: boolean;
}) {
  return (
    <table className="fs">
      <thead>
        <tr>
          <th></th>
          {notes && <th style={{ textAlign: 'center' }}>Note</th>}
          <th className="num">{curLabel}<br />₦</th>
          {priorLabel && <th className="num">{priorLabel}<br />₦</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={r.style}>
            <td>{r.label}</td>
            {notes && <td className="note">{r.note ?? ''}</td>}
            <td className="num">{r.style === 'heading' ? '' : fmt(r.cur)}</td>
            {priorLabel && <td className="num">{r.style === 'heading' ? '' : fmt(r.prior)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

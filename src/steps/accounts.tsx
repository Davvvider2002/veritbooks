import { useState } from 'react';
import { repo } from '../data';
import { CHART, NATURE_CODES, SECTION_LABEL, type Section } from '../engine/chart';
import type { Nature, TbLine } from '../engine/types';
import { keepLine } from '../engine/yearsOf';
import { ErrorNote, Field, useAction } from '../ui';

export interface NewAccount {
  code: string;
  name: string;
  mapCode: string | null;
  nature: Nature | null;
}

/**
 * Adds accounts to an engagement's trial balance with a nil balance, mapped to their line in the
 * statements. Accounts keep their ids, so journals already posted stay attached. Returns the
 * trial balance as it now stands.
 */
export async function addAccounts(engagementId: string, lines: TbLine[], accounts: NewAccount[]): Promise<TbLine[]> {
  const have = new Set(lines.map((l) => l.code.trim().toLowerCase()));
  for (const a of accounts) {
    const code = a.code.trim();
    if (!code) throw new Error('Give every new account a code.');
    if (have.has(code.toLowerCase())) throw new Error(`Account ${code} is already in the trial balance.`);
    if (!a.name.trim()) throw new Error(`Give account ${code} a name.`);
    have.add(code.toLowerCase());
  }
  const withPrior = lines.some((l) => l.prior !== null);
  await repo.replaceLines(engagementId, [
    ...lines.map(keepLine),
    ...accounts.map((a) => ({
      code: a.code.trim(),
      name: a.name.trim(),
      balance: 0,
      prior: withPrior ? 0 : null,
      prior2: null,
      mapCode: a.mapCode || null,
      nature: a.mapCode && NATURE_CODES.has(a.mapCode) ? (a.nature ?? 'other') : null,
    })),
  ]);
  return repo.listLines(engagementId);
}

const SECTIONS = Object.keys(SECTION_LABEL) as Section[];

/** The statement line picker, with the nature for expense lines. */
export function LinePicker({ label, mapCode, nature, onChange }: { label: string; mapCode: string; nature: Nature | ''; onChange: (mapCode: string, nature: Nature | '') => void }) {
  return (
    <>
      <select aria-label={`Statement line for ${label}`} value={mapCode} onChange={(e) => onChange(e.target.value, NATURE_CODES.has(e.target.value) ? nature || 'other' : '')}>
        <option value="">Not mapped yet</option>
        {SECTIONS.map((sec) => (
          <optgroup key={sec} label={SECTION_LABEL[sec]}>
            {CHART.filter((c) => c.section === sec).map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {NATURE_CODES.has(mapCode) && (
        <select aria-label={`Nature of ${label}`} value={nature || 'other'} onChange={(e) => onChange(mapCode, e.target.value as Nature)} style={{ marginTop: 4 }}>
          <option value="other">Bought-in</option>
          <option value="staff">Staff cost</option>
          <option value="depreciation">Depreciation</option>
        </select>
      )}
    </>
  );
}

/**
 * A GL account the client's trial balance does not have, created during the audit: a code, a name
 * and its line in the statements. It starts at nil; journals give it its value.
 */
export function AddAccount({ engagementId, lines, onAdded, compact }: { engagementId: string; lines: TbLine[]; onAdded: (fresh: TbLine[], code: string) => void; compact?: boolean }) {
  const blank = { code: '', name: '', mapCode: '', nature: '' as Nature | '' };
  const [f, setF] = useState(blank);
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  return (
    <form
      className="stack"
      aria-label="Add a GL account"
      onSubmit={(e) => {
        e.preventDefault();
        setDone(null);
        void run(async () => {
          const fresh = await addAccounts(engagementId, lines, [{ code: f.code, name: f.name, mapCode: f.mapCode || null, nature: f.nature || null }]);
          setDone(`Account ${f.code.trim()} ${f.name.trim()} added with a nil balance.`);
          onAdded(fresh, f.code.trim());
          setF(blank);
        });
      }}
    >
      {!compact && (
        <p className="small muted" style={{ margin: 0 }}>
          For an account the client’s trial balance does not have, such as a provision or a reclassification found during the audit. It starts at nil, and journals give it its value.
        </p>
      )}
      <div className="grid3" style={{ alignItems: 'start' }}>
        <Field label="Account code">
          <input type="text" required maxLength={30} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        </Field>
        <Field label="Account name">
          <input type="text" required maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <label className="field">
          <span>Line in the statements</span>
          <LinePicker label="the new account" mapCode={f.mapCode} nature={f.nature} onChange={(mapCode, nature) => setF({ ...f, mapCode, nature })} />
        </label>
      </div>
      <ErrorNote error={error} />
      {done && <div className="banner info">{done}</div>}
      <div>
        <button disabled={busy}>Add account</button>
      </div>
    </form>
  );
}

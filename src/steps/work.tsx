import { useState } from 'react';
import { PACKS, PACK_VERSION, packOf, programmeFor } from '../content/packs';
import { repo } from '../data';
import { BENCHMARKS, benchmarkBase, computeMateriality, unadjustedEffect } from '../engine/checks';
import { fmt, fmt2, parseAmount } from '../engine/money';
import type { JournalLine, Planning } from '../engine/types';
import { ErrorNote, Field, useAction } from '../ui';
import type { Ctx } from '../workspace';
import { FileCount } from './evidence';

export function PlanningStep({ eng, statements, locked, reload }: Ctx) {
  const [p, setP] = useState<Planning>({
    performancePercent: 75,
    trivialPercent: 5,
    ...eng.planning,
  });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const m = computeMateriality(statements.cur, p);
  const set = (patch: Partial<Planning>) => {
    setSaved(false);
    setP({ ...p, ...patch });
  };
  const pct = (v: string) => (v === '' ? undefined : Number(v));

  return (
    <div className="stack">
      <div>
        <h2>Planning: materiality</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Choose the benchmark and the percentages. The ranges shown are common practice, not rules. The judgment and its rationale are yours.
        </p>
      </div>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await repo.updateEngagement(eng.id, { planning: p });
            setSaved(true);
            reload();
          });
        }}
      >
        <div className="grid2">
          <Field label="Benchmark">
            <select
              disabled={locked}
              value={p.benchmark ?? ''}
              onChange={(e) => {
                const b = (e.target.value || undefined) as Planning['benchmark'];
                set({ benchmark: b, percent: b ? (p.percent ?? BENCHMARKS[b].suggested) : p.percent });
              }}
            >
              <option value="">Select a benchmark</option>
              {Object.entries(BENCHMARKS).map(([k, b]) => (
                <option key={k} value={k}>
                  {b.label}: ₦{fmt(benchmarkBase(statements.cur, k as keyof typeof BENCHMARKS), { zero: '0' })} (commonly {b.range})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Percentage of benchmark">
            <input type="number" min="0.1" max="25" step="0.1" disabled={locked} value={p.percent ?? ''} onChange={(e) => set({ percent: pct(e.target.value) })} />
          </Field>
          <Field label="Performance materiality, % of overall">
            <input type="number" min="1" max="100" step="1" disabled={locked} value={p.performancePercent ?? ''} onChange={(e) => set({ performancePercent: pct(e.target.value) })} />
          </Field>
          <Field label="Clearly trivial threshold, % of overall">
            <input type="number" min="0" max="100" step="1" disabled={locked} value={p.trivialPercent ?? ''} onChange={(e) => set({ trivialPercent: pct(e.target.value) })} />
          </Field>
        </div>
        <Field label="Rationale for the benchmark and percentage">
          <textarea disabled={locked} value={p.rationale ?? ''} onChange={(e) => set({ rationale: e.target.value })} />
        </Field>
        {m && (
          <table className="data">
            <tbody>
              <tr><td>Benchmark amount</td><td className="num">₦{fmt(m.base, { zero: '0' })}</td></tr>
              <tr><td><strong>Overall materiality</strong></td><td className="num"><strong>₦{fmt(m.overall, { zero: '0' })}</strong></td></tr>
              <tr><td>Performance materiality</td><td className="num">₦{fmt(m.performance, { zero: '0' })}</td></tr>
              <tr><td>Clearly trivial threshold</td><td className="num">₦{fmt(m.trivial, { zero: '0' })}</td></tr>
            </tbody>
          </table>
        )}
        <ErrorNote error={error} />
        {saved && <div className="banner info">Saved.</div>}
        {!locked && (
          <div>
            <button className="primary" disabled={busy}>Save planning</button>
          </div>
        )}
      </form>
    </div>
  );
}

export function ProgrammeStep({ eng, ws, locked, reload, evidence }: Ctx) {
  const items = programmeFor(eng.type, eng.planning);
  const pack = packOf(eng.planning);
  const { error, run } = useAction();
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, eng.programme[i.id]?.note ?? ''])),
  );
  const areas = [...new Set(items.map((i) => i.area))];

  const save = (id: string, done: boolean) =>
    run(async () => {
      const programme = {
        ...eng.programme,
        [id]: {
          done,
          note: notes[id] || undefined,
          by: done ? ws.me.fullName || ws.me.userId : undefined,
          at: done ? new Date().toISOString() : undefined,
        },
      };
      await repo.updateEngagement(eng.id, { programme });
      reload();
    });

  return (
    <div className="stack">
      <div>
        <h2>Work programme</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Tick each step when the work is done and referenced. Every step must be complete before sign-off.
        </p>
      </div>
      <div className="banner warn">
        Starter content, version {eng.programmeVersion || 'unversioned'}. These steps show how the programme works. They are not a reviewed methodology and must be replaced by one written against the standards adopted by the FRC of Nigeria before live use.
      </div>
      <div className="card stack">
        <h3>Industry pack</h3>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ width: 300 }}>
            <span>This client’s business</span>
            <select
              disabled={locked}
              value={pack?.id ?? ''}
              onChange={(e) =>
                void run(async () => {
                  await repo.updateEngagement(eng.id, { planning: { ...eng.planning, industry: e.target.value || undefined } });
                  reload();
                })
              }
            >
              <option value="">General: no pack</option>
              {PACKS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          {pack && (
            <span className="small muted" style={{ paddingBottom: 8 }}>
              Adds {pack.programme[eng.type]?.length ?? 0} step(s) here, {pack.checklist.length} disclosure checklist item(s) and {pack.requests.length} client request(s).
            </span>
          )}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {pack ? `${pack.summary} ` : 'A pack adds steps, disclosure checks and client requests for one kind of business. It never removes any. '}
          {pack && `Pack content is starter material, version ${PACK_VERSION}, and needs the same review as the rest. `}
          Changing the pack keeps every answer already recorded.
        </p>
      </div>
      <ErrorNote error={error} />
      {areas.map((area) => (
        <div className="card" key={area}>
          <h3>{area}</h3>
          {items
            .filter((i) => i.area === area)
            .map((i) => {
              const st = eng.programme[i.id];
              return (
                <div className="programme-item" key={i.id}>
                  <input
                    type="checkbox"
                    id={i.id}
                    disabled={locked}
                    checked={!!st?.done}
                    onChange={(e) => void save(i.id, e.target.checked)}
                  />
                  <div>
                    <label htmlFor={i.id}>{i.text}</label> <FileCount evidence={evidence} type="programme" id={i.id} />
                    {st?.done && st.by && (
                      <div className="small muted">
                        Done by {st.by}, {new Date(st.at ?? '').toLocaleDateString('en-GB')}
                      </div>
                    )}
                    <input
                      type="text"
                      aria-label={`Working paper reference or note for: ${i.text}`}
                      placeholder="Working paper reference or note"
                      disabled={locked}
                      value={notes[i.id] ?? ''}
                      onChange={(e) => setNotes({ ...notes, [i.id]: e.target.value })}
                      onBlur={() => {
                        if ((st?.note ?? '') !== (notes[i.id] ?? '')) void save(i.id, !!st?.done);
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

interface DraftLine {
  lineId: string;
  debit: string;
  credit: string;
}
const blank = (): DraftLine => ({ lineId: '', debit: '', credit: '' });

export function JournalsStep({ eng, lines, adjustments, statements, locked, reload }: Ctx) {
  const [ref, setRef] = useState('');
  const [description, setDescription] = useState('');
  const [posted, setPosted] = useState(true);
  const [draft, setDraft] = useState<DraftLine[]>([blank(), blank()]);
  const { busy, error, run, setError } = useAction();
  const name = (id: string) => {
    const l = lines.find((x) => x.id === id);
    return l ? `${l.code} ${l.name}` : 'Unknown account';
  };
  const m = eng.type === 'audit' ? computeMateriality(statements.cur, eng.planning) : null;
  const unadjusted = unadjustedEffect(lines, adjustments);

  const add = () => {
    const out: JournalLine[] = [];
    for (const d of draft) {
      if (!d.lineId && !d.debit && !d.credit) continue;
      const dr = parseAmount(d.debit) ?? 0;
      const cr = parseAmount(d.credit) ?? 0;
      if (!d.lineId) return setError('Choose an account on every line.');
      if (dr < 0 || cr < 0) return setError('Enter amounts as positive numbers.');
      if ((dr === 0) === (cr === 0)) return setError('Each line needs either a debit or a credit.');
      out.push({ lineId: d.lineId, amount: dr - cr });
    }
    if (out.length < 2) return setError('A journal needs at least two lines.');
    const sum = out.reduce((a, j) => a + j.amount, 0);
    if (sum !== 0) return setError(`The journal does not balance. Difference ${fmt2(Math.abs(sum))}.`);
    if (!ref.trim()) return setError('Give the journal a reference.');
    void run(async () => {
      await repo.addAdjustment(eng.id, { ref: ref.trim(), description: description.trim(), posted, lines: out });
      setRef('');
      setDescription('');
      setDraft([blank(), blank()]);
      reload();
    });
  };
  const edit = (i: number, patch: Partial<DraftLine>) => setDraft(draft.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <div className="stack">
      <div>
        <h2>Journals</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Posted journals change the financial statements. Proposed journals the client has not booked stay out of the statements and are totalled as unadjusted differences.
        </p>
      </div>

      {adjustments.length > 0 && (
        <div className="card">
          {adjustments.map((a) => (
            <div key={a.id} style={{ marginBottom: 14 }}>
              <div className="between">
                <div>
                  <strong>{a.ref}</strong> {a.description}{' '}
                  <span className={`tag ${a.posted ? 'ok' : 'warn'}`}>{a.posted ? 'Posted' : 'Unadjusted'}</span>
                </div>
                {!locked && (
                  <button
                    className="link danger"
                    onClick={() =>
                      void run(async () => {
                        await repo.deleteAdjustment(a.id);
                        reload();
                      })
                    }
                  >
                    Delete
                  </button>
                )}
              </div>
              <table className="data">
                <tbody>
                  {a.lines.map((j, i) => (
                    <tr key={i}>
                      <td>{name(j.lineId)}</td>
                      <td className="num">{j.amount > 0 ? fmt2(j.amount) : ''}</td>
                      <td className="num">{j.amount < 0 ? fmt2(-j.amount) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div className={`banner ${m && Math.abs(unadjusted) >= m.overall ? 'bad' : 'info'}`}>
            Net effect of unadjusted differences on profit before tax: ₦{fmt(unadjusted, { zero: '0' })}.
            {m ? ` Overall materiality is ₦${fmt(m.overall, { zero: '0' })}.` : eng.type === 'audit' ? ' Materiality has not been set.' : ''}
          </div>
        </div>
      )}

      {!locked && lines.length > 0 && (
        <div className="card stack">
          <h3>New journal</h3>
          <div className="grid3">
            <Field label="Reference">
              <input type="text" value={ref} placeholder="AJ1" onChange={(e) => setRef(e.target.value)} />
            </Field>
            <Field label="Description">
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Treatment">
              <select value={posted ? 'posted' : 'proposed'} onChange={(e) => setPosted(e.target.value === 'posted')}>
                <option value="posted">Posted by the client</option>
                <option value="proposed">Proposed, not booked</option>
              </select>
            </Field>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Account</th>
                <th className="num">Debit ₦</th>
                <th className="num">Credit ₦</th>
              </tr>
            </thead>
            <tbody>
              {draft.map((d, i) => (
                <tr key={i}>
                  <td>
                    <select aria-label={`Account, line ${i + 1}`} value={d.lineId} onChange={(e) => edit(i, { lineId: e.target.value })}>
                      <option value="">Select an account</option>
                      {lines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code} {l.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ width: 150 }}>
                    <input type="text" inputMode="decimal" aria-label={`Debit, line ${i + 1}`} className="num" value={d.debit} onChange={(e) => edit(i, { debit: e.target.value })} />
                  </td>
                  <td style={{ width: 150 }}>
                    <input type="text" inputMode="decimal" aria-label={`Credit, line ${i + 1}`} className="num" value={d.credit} onChange={(e) => edit(i, { credit: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ErrorNote error={error} />
          <div className="row">
            <button onClick={() => setDraft([...draft, blank()])}>Add line</button>
            <button className="primary" disabled={busy} onClick={add}>
              Save journal
            </button>
          </div>
        </div>
      )}
      {lines.length === 0 && <div className="banner info">Import a trial balance first.</div>}
    </div>
  );
}

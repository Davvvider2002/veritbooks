import { newAccountCode, parseJournals, rowsToCsv, type Column, type MissingAccount, type RowProblem } from '../engine/journalImport';
import { NATURE_CODES } from '../engine/chart';
import { AddAccount, LinePicker, addAccounts } from './accounts';
import { readRows } from './input';
import { useEffect, useMemo, useState } from 'react';
import { currencyOf } from '../content/jurisdictions';
import { registerWorkbook } from '../engine/etbSheets';
import { journalRegister, SOURCE_LABEL, type JournalSource } from '../engine/journalRegister';
import { longDate } from '../engine/report';
import { downloadWorkbook } from '../excel';
import { PACKS, PACK_VERSION, packOf, programmeFor } from '../content/packs';
import { repo } from '../data';
import { BENCHMARKS, benchmarkBase, computeMateriality, unadjustedEffect } from '../engine/checks';
import { fmt, fmt2, parseAmount, cur } from '../engine/money';
import type { JournalLine, Nature, Planning, ProgrammeState, TbLine } from '../engine/types';
import type { Evidence } from '../data/repo';
import { ErrorNote, Field, useAction } from '../ui';
import type { Ctx } from '../workspace';


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
                  {b.label}: {cur()}{fmt(benchmarkBase(statements.cur, k as keyof typeof BENCHMARKS), { zero: '0' })} (commonly {b.range})
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
              <tr><td>Benchmark amount</td><td className="num">{cur()}{fmt(m.base, { zero: '0' })}</td></tr>
              <tr><td><strong>Overall materiality</strong></td><td className="num"><strong>{cur()}{fmt(m.overall, { zero: '0' })}</strong></td></tr>
              <tr><td>Performance materiality</td><td className="num">{cur()}{fmt(m.performance, { zero: '0' })}</td></tr>
              <tr><td>Clearly trivial threshold</td><td className="num">{cur()}{fmt(m.trivial, { zero: '0' })}</td></tr>
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

export function ProgrammeStep(ctx: Ctx) {
  const { eng, ws, jur, locked, reload } = ctx;
  const items = programmeFor(eng.type, eng.planning);
  const pack = packOf(eng.planning);
  const { error, run } = useAction();
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, eng.programme[i.id]?.note ?? ''])),
  );
  const areas = [...new Set(items.map((i) => i.area))];

  const save = (id: string, done: boolean, patch: Partial<ProgrammeState[string]> = {}) =>
    run(async () => {
      const was = eng.programme[id];
      // The sign-off keeps who did the work; unticking clears it and the review with it.
      const signed = done && was?.done ? { by: was.by, at: was.at, reviewedBy: was.reviewedBy, reviewedAt: was.reviewedAt } : done ? { by: ws.me.fullName || ws.me.userId, at: new Date().toISOString() } : {};
      const programme = {
        ...eng.programme,
        [id]: { done, note: notes[id] || undefined, files: was?.files, ...signed, ...patch },
      };
      await repo.updateEngagement(eng.id, { programme });
      reload();
    });

  return (
    <div className="stack">
      <div>
        <h2>Work programme</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Sign off each step when the work is done: record the working paper reference and attach or link the working papers and evidence that support it. A manager or partner then marks it reviewed. Every step must be signed off before the file is signed.
        </p>
      </div>
      <div className="banner warn">
        Starter content, version {eng.programmeVersion || 'unversioned'}. These steps show how the programme works. They are not a reviewed methodology and must be replaced by one written against the standards adopted in your country ({jur.regulator === 'FRC' ? 'by the FRC of Nigeria' : `by ${jur.adoptedBy ?? 'the IAASB and IASB'}`}) before live use.
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
            .map((i) => (
              <ProgrammeItem key={i.id} ctx={ctx} item={i} note={notes[i.id] ?? ''} setNote={(v) => setNotes({ ...notes, [i.id]: v })} save={save} />
            ))}
        </div>
      ))}
    </div>
  );
}

/**
 * One programme step: ticked off by the person who did the work, with the working paper reference
 * and the files that support it, then reviewed by a manager or partner.
 */
function ProgrammeItem({ ctx, item, note, setNote, save }: { ctx: Ctx; item: { id: string; text: string }; note: string; setNote: (v: string) => void; save: (id: string, done: boolean, patch?: Partial<ProgrammeState[string]>) => Promise<void> }) {
  const { eng, ws, evidence, locked, reload } = ctx;
  const st = eng.programme[item.id];
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);
  const [pick, setPick] = useState('');
  const { busy, error, run } = useAction();
  const attached = evidence.filter((e) => e.refType === 'programme' && e.refId === item.id);
  const linked = evidence.filter((e) => (st?.files ?? []).includes(e.id) && !attached.includes(e));
  const all = [...attached, ...linked];
  const others = evidence.filter((e) => !all.includes(e));
  const me = ws.me.fullName || ws.me.userId;
  const reviewer = ws.me.role === 'partner' || ws.me.role === 'manager';
  const openFile = (e: Evidence) => void run(async () => void window.open(await repo.evidenceUrl(e), '_blank', 'noopener'));
  return (
    <div className="programme-item">
      <input type="checkbox" id={item.id} disabled={locked} checked={!!st?.done} onChange={(e) => void save(item.id, e.target.checked)} />
      <div>
        <label htmlFor={item.id}>{item.text}</label> {all.length > 0 && <span className="tag ok">{all.length} file{all.length === 1 ? '' : 's'}</span>}{' '}
        {st?.reviewedBy && <span className="tag ok">Reviewed</span>}
        {st?.done && st.by && (
          <div className="small muted">
            Signed off by {st.by}, {new Date(st.at ?? '').toLocaleDateString('en-GB')}
            {st.reviewedBy && <>. Reviewed by {st.reviewedBy}, {new Date(st.reviewedAt ?? '').toLocaleDateString('en-GB')}</>}
          </div>
        )}
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            aria-label={`Working paper reference or note for: ${item.text}`}
            placeholder="Working paper reference or note"
            disabled={locked}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if ((st?.note ?? '') !== note) void save(item.id, !!st?.done);
            }}
            style={{ flex: '1 1 260px' }}
          />
          <button className="link small" aria-expanded={open} aria-label={`Working papers for: ${item.text}`} onClick={() => setOpen(!open)}>
            {open ? 'Close' : all.length ? `Working papers (${all.length})` : 'Attach working papers'}
          </button>
          {!locked && reviewer && st?.done && !st.reviewedBy && (
            <button className="link small" aria-label={`Mark reviewed: ${item.text}`} disabled={busy} onClick={() => void run(() => save(item.id, true, { reviewedBy: me, reviewedAt: new Date().toISOString() }))}>
              Mark reviewed
            </button>
          )}
        </div>
        {open && (
          <div className="stack" style={{ marginTop: 8, padding: 12, border: '1px solid var(--rule)', borderRadius: 6 }} aria-label={`Working papers: ${item.text}`}>
            {all.length === 0 ? (
              <span className="small muted">No working papers or evidence linked to this step yet.</span>
            ) : (
              <ul className="small files" style={{ margin: 0 }}>
                {all.map((e) => (
                  <li key={e.id}>
                    <button className="link" onClick={() => openFile(e)}>{e.fileName}</button>{' '}
                    <span className="muted">
                      {e.note ? `${e.note}. ` : ''}
                      {linked.includes(e) ? 'Linked from Evidence' : `Attached by ${e.uploadedByName || 'the team'}`}, {new Date(e.createdAt).toLocaleDateString('en-GB')}
                    </span>{' '}
                    {linked.includes(e) && !locked && (
                      <button className="link danger small" disabled={busy} onClick={() => void run(() => save(item.id, !!st?.done, { files: (st?.files ?? []).filter((x) => x !== e.id) }))}>
                        Unlink
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!locked && (
              <>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input key={inputKey} type="file" multiple aria-label={`Attach working papers to: ${item.text}`} onChange={(e) => setFiles([...(e.target.files ?? [])])} />
                  <button
                    disabled={busy || files.length === 0}
                    onClick={() =>
                      void run(async () => {
                        for (const f of files) await repo.addEvidence(eng.id, f, { refType: 'programme', refId: item.id, note: note.trim() ? `W/P ${note.trim()}` : '', uploadedByName: me });
                        setFiles([]);
                        setInputKey(inputKey + 1);
                        reload();
                      })
                    }
                  >
                    {files.length > 1 ? `Attach ${files.length} files` : 'Attach'}
                  </button>
                </div>
                {others.length > 0 && (
                  <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                    <select aria-label={`Link a file from Evidence to: ${item.text}`} value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: '1 1 260px' }}>
                      <option value="">Link a file already in Evidence</option>
                      {others.map((e) => (
                        <option key={e.id} value={e.id}>{e.fileName}{e.note ? `: ${e.note}` : ''}</option>
                      ))}
                    </select>
                    <button
                      disabled={busy || !pick}
                      onClick={() =>
                        void run(async () => {
                          await save(item.id, !!st?.done, { files: [...(st?.files ?? []), pick] });
                          setPick('');
                        })
                      }
                    >
                      Link
                    </button>
                  </div>
                )}
                {!st?.done && (
                  <div>
                    <button className="primary" disabled={busy} onClick={() => void run(() => save(item.id, true))}>
                      Sign off this step
                    </button>{' '}
                    <span className="small muted">Records your name, the date, the reference and these files against the step.</span>
                  </div>
                )}
              </>
            )}
            <ErrorNote error={error} />
          </div>
        )}
      </div>
    </div>
  );
}

interface DraftLine {
  lineId: string;
  debit: string;
  credit: string;
}
const blank = (): DraftLine => ({ lineId: '', debit: '', credit: '' });

/**
 * The register of journals passed: every journal on the file in one list, whichever step made it.
 * Bank reconciliation journals (BR1, BR2) and tax journals (TAX1, TAX2) sit with those entered or
 * imported here, each series in number order, and can be filtered by source.
 */
function JournalsPassed({ ctx }: { ctx: Ctx }) {
  const { eng, client, ws, lines, adjustments, locked, reload } = ctx;
  const reg = useMemo(() => journalRegister(adjustments, lines), [adjustments, lines]);
  const [only, setOnly] = useState<JournalSource | 'all'>('all');
  const { busy, error, run } = useAction();
  const shown = reg.entries.filter((e) => only === 'all' || e.source === only);
  const dr = shown.reduce((t, e) => t + e.total, 0);
  return (
    <div className="card stack" aria-label="Journals passed">
      <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Journals passed ({reg.entries.length})</h3>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            Every journal on the file, wherever it was made: here, by import, on the Bank step (BR) or from the tax computation (TAX). Each series is listed in number order.
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label className="row small">
            Source
            <select aria-label="Source of journals" value={only} onChange={(e) => setOnly(e.target.value as JournalSource | 'all')} style={{ width: 'auto' }}>
              <option value="all">All sources</option>
              {reg.bySource.map((b) => (
                <option key={b.source} value={b.source}>
                  {SOURCE_LABEL[b.source]} ({b.count})
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy}
            onClick={() =>
              void run(() =>
                downloadWorkbook(
                  registerWorkbook(
                    { client: client.name, yearEndText: longDate(eng.yearEnd), currency: currencyOf(eng.currency).name, preparedBy: ws.me.fullName || 'The audit team', preparedOn: longDate(new Date().toISOString().slice(0, 10)) },
                    reg,
                  ),
                  `${client.name} journals passed ${eng.yearEnd.slice(0, 4)}`,
                ),
              )
            }
          >
            Download Excel
          </button>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {reg.bySource.map((b) => (
          <span key={b.source} className="tag">
            {SOURCE_LABEL[b.source]}: {b.count} journal{b.count === 1 ? '' : 's'}, {cur()}{fmt2(b.posted)} posted{b.unadjusted ? `, ${cur()}${fmt2(b.unadjusted)} unadjusted` : ''}
          </span>
        ))}
      </div>
      <ErrorNote error={error} />
      <div className="grid-view" style={{ maxHeight: 'none' }}>
        <table className="data" aria-label="Register of journals passed">
          <thead>
            <tr>
              <th className="freeze edge">Ref</th>
              <th>Source</th>
              <th>Description</th>
              <th>Account</th>
              <th className="num">Debit</th>
              <th className="num">Credit</th>
              <th>Status</th>
              {!locked && <th />}
            </tr>
          </thead>
          <tbody>
            {shown.map((e) =>
              e.lines.map((l, i) => (
                <tr key={`${e.id}-${i}`} className={i === 0 ? 'jnl-first' : undefined} style={i === 0 ? { borderTop: '2px solid var(--line, #d9d9d9)' } : undefined}>
                  <td className="freeze edge">{i === 0 && <strong>{e.ref}</strong>}</td>
                  <td className="small">{i === 0 && SOURCE_LABEL[e.source]}</td>
                  <td className="small">{i === 0 && e.description}</td>
                  <td>
                    {l.code} {l.name}
                  </td>
                  <td className="num">{l.debit ? fmt2(l.debit) : ''}</td>
                  <td className="num">{l.credit ? fmt2(l.credit) : ''}</td>
                  <td>{i === 0 && <span className={`tag ${e.posted ? 'ok' : 'warn'}`}>{e.posted ? 'Posted' : 'Unadjusted'}</span>}</td>
                  {!locked && (
                    <td>
                      {i === 0 && (
                        <button
                          className="link danger"
                          aria-label={`Delete ${e.ref}`}
                          onClick={() =>
                            void run(async () => {
                              await repo.deleteAdjustment(e.id);
                              reload();
                            })
                          }
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )),
            )}
            <tr className="sub">
              <td className="freeze edge">Total</td>
              <td colSpan={3} className="small muted">
                {shown.length} journal{shown.length === 1 ? '' : 's'}
              </td>
              <td className="num">{fmt2(dr)}</td>
              <td className="num">{fmt2(dr)}</td>
              <td colSpan={locked ? 1 : 2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function JournalsStep(ctx: Ctx) {
  const { eng, lines, adjustments, statements, locked, reload } = ctx;
  const [ref, setRef] = useState('');
  const [description, setDescription] = useState('');
  const [posted, setPosted] = useState(true);
  const [draft, setDraft] = useState<DraftLine[]>([blank(), blank()]);
  const [newAccount, setNewAccount] = useState(false);
  const { busy, error, run, setError } = useAction();
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
          A journal passed by the audit team is posted as an adjustment and flows into the financial statements. To record a difference the client will not correct, mark it as an unadjusted difference: it stays out of the statements and is totalled against materiality.
        </p>
      </div>

      {adjustments.length > 0 && <JournalsPassed ctx={ctx} />}
      {adjustments.length > 0 && (
        <div className={`banner ${m && Math.abs(unadjusted) >= m.overall ? 'bad' : 'info'}`}>
          Net effect of unadjusted differences on profit before tax: {cur()}{fmt(unadjusted, { zero: '0' })}.
          {m ? ` Overall materiality is ${cur()}${fmt(m.overall, { zero: '0' })}.` : eng.type === 'audit' ? ' Materiality has not been set.' : ''}
        </div>
      )}

      {!locked && lines.length > 0 && <JournalImport engagementId={eng.id} lines={lines} existing={adjustments.map((a) => a.ref)} reload={reload} />}

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
                <option value="posted">Posted as an adjustment</option>
                <option value="proposed">Unadjusted difference, not posted</option>
              </select>
            </Field>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Account</th>
                <th className="num">Debit {cur()}</th>
                <th className="num">Credit {cur()}</th>
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
          {newAccount ? (
            <div className="card stack" style={{ background: 'var(--panel, transparent)' }}>
              <div className="between">
                <h4 style={{ margin: 0 }}>New GL account</h4>
                <button className="link" onClick={() => setNewAccount(false)}>
                  Close
                </button>
              </div>
              <AddAccount
                engagementId={eng.id}
                lines={lines}
                onAdded={(fresh, code) => {
                  // The new account goes on the first empty line of the journal.
                  const added = fresh.find((l) => l.code === code);
                  const at = draft.findIndex((d) => !d.lineId);
                  if (added && at >= 0) edit(at, { lineId: added.id });
                  else if (added) setDraft([...draft, { ...blank(), lineId: added.id }]);
                  reload();
                }}
              />
            </div>
          ) : (
            <div className="small">
              An account the trial balance does not have?{' '}
              <button className="link" onClick={() => setNewAccount(true)}>
                Create and map a new GL account
              </button>
            </div>
          )}
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

/** A missing account as the user settles it: whether to add it, its code, name and statement line. */
type Pending = { add: boolean; code: string; name: string; mapCode: string; nature: Nature | '' };

const drcr = (v: number) => (v > 0 ? `${fmt2(v)} Dr` : v < 0 ? `${fmt2(-v)} Cr` : '–');

/**
 * Accounts the journal file uses that the trial balance does not have. Each is listed once, with
 * its debits and credits in the file and the statement line it most likely belongs on, and can be
 * added to the trial balance with a nil balance so the journals that use it can be imported.
 */
function MissingAccounts({ missing, taken, busy, onAdd }: { missing: MissingAccount[]; taken: string[]; busy: boolean; onAdd: (accounts: Pending[]) => void }) {
  const [rows, setRows] = useState<Pending[]>(() => {
    const used = new Set(taken.map((c) => c.trim().toLowerCase()));
    return missing.map((m) => {
      // An account the file names without a code gets one, which can be changed before it is added.
      let code = m.code;
      if (!code) {
        code = newAccountCode(used);
        used.add(code.toLowerCase());
      }
      return { add: true, code, name: m.name, mapCode: m.mapCode ?? '', nature: m.nature ?? (m.mapCode && NATURE_CODES.has(m.mapCode) ? 'other' : '') };
    });
  });
  const put = (i: number, patch: Partial<Pending>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.add);
  const unnamed = chosen.filter((r) => !r.name.trim()).length;
  const label = (m: MissingAccount) => m.code || m.name;
  return (
    <div className="card stack" style={{ borderColor: 'var(--warn, #b7791f)' }} aria-label="Accounts not in the trial balance">
      <div>
        <h4 style={{ margin: 0 }}>
          {missing.length} account{missing.length === 1 ? ' is' : 's are'} not in the trial balance
        </h4>
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          The journals that use {missing.length === 1 ? 'it' : 'them'} are held back. Check each account’s code and name, and choose its line in the statements. Adding it puts it in the trial balance with a nil balance; the journals then give it the amounts shown. Ask the client to include it in the trial balance next time, or it will need adding again after a fresh import.
        </p>
      </div>
      <div className="grid-view" style={{ maxHeight: 460 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Add</th>
              <th>Code</th>
              <th>Name</th>
              <th>Line in the statements</th>
              <th>Used in</th>
              <th className="num">Debit {cur()}</th>
              <th className="num">Credit {cur()}</th>
              <th className="num">Net {cur()}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const m = missing[i];
              return (
                <tr key={label(m)}>
                  <td>
                    <input type="checkbox" aria-label={`Add account ${label(m)}`} checked={r.add} onChange={(e) => put(i, { add: e.target.checked })} />
                  </td>
                  <td style={{ minWidth: 110 }}>
                    {m.code ? (
                      <strong>{m.code}</strong>
                    ) : (
                      <>
                        <input type="text" aria-label={`Code for account ${label(m)}`} value={r.code} maxLength={30} onChange={(e) => put(i, { code: e.target.value })} />
                        <div className="small muted">No code in the file</div>
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: 200 }}>
                    <input type="text" aria-label={`Name of account ${label(m)}`} placeholder="Account name" value={r.name} onChange={(e) => put(i, { name: e.target.value })} />
                  </td>
                  <td style={{ minWidth: 230 }}>
                    <LinePicker label={`account ${label(m)}`} mapCode={r.mapCode} nature={r.nature} onChange={(mapCode, nature) => put(i, { mapCode, nature })} />
                    <div className="small muted">{m.basis}</div>
                  </td>
                  <td className="small">
                    {m.refs.slice(0, 3).join(', ')}
                    {m.refs.length > 3 ? ` and ${m.refs.length - 3} more` : ''}
                    <div className="muted">
                      {m.rows.length} line{m.rows.length === 1 ? '' : 's'}
                    </div>
                  </td>
                  <td className="num">{m.debit ? fmt2(m.debit) : '–'}</td>
                  <td className="num">{m.credit ? fmt2(m.credit) : '–'}</td>
                  <td className="num">{drcr(m.net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {unnamed > 0 && <div className="small muted">An account left without a name is added under its code. You can rename it later by importing the trial balance again.</div>}
      <div>
        <button className="primary" disabled={busy || chosen.length === 0} onClick={() => onAdd(chosen)}>
          Add {chosen.length} account{chosen.length === 1 ? '' : 's'} and read the file again
        </button>
      </div>
    </div>
  );
}

const COLUMN_LABEL: Record<Column, string> = {
  ref: 'Reference',
  date: 'Date',
  description: 'Description',
  account: 'Account code',
  accountName: 'Account name',
  debit: 'Debit',
  credit: 'Credit',
  amount: 'Amount',
  treatment: 'Treatment',
};
const COLUMN_ORDER: Column[] = ['ref', 'date', 'description', 'account', 'accountName', 'debit', 'credit', 'amount', 'treatment'];
const show = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

/**
 * The flagged rows of the journal file, editable in place. The set of rows stays put while they
 * are corrected, so a row that is fixed shows as fixed rather than vanishing. Each edit reads the
 * file again at once.
 */
function FlaggedRows({ rows, at, problems, layout, onChange, file }: { rows: unknown[][]; at: number[]; problems: RowProblem[]; layout: NonNullable<JournalImportResult['layout']>; onChange: (rows: unknown[][], at?: number[]) => void; file: string }) {
  const cols = COLUMN_ORDER.filter((k) => layout.columns[k] >= 0);
  const width = Math.max(...COLUMN_ORDER.map((k) => layout.columns[k]), (rows[layout.header] ?? []).length - 1) + 1;
  const open = at.filter((i) => problems.some((p) => p.index === i)).length;
  const setCell = (index: number, col: number, value: string) => {
    const next = rows.map((r) => r);
    const row = Array.from({ length: Math.max(width, (rows[index] ?? []).length) }, (_, k) => (rows[index] ?? [])[k] ?? '');
    row[col] = value;
    next[index] = row;
    onChange(next);
  };
  const remove = (index: number) => {
    const next = rows.map((r) => r);
    next[index] = []; // a blank row is passed over, and row numbers stay the same
    onChange(next, at.filter((i) => i !== index));
  };
  const addLine = (index: number) => {
    const row = Array.from({ length: width }, () => '' as unknown);
    const src = rows[index] ?? [];
    for (const k of ['ref', 'date', 'description', 'treatment'] as Column[]) if (layout.columns[k] >= 0) row[layout.columns[k]] = src[layout.columns[k]] ?? '';
    onChange([...rows, row], [...at, rows.length]);
  };
  const download = () => {
    const blob = new Blob([rowsToCsv(rows.filter((r, i) => i <= layout.header || (r ?? []).some((c) => show(c).trim())))], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${file.replace(/\.[^.]+$/, '') || 'journals'}-corrected.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="card stack" style={{ borderColor: 'var(--bad, #c53030)' }} aria-label="Rows to correct">
      <div className="between">
        <h4 style={{ margin: 0 }}>{open ? `${open} row${open === 1 ? '' : 's'} to correct` : 'All flagged rows corrected'}</h4>
        <button className="link" onClick={download}>
          Download corrected file
        </button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Correct the rows here and the file is read again as you type. Journals that balance move to the list below, ready to add. Delete a row the client entered twice, or add a line to complete a journal. The corrected file can be downloaded to send back to the client.
      </p>
      <div className="grid-view" style={{ ['--f1' as string]: '52px', maxHeight: 460 }}>
        <table className="data">
          <thead>
            <tr>
              <th className="freeze f1">Row</th>
              <th className="freeze f2 edge">Problem</th>
              {cols.map((k) => (
                <th key={k} className={['debit', 'credit', 'amount'].includes(k) ? 'num' : undefined}>
                  {show(rows[layout.header]?.[layout.columns[k]]) || COLUMN_LABEL[k]}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {at.map((index) => {
              const issues = problems.filter((p) => p.index === index);
              return (
                <tr key={index}>
                  <td className="small freeze f1">{index + 1}</td>
                  <td className="small freeze f2 edge wrap" style={{ minWidth: 170, maxWidth: 220 }}>
                    {issues.length ? <span className="danger">{issues.map((p) => p.message).join(' ')}</span> : <span className="tag ok">Corrected</span>}
                  </td>
                  {cols.map((k) => {
                    const num = ['debit', 'credit', 'amount'].includes(k);
                    return (
                      <td key={k} style={{ minWidth: num ? 110 : k === 'description' || k === 'accountName' ? 150 : k === 'date' ? 105 : 70 }}>
                        <input
                          type="text"
                          className={num ? 'num' : undefined}
                          inputMode={num ? 'decimal' : undefined}
                          aria-label={`${COLUMN_LABEL[k]}, row ${index + 1}`}
                          value={show(rows[index]?.[layout.columns[k]])}
                          onChange={(e) => setCell(index, layout.columns[k], e.target.value)}
                        />
                      </td>
                    );
                  })}
                  <td className="small" style={{ whiteSpace: 'nowrap' }}>
                    <button className="link" aria-label={`Add a line after row ${index + 1}`} onClick={() => addLine(index)}>
                      Add line
                    </button>{' '}
                    <button className="link danger" aria-label={`Delete row ${index + 1}`} onClick={() => remove(index)}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type JournalImportResult = ReturnType<typeof parseJournals>;

/** Adds many journals at once from a spreadsheet, after showing what will be added. */
function JournalImport({ engagementId, lines, existing, reload }: { engagementId: string; lines: TbLine[]; existing: string[]; reload: () => void }) {
  const [result, setResult] = useState<JournalImportResult | null>(null);
  const [file, setFile] = useState('');
  // The rows are kept so the file can be read again once missing accounts are added or rows corrected.
  const [rows, setRows] = useState<unknown[][] | null>(null);
  // The rows flagged when the file was read, kept in view while they are corrected.
  const [flagged, setFlagged] = useState<number[]>([]);
  // The trial balance as it stands after accounts are added here, before the page reloads.
  const [known, setKnown] = useState<TbLine[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, run, setError } = useAction();
  // Once the page has reloaded with the new accounts, the trial balance it passes in is the one to use.
  useEffect(() => setKnown(null), [lines]);
  const tb = known ?? lines;
  const taken = new Set(existing.map((r) => r.trim().toLowerCase()));
  const clash = (result?.journals ?? []).filter((j) => taken.has(j.ref.toLowerCase()));
  const ready = (result?.journals ?? []).filter((j) => !taken.has(j.ref.toLowerCase()));
  const name = (id: string) => {
    const l = tb.find((x) => x.id === id);
    return l ? `${l.code} ${l.name}` : '';
  };
  const flagRows = (r: JournalImportResult) => [...new Set(r.problems.map((p) => p.index))].sort((a, b) => a - b);
  const reread = (next: unknown[][], at?: number[]) => {
    setRows(next);
    const r = parseJournals(next, tb);
    setResult(r);
    // Rows that newly go wrong while others are corrected join the list.
    const base = at ?? flagged;
    setFlagged([...new Set([...base, ...flagRows(r)])].sort((a, b) => a - b));
  };
  const addMissing = (accounts: Pending[]) =>
    void run(async () => {
      setNotice(null);
      const fresh = await addAccounts(
        engagementId,
        tb,
        accounts.map((a) => ({ code: a.code, name: a.name.trim() || a.code.trim(), mapCode: a.mapCode || null, nature: a.nature || null })),
      );
      setKnown(fresh);
      if (rows) {
        const r = parseJournals(rows, fresh);
        setResult(r);
        setFlagged((f) => [...new Set([...f, ...flagRows(r)])].sort((a, b) => a - b));
      }
      setNotice(
        `Added ${accounts.length} account${accounts.length === 1 ? '' : 's'} to the trial balance with a nil balance: ${accounts.map((a) => `${a.code.trim()} ${a.name.trim()}`.trim()).join(', ')}. Their amounts come from the journals, and show in the Mapping step once the journals are added.${accounts.some((a) => !a.mapCode) ? ' Map the ones left unmapped there.' : ''}`,
      );
      reload();
    });
  return (
    <div className="card stack" aria-label="Import journals">
      <div className="between">
        <h3>Import journals from Excel or CSV</h3>
        <a className="small" href="/samples/journals-template.csv" download>
          Download a template
        </a>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        One row per journal line, with columns for the reference, the account code and account name, and debit and credit (or one Amount column, debits positive and credits negative). A file with account names only is matched to the trial balance by name. Date and description are optional. Every journal is posted, unless a Treatment column marks it as an unadjusted difference. Rows with the same reference form one journal, and each journal must balance. Accounts the trial balance does not have can be added here, and flagged rows corrected here before the import.
      </p>
      <input
        type="file"
        aria-label="Journal file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // so the same file can be chosen again after it is corrected
          if (!f) return;
          setFile(f.name);
          setNotice(null);
          void run(async () => {
            const read = await readRows(f);
            setRows(read);
            const r = parseJournals(read, tb);
            setResult(r);
            setFlagged(flagRows(r));
          });
        }}
      />
      <ErrorNote error={error} />
      {notice && <div className="banner info">{notice}</div>}
      {result && (
        <div className="stack">
          {result.missing.length > 0 && (
            <MissingAccounts key={`${file}-${result.missing.map((m) => m.code || m.name).join('|')}`} missing={result.missing} taken={tb.map((l) => l.code)} busy={busy} onAdd={addMissing} />
          )}
          {result.waiting.length > 0 && (
            <div className="banner warn">
              {result.waiting.length} journal{result.waiting.length === 1 ? ' is' : 's are'} waiting for {result.waiting.length === 1 ? 'its' : 'their'} accounts: {result.waiting.slice(0, 8).join(', ')}
              {result.waiting.length > 8 ? ` and ${result.waiting.length - 8} more` : ''}.
            </div>
          )}
          {!result.layout && result.errors.length > 0 && <div className="banner bad">{result.errors[0]}</div>}
          {result.layout && rows && result.errors.length > 0 && flagged.length === 0 && <div className="banner bad">{result.errors.join(' ')}</div>}
          {result.layout && rows && flagged.length > 0 && <FlaggedRows rows={rows} at={flagged} problems={result.problems} layout={result.layout} onChange={reread} file={file} />}
          {clash.length > 0 && <div className="banner warn">Already in this file, so skipped: {clash.map((j) => j.ref).join(', ')}.</div>}
          {ready.length > 0 && (
            <>
              <table className="data">
                <thead>
                  <tr>
                    <th>Journal</th>
                    <th>Lines</th>
                    <th>Treatment</th>
                    <th className="num">Debits {cur()}</th>
                  </tr>
                </thead>
                <tbody>
                  {ready.map((j) => (
                    <tr key={j.ref}>
                      <td>
                        <strong>{j.ref}</strong> {j.description}
                      </td>
                      <td className="small">{j.lines.map((l) => `${name(l.lineId)} ${drcr(l.amount)}`).join('; ')}</td>
                      <td>{j.posted ? 'Posted' : 'Unadjusted'}</td>
                      <td className="num">{fmt2(j.lines.reduce((a, l) => a + Math.max(l.amount, 0), 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.problems.length > 0 && <div className="small muted">Journals with rows still to correct are not in this list. Add these now and the rest once they are corrected, or correct them first.</div>}
              <div>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    void run(async () => {
                      for (const j of ready) await repo.addAdjustment(engagementId, { ref: j.ref, description: [j.date, j.description].filter(Boolean).join(' · '), posted: j.posted, lines: j.lines });
                      const left = result.problems.length > 0 || result.missing.length > 0;
                      if (!left) {
                        setResult(null);
                        setRows(null);
                        setFlagged([]);
                        setFile('');
                      }
                      setNotice(`${ready.length} journal${ready.length === 1 ? '' : 's'} added.${left ? ' The rest of the file stays here to finish.' : ''}`);
                      reload();
                    });
                  }}
                >
                  Add {ready.length} journal{ready.length === 1 ? '' : 's'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

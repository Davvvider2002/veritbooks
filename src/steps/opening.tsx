import { useState } from 'react';
import { Link } from 'react-router-dom';
import { repo } from '../data';
import type { Engagement } from '../data/repo';
import { fmt, cur } from '../engine/money';
import { openingComparison } from '../engine/opening';
import { longDate } from '../engine/report';
import type { Adjustment, TbLine } from '../engine/types';
import { ErrorNote, Field, useAction, useLoad } from '../ui';
import type { Ctx } from '../workspace';

const STATUS = {
  agreed: 'Opening balances agree with last year’s audited figures',
  explained: 'Differences found and explained',
  first_year: 'First year: last year’s figures were not audited by us, or not audited',
} as const;

/** The year end one year before this one. */
const yearBefore = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;

/** Checks this year's opening balances against last year's signed file, or records the work done another way. */
export function OpeningStep({ eng, client, lines, ws, locked, reload }: Ctx) {
  const last = useLoad(async () => {
    const all = await repo.listEngagements();
    const prior = all.find((e: Engagement) => e.clientId === eng.clientId && e.id !== eng.id && e.yearEnd === yearBefore(eng.yearEnd)) ?? null;
    if (!prior) return { prior: null, lines: [] as TbLine[], adjustments: [] as Adjustment[] };
    const [l, a] = await Promise.all([repo.listLines(prior.id), repo.listAdjustments(prior.id)]);
    return { prior, lines: l, adjustments: a };
  }, [eng.id]);
  const saved = eng.testing.opening;
  const [status, setStatus] = useState<keyof typeof STATUS>(saved?.status ?? 'agreed');
  const [note, setNote] = useState(saved?.note ?? '');
  const { busy, error, run } = useAction();
  const me = ws.me.fullName || 'A team member';
  const hasPrior = lines.some((l) => l.prior !== null);

  const prior = last.data?.prior ?? null;
  const cmp = prior && hasPrior ? openingComparison(lines, last.data!.lines, last.data!.adjustments) : null;
  const source = prior && prior.status === 'locked' ? 'veritbooks' : 'manual';

  return (
    <div className="stack">
      <div>
        <h2>Opening balances</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          This year begins where last year ended. Confirm that the opening balances, which are the prior year column of {client.name}’s trial balance, agree with last year’s audited closing balances. Where they do not, find out why before relying on them.
        </p>
      </div>
      <ErrorNote error={last.error} />
      {!hasPrior && <div className="banner warn">No prior year trial balance has been imported. Import it in the Trial balance step, then come back here.</div>}

      {last.data && !prior && (
        <div className="banner info">
          There is no file in VeritBooks for {client.name} for the year ended {longDate(yearBefore(eng.yearEnd))}, so there is nothing to compare automatically. Agree the opening balances to last year’s signed financial statements, attach them under Evidence, and record your conclusion below.
        </div>
      )}
      {prior && prior.status !== 'locked' && (
        <div className="banner warn">
          Last year’s file is in VeritBooks but has not been signed, so its figures are not yet audited. The comparison below uses them as they stand.{' '}
          <Link to={`/engagements/${prior.id}`}>Open last year’s file</Link>
        </div>
      )}

      {cmp && (
        <section className="card stack" aria-label="Comparison with last year">
          <div className="between">
            <h3>Compared with last year’s file</h3>
            <span className={`tag ${cmp.differences === 0 ? 'ok' : 'bad'}`}>{cmp.differences === 0 ? 'All lines agree' : `${cmp.differences} line(s) differ`}</span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Last year’s figures are its closing trial balance after the journals posted in that file
            {prior!.status === 'locked' ? `, as signed on ${longDate((prior!.signedAt ?? '').slice(0, 10))}` : ''}. This year’s figures are the prior year column of this trial balance.
          </p>
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Statement line</th>
                  <th className="num">Last year, audited {cur()}</th>
                  <th className="num">This year, opening {cur()}</th>
                  <th className="num">Difference {cur()}</th>
                </tr>
              </thead>
              <tbody>
                {cmp.rows.map((r) => (
                  <tr key={r.code} className={r.difference ? 'warn-row' : ''}>
                    <td>{r.label}</td>
                    <td className="num">{fmt(r.lastAudited)}</td>
                    <td className="num">{fmt(r.opening)}</td>
                    <td className="num">{r.difference ? <strong>{fmt(r.difference)}</strong> : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cmp.unmapped > 0 && <div className="banner warn">{cmp.unmapped} account(s) are not mapped in one of the two files, so they are left out of this comparison.</div>}
        </section>
      )}

      <section className="card stack" aria-label="Conclusion on opening balances">
        <h3>Conclusion</h3>
        {saved && (
          <div className="banner info">
            {STATUS[saved.status]}. Recorded by {saved.by} on {longDate(saved.at.slice(0, 10))}
            {saved.source === 'veritbooks' ? ', against last year’s signed file in VeritBooks' : ''}.
          </div>
        )}
        <Field label="Conclusion">
          <select disabled={locked} value={status} onChange={(e) => setStatus(e.target.value as keyof typeof STATUS)}>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Work done and explanations" hint="Say what you agreed the balances to. Explain each difference, or how you obtained evidence about opening balances in a first year.">
          <textarea disabled={locked} rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
        {!locked && (
          <div>
            <button
              className="primary"
              disabled={busy || !note.trim() || (status === 'agreed' && !!cmp && cmp.differences > 0)}
              onClick={() =>
                void run(async () => {
                  await repo.updateEngagement(eng.id, { testing: { ...eng.testing, opening: { status, note: note.trim(), by: me, at: new Date().toISOString(), source } } });
                  reload();
                })
              }
            >
              Record conclusion
            </button>
            {status === 'agreed' && cmp && cmp.differences > 0 && <p className="small muted">Lines differ, so the balances cannot be recorded as agreeing. Choose “Differences found and explained”.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

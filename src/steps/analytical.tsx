import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { packOf } from '../content/packs';
import { repo } from '../data';
import type { MovementPoints } from '../data/repo';
import { analyticalReview, unexplainedMovements, type Movement } from '../engine/analytical';
import { SECTION_LABEL } from '../engine/chart';
import { computeMateriality } from '../engine/checks';
import { fmt, fmt2 } from '../engine/money';
import { ErrorNote, useAction, type OnTrace } from '../ui';
import type { Ctx } from '../workspace';
import { TracePanel } from './trace';

const ratioText = (v: number | null, unit: string) => (v === null ? '–' : unit === '%' ? `${v}%` : unit === 'days' ? `${v} days` : `${v}`);

export function AnalyticalStep(ctx: Ctx) {
  const { eng, statements, ws, locked, reload } = ctx;
  const m = eng.type === 'audit' ? computeMateriality(statements.cur, eng.planning) : null;
  const review = useMemo(() => analyticalReview(statements, m?.performance ?? null), [statements, m?.performance]);
  const saved = eng.testing.movements ?? {};
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, v.note])));
  const [all, setAll] = useState(false);
  const [done, setDone] = useState(false);
  const [trace, setTrace] = useState<Parameters<OnTrace>[0] | null>(null);
  const { busy, error, run } = useAction();
  const year = eng.yearEnd.slice(0, 4);

  if (ctx.lines.length === 0 || !review)
    return (
      <div className="stack">
        <h2>Analytical review</h2>
        <div className="banner info">
          {ctx.lines.length === 0 ? 'Import a trial balance first.' : 'Analytical review compares this year with last. Import the prior year trial balance to use it.'}
        </div>
      </div>
    );

  const dirty = review.movements.some((x) => (notes[x.code] ?? '').trim() !== (saved[x.code]?.note ?? ''));
  const open = unexplainedMovements(review, Object.fromEntries(Object.entries(notes).map(([k, note]) => [k, { note }])));
  const significant = review.movements.filter((x) => x.significant);
  const shown = all ? review.movements : significant;
  const save = () =>
    run(async () => {
      const movements: typeof saved = {};
      for (const x of review.movements) {
        const note = (notes[x.code] ?? '').trim();
        if (!note) continue;
        const was = saved[x.code];
        movements[x.code] = was && was.note === note ? was : { note, by: ws.me.fullName || ws.me.userId, at: new Date().toISOString() };
      }
      await repo.updateEngagement(eng.id, { testing: { ...eng.testing, movements } });
      setDone(true);
      reload();
    });

  return (
    <div className="stack">
      <div>
        <h2>Analytical review</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Every line of the statements against last year, and the ratios to look at first. A movement of at least {fmt2(review.threshold)} ({review.basis}) and 10% is marked as significant. Obtain an explanation for each one, corroborate it, and record it here.
          {eng.type === 'review' ? ' A review cannot be signed until every significant movement is explained.' : ' Unexplained movements show as an advisory at sign-off.'}
        </p>
      </div>
      {review.basis !== 'performance materiality' && eng.type === 'audit' && (
        <div className="banner warn">
          Materiality is not set, so the threshold is {review.basis}. <Link to={`/engagements/${eng.id}/planning`}>Set materiality</Link> to use performance materiality.
        </div>
      )}

      <div className="card stack">
        <h3>Ratios</h3>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th></th>
                <th className="num">{year}</th>
                <th className="num">{Number(year) - 1}</th>
              </tr>
            </thead>
            <tbody>
              {review.ratios.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td className="num">{ratioText(r.cur, r.unit)}</td>
                  <td className="num">{ratioText(r.prior, r.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Days are on year-end balances: receivables on revenue, inventory and payables on cost of sales. They are indicators, not measures of the average through the year.
        </p>
      </div>

      <div className="between">
        <div className="row">
          <span className="tag">{significant.length} significant</span>
          <span className={`tag ${open.length ? 'warn' : 'ok'}`}>{open.length} with no explanation</span>
        </div>
        <label className="small row" style={{ gap: 6 }}>
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show every line
        </label>
      </div>

      <div className="card">
        {shown.length === 0 ? (
          <span className="muted">No line moved by enough to need an explanation.</span>
        ) : (
          shown.map((x) => (
            <MovementRow
              key={x.code}
              ctx={ctx}
              x={x}
              review={review}
              note={notes[x.code] ?? ''}
              setNote={(v) => {
                setDone(false);
                setNotes({ ...notes, [x.code]: v });
              }}
              saved={saved[x.code]}
              open={() => setTrace({ label: x.label, period: 'current', source: { code: x.code } })}
            />
          ))
        )}
      </div>

      <ErrorNote error={error} />
      {done && !dirty && <div className="banner info">Saved.</div>}
      {!locked && (
        <div className="row">
          <button className="primary" disabled={busy || !dirty} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save explanations'}
          </button>
          {dirty && <span className="small muted">You have explanations that are not saved.</span>}
        </div>
      )}
      {trace && <TracePanel key={trace.label} ctx={ctx} opened={trace} onClose={() => setTrace(null)} />}
    </div>
  );
}

function MovementRow({
  ctx,
  x,
  review,
  note,
  setNote,
  saved,
  open,
}: {
  ctx: Ctx;
  x: Movement;
  review: NonNullable<ReturnType<typeof analyticalReview>>;
  note: string;
  setNote: (v: string) => void;
  saved: { note: string; by: string; at: string } | undefined;
  open: () => void;
}) {
  const [points, setPoints] = useState<(MovementPoints & { model: string }) | null>(null);
  const ask = useAction();
  const naira = (k: number) => k / 100;
  const suggest = () =>
    void ask.run(async () => {
      setPoints(
        await repo.explainMovement(ctx.eng.id, {
          movement: { label: x.label, section: SECTION_LABEL[x.section], cur: naira(x.cur), prior: naira(x.prior), change: naira(x.change), percent: x.percent },
          lines: review.movements.filter((y) => y.code !== x.code).map((y) => ({ label: y.label, cur: naira(y.cur), prior: naira(y.prior) })),
          ratios: review.ratios.map((r) => ({ label: r.label, cur: r.cur, prior: r.prior, unit: r.unit })),
          industry: packOf(ctx.eng.planning)?.name ?? '',
        }),
      );
    });
  return (
    <div className="journal movement">
      <div className="between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <button className="link" style={{ fontWeight: 600 }} title="Show the accounts behind this line" onClick={open}>{x.label}</button>
          <div className="small muted">
            {fmt(x.cur)} against {fmt(x.prior)}: {x.change > 0 ? 'up' : 'down'} {fmt(Math.abs(x.change))}
            {x.percent === null ? ', from nil' : `, ${Math.abs(x.percent)}%`}
          </div>
        </div>
        {x.significant ? <span className={`tag ${note.trim() ? 'ok' : 'warn'}`}>{note.trim() ? 'Explained' : 'Needs an explanation'}</span> : <span className="tag">Not significant</span>}
      </div>
      <textarea
        rows={2}
        disabled={ctx.locked}
        aria-label={`Explanation for ${x.label}`}
        placeholder="What management said, and what you agreed it to"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ marginTop: 8, minHeight: 56 }}
      />
      {saved && saved.note === note.trim() && (
        <div className="small muted">{saved.by}, {new Date(saved.at).toLocaleDateString('en-GB')}</div>
      )}
      {ctx.ws.firm.aiEnabled && !ctx.locked && x.significant && !points && (
        <div style={{ marginTop: 6 }}>
          <button disabled={ask.busy} aria-label={`Suggest questions about ${x.label}`} onClick={suggest}>{ask.busy ? 'Asking…' : 'Suggest questions to ask'}</button>
          <span className="small muted" style={{ marginLeft: 10 }}>Sends the statement lines and ratios for both years to the AI service.</span>
        </div>
      )}
      <ErrorNote error={ask.error} />
      {points && (
        <div className="assist" style={{ marginTop: 8 }}>
          <div className="small" style={{ fontWeight: 600 }}>Written by AI from the figures alone. It does not know what happened in this business. These are things to ask, not the explanation.</div>
          <p>{points.consistency}</p>
          {(
            [
              ['Causes to consider', points.causes],
              ['Questions for management', points.questions],
              ['What would corroborate an answer', points.corroboration],
            ] as [string, string[]][]
          ).map(([title, items]) =>
            items.length ? (
              <div key={title}>
                <strong className="small">{title}</strong>
                <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            ) : null,
          )}
          <div className="small muted">
            From {points.model}. Not saved to the file. Record what management told you and what you checked, in your own words, above.{' '}
            <button className="link small" onClick={() => setPoints(null)}>Hide</button>
          </div>
        </div>
      )}
    </div>
  );
}

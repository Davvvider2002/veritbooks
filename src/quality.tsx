import { useState } from 'react';
import { Link } from 'react-router-dom';
import { programmeFor } from './content/packs';
import { COMPONENTS, COMPONENT_LABEL, CONCLUSIONS, QUALITY_VERSION, SEVERITIES, STARTER_RISKS, type Component, type Conclusion } from './content/quality';
import { repo } from './data';
import type { QualityDraft, QualityItem, Workspace } from './data/repo';
import { longDate } from './engine/report';
import { ErrorNote, Field, useAction, useLoad } from './ui';

const today = () => new Date().toISOString().slice(0, 10);
const SEVERITY_LABEL = Object.fromEntries(SEVERITIES.map((s) => [s.id, s.label])) as Record<string, string>;
const CONCLUSION_SHORT: Record<Conclusion, [string, string]> = {
  effective: ['Effective', 'ok'],
  effective_except: ['Effective, except for deficiencies', 'warn'],
  not_effective: ['Not effective', 'bad'],
};

/** The firm's system of quality management: risks and responses, monitoring findings, and the annual evaluation. */
export function QualityPage({ ws }: { ws: Workspace }) {
  const { data, error, reload } = useLoad(async () => {
    const [items, evaluations, engagements, clients] = await Promise.all([
      repo.listQuality().catch(() => null),
      repo.listEvaluations().catch(() => null),
      repo.listEngagements(),
      repo.listClients(),
    ]);
    return { items, evaluations, engagements, clients };
  }, []);
  const partner = ws.me.role === 'partner';
  const { busy, error: actionError, run } = useAction();

  if (error) return <div className="page"><ErrorNote error={error} /></div>;
  if (!data) return <div className="page muted">Loading…</div>;
  if (data.items === null || data.evaluations === null)
    return (
      <div className="page stack">
        <h1>Quality management</h1>
        <div className="banner warn">
          Quality management needs a database update. Run <code>supabase/migrations/0007_quality_management.sql</code> in the Supabase SQL editor, then reload this page.
        </div>
      </div>
    );

  const act = (fn: () => Promise<void>) =>
    run(async () => {
      await fn();
      reload();
    });
  const risks = data.items.filter((i) => i.kind === 'risk');
  const findings = data.items.filter((i) => i.kind === 'finding');
  const openFindings = findings.filter((f) => f.status === 'open');
  const overdue = openFindings.filter((f) => f.dueDate && f.dueDate < today());
  const needResponse = risks.filter((r) => r.status === 'open');
  const last = data.evaluations[0];
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const evaluationDue = !last || last.asAt < yearAgo;
  const missing = STARTER_RISKS.filter((s) => !risks.some((r) => r.title === s.title));
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="page stack">
      <div>
        <h1>Quality management</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          The firm’s system of quality management under ISQM 1: the risks to quality and how the firm responds, what monitoring has found and what is being done about it, and the yearly evaluation. Everyone in the firm can read it. Partners maintain it.
        </p>
      </div>
      <div className="banner warn">
        This is a place to record the firm’s system. It does not design one. The starter risks, version {QUALITY_VERSION}, are examples to tailor: the standard asks each firm to identify its own risks from its own circumstances.
      </div>
      <ErrorNote error={actionError} />

      <div className="row" style={{ gap: 28 }}>
        <div><div className="stat">{risks.length}</div><div className="small muted">quality risks</div></div>
        <div><div className="stat" style={{ color: needResponse.length ? 'var(--warn)' : undefined }}>{needResponse.length}</div><div className="small muted">with no response in place</div></div>
        <div><div className="stat">{openFindings.length}</div><div className="small muted">open findings</div></div>
        <div><div className="stat" style={{ color: overdue.length ? 'var(--bad)' : undefined }}>{overdue.length}</div><div className="small muted">actions overdue</div></div>
        <div>
          <div className="stat" style={{ fontSize: 20, lineHeight: '34px', color: evaluationDue ? 'var(--bad)' : undefined }}>{last ? longDate(last.asAt) : 'Never'}</div>
          <div className="small muted">last evaluation{evaluationDue ? ', now due' : ''}</div>
        </div>
      </div>

      <section className="card stack" aria-label="Quality risks and responses">
        <div className="between">
          <h3>Quality risks and responses</h3>
          {partner && missing.length > 0 && (
            <button
              disabled={busy}
              onClick={() => void act(() => repo.addQuality(missing.map((m) => ({ ...m, kind: 'risk', owner: '', status: 'open', severity: null, dueDate: null }))))}
            >
              Add the starter risks ({missing.length})
            </button>
          )}
        </div>
        {risks.length === 0 && <span className="muted">No risks recorded yet.</span>}
        {COMPONENTS.map((c) => {
          const rows = risks.filter((r) => r.component === c.id);
          if (rows.length === 0) return null;
          return (
            <div key={c.id}>
              <h4 className="small" style={{ margin: '6px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>{c.label}</h4>
              {rows.map((r) => (
                <ItemRow key={r.id} item={r} partner={partner} busy={busy} act={act} />
              ))}
            </div>
          );
        })}
        {partner && <NewItem kind="risk" busy={busy} act={act} />}
      </section>

      <section className="card stack" aria-label="Monitoring findings">
        <h3>Monitoring findings and remediation</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Record what file inspections, regulator reviews, complaints and your own monitoring find, with the root cause and the action. A finding is closed when the action is done. It is never removed.
        </p>
        {findings.length === 0 && <span className="muted">No findings recorded yet.</span>}
        {[...openFindings, ...findings.filter((f) => f.status === 'closed')].map((f) => (
          <ItemRow key={f.id} item={f} partner={partner} busy={busy} act={act} />
        ))}
        {partner && <NewItem kind="finding" busy={busy} act={act} />}
      </section>

      <section className="card stack" aria-label="Evaluation of the system">
        <h3>Evaluation of the system</h3>
        <p className="small muted" style={{ margin: 0 }}>
          The partner with ultimate responsibility evaluates the system at least once a year and records the conclusion. A recorded evaluation cannot be changed.
        </p>
        {data.evaluations.length === 0 ? (
          <span className="muted">No evaluation recorded yet.</span>
        ) : (
          data.evaluations.map((e) => (
            <div className="journal" key={e.id}>
              <div className="between">
                <strong>As at {longDate(e.asAt)}</strong>
                <span className={`tag ${CONCLUSION_SHORT[e.conclusion][1]}`}>{CONCLUSION_SHORT[e.conclusion][0]}</span>
              </div>
              <div className="small">{CONCLUSIONS[e.conclusion]}</div>
              <div className="small" style={{ marginTop: 4 }}>Basis: {e.basis}</div>
              <div className="small muted">Concluded by {e.concludedByName || 'a partner'}, recorded {new Date(e.createdAt).toLocaleDateString('en-GB')}</div>
            </div>
          ))
        )}
        {partner && <NewEvaluation busy={busy} act={act} open={openFindings} />}
      </section>

      <section className="card stack" aria-label="Engagements">
        <h3>Engagements</h3>
        {data.engagements.length === 0 ? (
          <span className="muted">No engagements yet.</span>
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Year end</th>
                  <th>Type</th>
                  <th>Programme</th>
                  <th>Independence</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.engagements.map((e) => {
                  const steps = programmeFor(e.type, e.planning);
                  const done = steps.filter((s) => e.programme[s.id]?.done).length;
                  const confirmed = Object.keys(e.planning.independence ?? {}).length;
                  return (
                    <tr key={e.id}>
                      <td><Link to={`/engagements/${e.id}`}>{clientName(e.clientId)}</Link></td>
                      <td className="small">{longDate(e.yearEnd)}</td>
                      <td className="small" style={{ textTransform: 'capitalize' }}>{e.type}</td>
                      <td className="small">{done} of {steps.length}</td>
                      <td>
                        <span className={`tag ${confirmed ? 'ok' : 'warn'}`}>{confirmed ? `${confirmed} confirmed` : 'None confirmed'}</span>
                      </td>
                      <td>
                        {e.status === 'locked' ? (
                          <span className="tag ok">Signed {new Date(e.signedAt ?? '').toLocaleDateString('en-GB')}</span>
                        ) : (
                          <span className="tag">In progress</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type Act = (fn: () => Promise<void>) => Promise<void>;

function ItemRow({ item, partner, busy, act }: { item: QualityItem; partner: boolean; busy: boolean; act: Act }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ detail: item.detail, response: item.response, owner: item.owner, dueDate: item.dueDate ?? '' });
  const risk = item.kind === 'risk';
  const late = !risk && item.status === 'open' && item.dueDate && item.dueDate < today();
  const tag: [string, string] = risk
    ? item.status === 'in_place' ? ['Response in place', 'ok'] : ['Response needed', 'warn']
    : item.status === 'closed' ? ['Closed', 'ok'] : ['Open', 'warn'];

  return (
    <div className="journal quality-item">
      <div className="between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <strong>{item.title}</strong>
        <span className="row" style={{ gap: 6 }}>
          {!risk && <span className={`tag ${item.severity === 'finding' ? '' : 'bad'}`}>{SEVERITY_LABEL[item.severity ?? ''] ?? item.severity}</span>}
          {late && <span className="tag bad">Overdue</span>}
          <span className={`tag ${tag[1]}`}>{tag[0]}</span>
        </span>
      </div>
      {!editing ? (
        <>
          {!risk && <div className="small muted">{COMPONENT_LABEL[item.component as Component] ?? item.component}</div>}
          {item.detail && <div className="small">{risk ? 'Risk' : 'Finding and root cause'}: {item.detail}</div>}
          <div className="small">{risk ? 'Response' : 'Action'}: {item.response || <span className="muted">none recorded</span>}</div>
          <div className="small muted">
            {item.owner ? `Owner: ${item.owner}` : 'No owner'}
            {item.dueDate && ` · Due ${longDate(item.dueDate)}`}
          </div>
        </>
      ) : (
        <div className="stack" style={{ gap: 8, marginTop: 8 }}>
          <Field label={risk ? 'What could go wrong' : 'Finding and root cause'}>
            <textarea rows={2} value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
          </Field>
          <Field label={risk ? 'The firm’s response' : 'Remedial action'}>
            <textarea rows={2} value={f.response} onChange={(e) => setF({ ...f, response: e.target.value })} />
          </Field>
          <div className="grid2">
            <Field label="Owner">
              <input type="text" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} />
            </Field>
            <Field label={risk ? 'Next review' : 'Action due'}>
              <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </Field>
          </div>
        </div>
      )}
      {partner && (
        <div className="row" style={{ marginTop: 8 }}>
          {editing ? (
            <>
              <button
                className="primary"
                disabled={busy}
                aria-label={`Save ${item.title}`}
                onClick={() =>
                  void act(async () => {
                    await repo.updateQuality(item.id, { detail: f.detail.trim(), response: f.response.trim(), owner: f.owner.trim(), dueDate: f.dueDate || null });
                    setEditing(false);
                  })
                }
              >
                Save
              </button>
              <button onClick={() => setEditing(false)}>Cancel</button>
            </>
          ) : (
            <>
              <button aria-label={`Edit ${item.title}`} onClick={() => setEditing(true)}>Edit</button>
              {risk ? (
                <button
                  disabled={busy || (item.status === 'open' && !item.response.trim())}
                  title={item.status === 'open' && !item.response.trim() ? 'Record the response first' : undefined}
                  aria-label={`${item.status === 'open' ? 'Mark the response in place for' : 'Mark as needing a response:'} ${item.title}`}
                  onClick={() => void act(() => repo.updateQuality(item.id, { status: item.status === 'open' ? 'in_place' : 'open' }))}
                >
                  {item.status === 'open' ? 'Response is in place' : 'Response needs work'}
                </button>
              ) : (
                <button
                  disabled={busy || (item.status === 'open' && !item.response.trim())}
                  title={item.status === 'open' && !item.response.trim() ? 'Record the action first' : undefined}
                  aria-label={`${item.status === 'open' ? 'Close' : 'Reopen'} ${item.title}`}
                  onClick={() => void act(() => repo.updateQuality(item.id, { status: item.status === 'open' ? 'closed' : 'open' }))}
                >
                  {item.status === 'open' ? 'Close: action done' : 'Reopen'}
                </button>
              )}
              {risk && (
                <button className="link danger" disabled={busy} aria-label={`Remove ${item.title}`} onClick={() => void act(() => repo.deleteQuality(item.id))}>
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NewItem({ kind, busy, act }: { kind: 'risk' | 'finding'; busy: boolean; act: Act }) {
  const blank = { component: 'performance' as Component, title: '', detail: '', response: '', owner: '', dueDate: '', severity: 'deficiency' };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [problem, setProblem] = useState<string | null>(null);
  const risk = kind === 'risk';
  if (!open) return <div><button onClick={() => setOpen(true)}>{risk ? 'Add a risk' : 'Record a finding'}</button></div>;
  return (
    <div className="stack" style={{ borderTop: '1px solid var(--rule)', paddingTop: 14 }}>
      <div className="grid2">
        <Field label={risk ? 'Risk' : 'Finding'}>
          <input type="text" maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Component">
          <select value={f.component} onChange={(e) => setF({ ...f, component: e.target.value as Component })}>
            {COMPONENTS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={risk ? 'What could go wrong' : 'What was found, and its root cause'}>
        <textarea rows={2} value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
      </Field>
      <Field label={risk ? 'The firm’s response' : 'Remedial action'}>
        <textarea rows={2} value={f.response} onChange={(e) => setF({ ...f, response: e.target.value })} />
      </Field>
      <div className="grid2">
        <Field label="Owner">
          <input type="text" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} />
        </Field>
        {risk ? (
          <Field label="Next review">
            <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </Field>
        ) : (
          <div className="grid2">
            <Field label="Severity">
              <select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>
                {SEVERITIES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Action due">
              <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </Field>
          </div>
        )}
      </div>
      <ErrorNote error={problem} />
      <div className="row">
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            if (!f.title.trim()) return setProblem(risk ? 'Name the risk.' : 'Say what was found.');
            setProblem(null);
            const item: QualityDraft = { kind, component: f.component, title: f.title, detail: f.detail, response: f.response, owner: f.owner, status: 'open', severity: risk ? null : f.severity, dueDate: f.dueDate || null };
            void act(async () => {
              await repo.addQuality([item]);
              setF(blank);
              setOpen(false);
            });
          }}
        >
          {risk ? 'Save risk' : 'Save finding'}
        </button>
        <button onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function NewEvaluation({ busy, act, open }: { busy: boolean; act: Act; open: QualityItem[] }) {
  const [f, setF] = useState({ asAt: today(), conclusion: '' as Conclusion | '', basis: '' });
  const [confirm, setConfirm] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const severe = open.filter((x) => x.severity === 'severe' || x.severity === 'pervasive');
  return (
    <div className="stack" style={{ borderTop: '1px solid var(--rule)', paddingTop: 14 }}>
      <strong>Record an evaluation</strong>
      {severe.length > 0 && (
        <div className="banner warn">
          {severe.length} severe deficienc{severe.length === 1 ? 'y is' : 'ies are'} open: {severe.map((x) => x.title).join('; ')}. Consider what that means for the conclusion.
        </div>
      )}
      <div className="grid2" style={{ gridTemplateColumns: '200px 1fr' }}>
        <Field label="Evaluated as at">
          <input type="date" value={f.asAt} max={today()} onChange={(e) => setF({ ...f, asAt: e.target.value })} />
        </Field>
        <Field label="Conclusion">
          <select value={f.conclusion} onChange={(e) => setF({ ...f, conclusion: e.target.value as Conclusion })}>
            <option value="">Choose the conclusion</option>
            {(Object.keys(CONCLUSIONS) as Conclusion[]).map((c) => (
              <option key={c} value={c}>{CONCLUSIONS[c]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Basis for the conclusion">
        <textarea rows={3} value={f.basis} placeholder="What monitoring was done, what it found, and why the conclusion follows" onChange={(e) => setF({ ...f, basis: e.target.value })} />
      </Field>
      <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ marginTop: 4 }} />
        <span>I hold ultimate responsibility for the firm’s system of quality management, and this is my conclusion. I understand it cannot be changed once recorded.</span>
      </label>
      <ErrorNote error={problem} />
      <div>
        <button
          className="primary"
          disabled={busy || !confirm}
          onClick={() => {
            if (!f.conclusion) return setProblem('Choose the conclusion. The software does not choose it for you.');
            if (!f.basis.trim()) return setProblem('Give the basis for the conclusion.');
            if (!f.asAt || f.asAt > today()) return setProblem('The date cannot be in the future.');
            setProblem(null);
            const e = { asAt: f.asAt, conclusion: f.conclusion, basis: f.basis };
            void act(async () => {
              await repo.addEvaluation(e);
              setF({ asAt: today(), conclusion: '', basis: '' });
              setConfirm(false);
            });
          }}
        >
          Record evaluation
        </button>
      </div>
    </div>
  );
}

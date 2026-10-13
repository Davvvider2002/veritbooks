import { useState } from 'react';
import { repo } from '../data';
import { longDate } from '../engine/report';
import type { ManagementLetter, ManagementPoint } from '../engine/types';
import { ErrorNote, Field, useAction } from '../ui';
import type { Ctx } from '../workspace';
import { BrandedHead, PageFoot } from './branding';

const PRIORITY = { high: 'High', medium: 'Medium', low: 'Low' } as const;
const STATUS = { open: 'Awaiting response', agreed: 'Agreed with management', resolved: 'Resolved' } as const;
const blank = (): ManagementPoint => ({ id: Math.random().toString(36).slice(2, 10), title: '', observation: '', implication: '', recommendation: '', response: '', priority: 'medium', status: 'open' });

/** The letter to management: control weaknesses and other matters found in the work, with the client's responses. */
export function ManagementStep(ctx: Ctx) {
  const { eng, client, ws, locked, reload } = ctx;
  const letter: ManagementLetter = eng.testing.managementLetter ?? { points: [] };
  const [editing, setEditing] = useState<ManagementPoint | null>(null);
  const [meta, setMeta] = useState({ addressee: letter.addressee ?? '', date: letter.date ?? '' });
  const { busy, error, run } = useAction();
  const save = (next: ManagementLetter) =>
    run(async () => {
      await repo.updateEngagement(eng.id, { testing: { ...eng.testing, managementLetter: next } });
      setEditing(null);
      reload();
    });
  const points = letter.points;
  const set = (patch: Partial<ManagementPoint>) => setEditing(editing && { ...editing, ...patch });
  const word = eng.type === 'audit' ? 'audit' : 'review';

  return (
    <div>
      <div className="stack no-print" style={{ marginBottom: 20 }}>
        <div className="between">
          <h2>Management letter</h2>
          <button onClick={() => window.print()} disabled={!points.length}>
            Print or save as PDF
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Record the weaknesses in internal control and other matters found during the {word}, what they could lead to, what you recommend, and management’s response. The letter below is drafted from them.
        </p>
        <ErrorNote error={error} />

        {points.length > 0 && (
          <div className="card">
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Matter</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>{p.title}</td>
                    <td>{PRIORITY[p.priority]}</td>
                    <td>
                      <span className={`tag ${p.status === 'resolved' ? 'ok' : p.status === 'open' ? 'warn' : ''}`}>{STATUS[p.status]}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!locked && (
                        <span className="row" style={{ gap: 14, justifyContent: 'flex-end' }}>
                          <button className="link" onClick={() => setEditing(p)}>
                            Edit
                          </button>
                          <button className="link danger" disabled={busy} onClick={() => void save({ ...letter, points: points.filter((x) => x.id !== p.id) })}>
                            Remove
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!locked && !editing && (
          <div className="row">
            <button className="primary" onClick={() => setEditing(blank())}>
              Add a matter
            </button>
          </div>
        )}

        {editing && (
          <form
            className="card stack"
            aria-label="Management letter point"
            onSubmit={(e) => {
              e.preventDefault();
              const exists = points.some((p) => p.id === editing.id);
              void save({ ...letter, points: exists ? points.map((p) => (p.id === editing.id ? editing : p)) : [...points, editing] });
            }}
          >
            <Field label="Matter">
              <input type="text" required value={editing.title} placeholder="For example: Bank reconciliations not reviewed" onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <div className="grid2">
              <Field label="Priority">
                <select value={editing.priority} onChange={(e) => set({ priority: e.target.value as ManagementPoint['priority'] })}>
                  {Object.entries(PRIORITY).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={editing.status} onChange={(e) => set({ status: e.target.value as ManagementPoint['status'] })}>
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Observation">
              <textarea required rows={3} value={editing.observation} onChange={(e) => set({ observation: e.target.value })} />
            </Field>
            <Field label="Implication">
              <textarea rows={2} value={editing.implication} onChange={(e) => set({ implication: e.target.value })} />
            </Field>
            <Field label="Recommendation">
              <textarea required rows={2} value={editing.recommendation} onChange={(e) => set({ recommendation: e.target.value })} />
            </Field>
            <Field label="Management’s response" hint="Leave blank until management has replied.">
              <textarea rows={2} value={editing.response} onChange={(e) => set({ response: e.target.value })} />
            </Field>
            <div className="row">
              <button className="primary" disabled={busy}>
                Save matter
              </button>
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {!locked && (
          <div className="card stack">
            <h3>Letter details</h3>
            <div className="grid2">
              <Field label="Addressed to" hint="For example: The Board of Directors">
                <input type="text" value={meta.addressee} onChange={(e) => setMeta({ ...meta, addressee: e.target.value })} />
              </Field>
              <Field label="Date of the letter">
                <input type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
              </Field>
            </div>
            <div>
              <button disabled={busy} onClick={() => void save({ ...letter, ...meta })}>
                Save letter details
              </button>
            </div>
          </div>
        )}
      </div>

      {points.length > 0 && (
        <section className={`sheet ${ws.firm.branding.font === 'sans' ? 'sans' : ''}`}>
          <BrandedHead ctx={ctx} />
          <p>{letter.date ? longDate(letter.date) : '[Date]'}</p>
          <p>
            {letter.addressee || 'The Board of Directors'}
            <br />
            {client.name}
          </p>
          <p>Dear Sirs,</p>
          <h2 style={{ marginBottom: 14 }}>
            Report to management for the year ended {longDate(eng.yearEnd)}
          </h2>
          <p>
            In the course of our {word} of the financial statements of {client.name} for the year ended {longDate(eng.yearEnd)}, we noted the matters set out below. We bring them to your attention with our recommendations.
          </p>
          <p>
            Our {word} was not designed to identify every weakness in internal control, so this letter does not list all the weaknesses that may exist. It is written for the board and management of the company and should not be given to anyone else without our consent.
          </p>
          {points.map((p, i) => (
            <div key={p.id} className="ml-point">
              <h3>
                {i + 1}. {p.title} <span className="small">({PRIORITY[p.priority]} priority)</span>
              </h3>
              <p>
                <strong>Observation.</strong> {p.observation}
              </p>
              {p.implication && (
                <p>
                  <strong>Implication.</strong> {p.implication}
                </p>
              )}
              <p>
                <strong>Recommendation.</strong> {p.recommendation}
              </p>
              <p>
                <strong>Management’s response.</strong> {p.response || '[Awaiting management’s response]'}
              </p>
            </div>
          ))}
          <p>We thank the directors and staff for their help during the {word}. We would be glad to discuss any of these matters.</p>
          <p>
            Yours faithfully,
            <br />
            <br />
            For: {ws.firm.name}
          </p>
          <PageFoot ctx={ctx} />
        </section>
      )}
    </div>
  );
}

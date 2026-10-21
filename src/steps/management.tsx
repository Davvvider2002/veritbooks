import { useState } from 'react';
import { repo } from '../data';
import { longDate } from '../engine/report';
import type { LetterPart, ManagementLetter, ManagementPoint } from '../engine/types';
import { LETTER_PARTS, letterText } from '../content/managementLetter';
import type { Evidence } from '../data/repo';
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
  const fill = { client: client.name, yearEnd: longDate(eng.yearEnd), work: word, firm: ws.firm.name };
  const t = (key: LetterPart) => letterText(key, letter.wording, fill);
  const own = letter.ownLetter ? ctx.evidence.find((e) => e.id === letter.ownLetter!.evidenceId) ?? null : null;

  return (
    <div>
      <div className="stack no-print" style={{ marginBottom: 20 }}>
        <div className="between">
          <h2>Management letter</h2>
          <button onClick={() => window.print()} disabled={!points.length || !!letter.ownLetter}>
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

      {!locked && <LetterWording letter={letter} save={save} busy={busy} fill={fill} />}
      {(!locked || letter.ownLetter) && <OwnLetter ctx={ctx} letter={letter} own={own} save={save} />}

      {points.length > 0 && !letter.ownLetter && (
        <section className={`sheet ${ws.firm.branding.font === 'sans' ? 'sans' : ''}`}>
          <BrandedHead ctx={ctx} />
          <p>{letter.date ? longDate(letter.date) : '[Date]'}</p>
          <p>
            {letter.addressee || 'The Board of Directors'}
            <br />
            {client.name}
          </p>
          <p>{t('salutation')}</p>
          <h2 style={{ marginBottom: 14 }}>
            {t('title')}
          </h2>
          <p>{t('intro')}</p>
          <p>{t('limitation')}</p>
          {points.map((p, i) => (
            <div key={p.id} className="ml-point">
              <h3>
                {i + 1}. {p.title} <span className="small">({PRIORITY[p.priority]} priority)</span>
              </h3>
              <p>
                <strong>{t('observation')}</strong> {p.observation}
              </p>
              {p.implication && (
                <p>
                  <strong>{t('implication')}</strong> {p.implication}
                </p>
              )}
              <p>
                <strong>{t('recommendation')}</strong> {p.recommendation}
              </p>
              <p>
                <strong>{t('response')}</strong> {p.response || t('awaiting')}
              </p>
            </div>
          ))}
          <p>{t('closing')}</p>
          <p>
            {t('signoff')}
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

/** Every part of the letter's wording, editable. A part left as it is prints the standard wording. */
function LetterWording({ letter, save, busy, fill }: { letter: ManagementLetter; save: (l: ManagementLetter) => Promise<void>; busy: boolean; fill: { client: string; yearEnd: string; work: string; firm: string } }) {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState<Partial<Record<LetterPart, string>>>(() => Object.fromEntries(LETTER_PARTS.map((p) => [p.key, letter.wording?.[p.key] ?? p.standard])));
  const changed = LETTER_PARTS.filter((p) => (letter.wording?.[p.key] ?? '').trim() && letter.wording?.[p.key] !== p.standard).length;
  return (
    <div className="card stack no-print" aria-label="Wording of the letter">
      <div className="between">
        <h3 style={{ margin: 0 }}>Wording of the letter</h3>
        <button className="link" onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Edit the wording'}
        </button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {changed ? `${changed} part${changed === 1 ? '' : 's'} in your firm’s own words. ` : 'The standard wording is in use. '}
        Change any part to suit your firm or this client. {'{client}'}, {'{year end}'}, {'{work}'} and {'{firm}'} are filled in when the letter prints, for example {fill.client} and {fill.yearEnd}.
      </p>
      {open && (
        <>
          {LETTER_PARTS.map((p) => (
            <Field key={p.key} label={p.label}>
              {p.rows > 1 ? (
                <textarea rows={p.rows} value={w[p.key] ?? ''} onChange={(e) => setW({ ...w, [p.key]: e.target.value })} />
              ) : (
                <input type="text" value={w[p.key] ?? ''} onChange={(e) => setW({ ...w, [p.key]: e.target.value })} />
              )}
            </Field>
          ))}
          <div className="row">
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                // Only the parts that differ from the standard are kept, so later improvements to the standard still reach the rest.
                const wording = Object.fromEntries(LETTER_PARTS.filter((p) => (w[p.key] ?? '').trim() && w[p.key] !== p.standard).map((p) => [p.key, w[p.key]!]));
                void save({ ...letter, wording });
              }}
            >
              Save wording
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setW(Object.fromEntries(LETTER_PARTS.map((p) => [p.key, p.standard])));
                void save({ ...letter, wording: {} });
              }}
            >
              Restore the standard wording
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** A letter the firm wrote itself, uploaded and issued in place of the drafted one. */
function OwnLetter({ ctx, letter, own, save }: { ctx: Ctx; letter: ManagementLetter; own: Evidence | null; save: (l: ManagementLetter) => Promise<void> }) {
  const { eng, ws, locked, reload } = ctx;
  const [file, setFile] = useState<File | null>(null);
  const { busy, error, run } = useAction();
  return (
    <div className="card stack no-print" aria-label="Your own letter">
      <h3 style={{ margin: 0 }}>Your own letter</h3>
      {letter.ownLetter ? (
        <>
          <div className="banner info">
            The letter issued is your firm’s own: <strong>{letter.ownLetter.fileName}</strong>, uploaded by {letter.ownLetter.by} on {new Date(letter.ownLetter.at).toLocaleDateString('en-GB')}. The drafted letter below is set aside. The matters above stay on file.
          </div>
          <div className="row">
            {own && (
              <button disabled={busy} onClick={() => void run(async () => void window.open(await repo.evidenceUrl(own), '_blank', 'noopener'))}>
                Open the letter
              </button>
            )}
            {!locked && (
              <button className="link" disabled={busy} onClick={() => void run(() => save({ ...letter, ownLetter: undefined }))}>
                Go back to the drafted letter
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          Prefer your firm’s own letter? Upload it, in Word or PDF, and it is issued in place of the drafted one and kept with the file under Evidence.
        </p>
      )}
      {!locked && (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input type="file" aria-label="Your own management letter" accept=".pdf,.doc,.docx,.odt,.rtf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button
            disabled={busy || !file}
            onClick={() =>
              void run(async () => {
                const by = ws.me.fullName || 'The audit team';
                await repo.addEvidence(eng.id, file!, { refType: 'general', refId: '', note: 'Management letter, as issued', uploadedByName: by });
                const list = await repo.listEvidence(eng.id);
                const added = list.filter((e) => e.fileName === file!.name).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                await save({ ...letter, ownLetter: { evidenceId: added?.id ?? '', fileName: file!.name, by, at: new Date().toISOString() } });
                setFile(null);
                reload();
              })
            }
          >
            {letter.ownLetter ? 'Replace the letter' : 'Upload and use this letter'}
          </button>
        </div>
      )}
      <ErrorNote error={error} />
    </div>
  );
}

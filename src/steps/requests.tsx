import { useState } from 'react';
import { packOf, requestsFor } from '../content/packs';
import { repo } from '../data';
import type { ClientRequest, RequestStatus } from '../data/repo';
import { longDate } from '../engine/report';
import { ErrorNote, Field, useAction, useLoad } from '../ui';
import type { Ctx } from '../workspace';

export const STATUS_LABEL: Record<RequestStatus, string> = {
  open: 'Waiting for the client',
  received: 'Received, to review',
  accepted: 'Accepted',
  returned: 'Returned to the client',
};
export const STATUS_TAG: Record<RequestStatus, string> = { open: '', received: 'warn', accepted: 'ok', returned: 'bad' };

const today = () => new Date().toISOString().slice(0, 10);

export function RequestsStep({ eng, client, requests, requestsReady, evidence, locked, reload }: Ctx) {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [due, setDue] = useState('');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(14);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { busy, error, run, setError } = useAction();
  const links = useLoad(() => (requestsReady ? repo.listLinks(eng.id) : Promise.resolve([])), [eng.id, requestsReady]);

  const act = (fn: () => Promise<void>) =>
    void run(async () => {
      await fn();
      reload();
    });
  const filesFor = (r: ClientRequest) => evidence.filter((e) => e.refType === 'request' && e.refId === r.id);
  const missing = requestsFor(eng.planning).filter((s) => !requests.some((r) => r.title === s.title));
  const count = (s: RequestStatus) => requests.filter((r) => r.status === s).length;

  if (!requestsReady)
    return (
      <div className="stack">
        <h2>Client requests</h2>
        <div className="banner warn">
          Client requests need a database update. Run <code>supabase/migrations/0005_client_requests.sql</code> in the Supabase SQL editor, then reload this page.
        </div>
      </div>
    );

  return (
    <div className="stack">
      <div>
        <h2>Client requests</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          List what you need from {client.name}, then send them an upload link. They need no account. Every file they send lands here, against the item it answers, and in Evidence. You decide whether it is what you asked for.
        </p>
      </div>
      {repo.mode === 'demo' && (
        <div className="banner warn">Demo mode: an upload link only works in this browser, and file contents are kept only until the page is reloaded.</div>
      )}
      <ErrorNote error={error} />

      {requests.length > 0 && (
        <div className="row">
          <span className="tag">{count('open')} waiting</span>
          <span className={`tag ${count('received') ? 'warn' : ''}`}>{count('received')} to review</span>
          <span className={`tag ${count('returned') ? 'bad' : ''}`}>{count('returned')} returned</span>
          <span className="tag ok">{count('accepted')} accepted</span>
        </div>
      )}

      {!locked && (
        <div className="card stack">
          <h3>Add a request</h3>
          <div className="grid2">
            <Field label="What you need">
              <input type="text" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Needed by">
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
          <Field label="Details for the client">
            <input type="text" value={detail} maxLength={1000} placeholder="Period, format, which accounts" onChange={(e) => setDetail(e.target.value)} />
          </Field>
          <div className="row">
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                if (!title.trim()) return setError('Say what you need.');
                act(async () => {
                  await repo.addRequests(eng.id, [{ title, detail, dueDate: due || null }]);
                  setTitle('');
                  setDetail('');
                });
              }}
            >
              Add request
            </button>
            {missing.length > 0 && (
              <button
                disabled={busy}
                onClick={() => act(() => repo.addRequests(eng.id, missing.map((m) => ({ ...m, dueDate: due || null }))))}
              >
                Add the standard list ({missing.length})
              </button>
            )}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            The standard list is a starting point{packOf(eng.planning) ? `, and includes the ${packOf(eng.planning)!.name.toLowerCase()} pack` : ''}. Remove what does not apply and add what this client needs.
          </p>
        </div>
      )}

      <div className="card">
        {requests.length === 0 ? (
          <span className="muted">No requests yet.</span>
        ) : (
          requests.map((r) => {
            const files = filesFor(r);
            const late = r.dueDate && r.dueDate < today() && (r.status === 'open' || r.status === 'returned');
            return (
              <div className="journal request" key={r.id}>
                <div className="between">
                  <strong>{r.title}</strong>
                  <span className="row">
                    {late && <span className="tag bad">Overdue</span>}
                    <span className={`tag ${STATUS_TAG[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </span>
                </div>
                <div className="small muted">
                  {r.detail}
                  {r.dueDate && ` Needed by ${longDate(r.dueDate)}.`}
                </div>
                {r.status === 'returned' && r.note && <div className="small">Returned with: {r.note}</div>}
                {files.length > 0 && (
                  <ul className="small files">
                    {files.map((f) => (
                      <li key={f.id}>
                        <button className="link" onClick={() => void run(async () => void window.open(await repo.evidenceUrl(f), '_blank', 'noopener'))}>
                          {f.fileName}
                        </button>{' '}
                        <span className="muted">
                          from {f.uploadedByName || 'the client'}, {new Date(f.createdAt).toLocaleDateString('en-GB')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {!locked && (
                  <div className="row" style={{ marginTop: 8 }}>
                    {r.status !== 'accepted' && (
                      <button disabled={busy} onClick={() => act(() => repo.updateRequest(r.id, { status: 'accepted', note: '' }))}>
                        Accept
                      </button>
                    )}
                    {r.status === 'accepted' && (
                      <button disabled={busy} onClick={() => act(() => repo.updateRequest(r.id, { status: files.length ? 'received' : 'open' }))}>
                        Reopen
                      </button>
                    )}
                    {r.status === 'received' && (
                      <>
                        <input
                          type="text"
                          aria-label={`Reason for returning ${r.title}`}
                          placeholder="What is wrong or missing"
                          style={{ flex: 1, minWidth: 180 }}
                          maxLength={1000}
                          value={notes[r.id] ?? ''}
                          onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                        />
                        <button
                          disabled={busy}
                          onClick={() => {
                            const note = (notes[r.id] ?? '').trim();
                            if (!note) return setError('Tell the client what is wrong or missing before returning it.');
                            act(() => repo.updateRequest(r.id, { status: 'returned', note }));
                          }}
                        >
                          Return to client
                        </button>
                      </>
                    )}
                    {files.length === 0 && (
                      <button className="link danger" disabled={busy} onClick={() => act(() => repo.deleteRequest(r.id))}>
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="card stack">
        <h3>Upload links</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Anyone holding a link can see this request list and send files. They cannot open, download or remove anything. Send each link only to the person named on it, and withdraw it when you are done. Links stop working when the file is signed.
        </p>
        {!locked && (
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Field label="Who the link is for">
              <input type="text" value={label} maxLength={120} placeholder="Name and role at the client" onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <Field label="Valid for">
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </Field>
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                if (!label.trim()) return setError('Name the person the link is for.');
                void run(async () => {
                  const token = await repo.createLink(eng.id, label, days);
                  setFresh(`${window.location.origin}/r/${token}`);
                  setCopied(false);
                  setLabel('');
                  links.reload();
                });
              }}
            >
              Create link
            </button>
          </div>
        )}
        {fresh && (
          <div className="banner info">
            <strong>Copy this link now. It will not be shown again.</strong>
            <div className="row" style={{ marginTop: 8 }}>
              <input type="text" readOnly aria-label="New upload link" value={fresh} style={{ flex: 1, minWidth: 200 }} onFocus={(e) => e.target.select()} />
              <button
                onClick={() =>
                  void navigator.clipboard.writeText(fresh).then(
                    () => setCopied(true),
                    () => setError('Could not copy. Select the link and copy it yourself.'),
                  )
                }
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
        <ErrorNote error={links.error} />
        {(links.data ?? []).length > 0 && (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>For</th>
                  <th>Expires</th>
                  <th>Last opened</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(links.data ?? []).map((l) => {
                  const dead = l.revoked || l.expiresAt < new Date().toISOString();
                  return (
                    <tr key={l.id}>
                      <td>{l.label}</td>
                      <td className="small">{new Date(l.expiresAt).toLocaleDateString('en-GB')}</td>
                      <td className="small">{l.lastUsedAt ? new Date(l.lastUsedAt).toLocaleString('en-GB') : 'Never'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {l.revoked ? (
                          <span className="tag">Withdrawn</span>
                        ) : dead ? (
                          <span className="tag">Expired</span>
                        ) : locked ? (
                          <span className="tag">Closed</span>
                        ) : (
                          <button
                            className="link danger"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await repo.revokeLink(l.id);
                                links.reload();
                              })
                            }
                          >
                            Withdraw
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

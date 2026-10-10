import { useState } from 'react';
import { repo } from './data';
import { MAX_EVIDENCE_BYTES, type PortalView } from './data/repo';
import { longDate } from './engine/report';
import { ErrorNote, message, useLoad } from './ui';

const CLIENT_STATUS = {
  open: ['Needed', ''],
  received: ['Sent, being reviewed', 'warn'],
  accepted: ['Accepted', 'ok'],
  returned: ['Please send again', 'bad'],
} as const;

/** The client's page. Reached by an upload link, with no sign-in. */
export function PortalPage({ token }: { token: string }) {
  const { data, error, reload } = useLoad(() => repo.portalView(token), [token]);

  if (error) return <div className="page"><ErrorNote error={`This page could not be loaded: ${error}`} /></div>;
  if (data === undefined) return <div className="page muted">Loading…</div>;
  if (data === null)
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <h1>This link does not work</h1>
        <p>It may have expired or been withdrawn. Ask your auditor for a new one.</p>
      </div>
    );

  const left = data.requests.filter((r) => r.status === 'open' || r.status === 'returned').length;
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="small muted">Documents requested by {data.firm}</div>
      <h1 style={{ marginTop: 4 }}>{data.client}</h1>
      <p className="muted">
        For the year ended {longDate(data.yearEnd)}. Send each document against the item it answers. Only {data.firm} can open what you send. You can send more than one file for an item.
      </p>
      {data.closed ? (
        <div className="banner info">This file has been closed. Nothing more can be sent through this link.</div>
      ) : data.requests.length === 0 ? (
        <div className="banner info">Nothing has been requested yet.</div>
      ) : (
        <div className={`banner ${left ? 'warn' : 'info'}`}>
          {left ? `${left} of ${data.requests.length} item(s) still needed.` : 'Everything on the list has been sent. Thank you.'}
        </div>
      )}
      <div className="stack" style={{ marginTop: 16 }}>
        {data.requests.map((r) => (
          <PortalItem key={r.id} token={token} view={data} request={r} onSent={reload} />
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 24 }}>
        Do not forward this link. Anyone who has it can send files in your company’s name.
      </p>
    </div>
  );
}

function PortalItem({ token, view, request: r, onSent }: { token: string; view: PortalView; request: PortalView['requests'][number]; onSent: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [key, setKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(0);
  const [text, cls] = CLIENT_STATUS[r.status];

  const send = async () => {
    const big = files.find((f) => f.size > MAX_EVIDENCE_BYTES);
    if (big) return setError(`${big.name} is larger than 25 MB.`);
    setBusy(true);
    setError(null);
    let done = 0;
    try {
      for (const f of files) {
        await repo.portalUpload(token, view, r.id, f);
        done++;
      }
      setFiles([]);
      setKey((k) => k + 1);
    } catch (e) {
      setError(`${done} of ${files.length} file(s) sent. ${message(e)}`);
    } finally {
      setSent(done);
      setBusy(false);
      if (done) onSent();
    }
  };

  return (
    <section className="card stack" aria-label={r.title}>
      <div className="between">
        <h3>{r.title}</h3>
        <span className={`tag ${cls}`}>{text}</span>
      </div>
      {(r.detail || r.dueDate) && (
        <div className="small muted">
          {r.detail}
          {r.dueDate && ` Needed by ${longDate(r.dueDate)}.`}
        </div>
      )}
      {r.status === 'returned' && r.note && <div className="banner bad">Your auditor says: {r.note}</div>}
      {r.files.length > 0 && (
        <ul className="small files">
          {r.files.map((f, i) => (
            <li key={i}>
              {f.name} <span className="muted">sent {new Date(f.at).toLocaleDateString('en-GB')}</span>
            </li>
          ))}
        </ul>
      )}
      {!view.closed && r.status !== 'accepted' && (
        <div className="row">
          <input
            key={key}
            type="file"
            multiple
            aria-label={`Files for ${r.title}`}
            onChange={(e) => {
              setFiles([...(e.target.files ?? [])]);
              setSent(0);
            }}
            style={{ padding: '6px 0', flex: 1, minWidth: 200 }}
          />
          <button className="primary" disabled={busy || files.length === 0} onClick={() => void send()}>
            {busy ? 'Sending…' : files.length > 1 ? `Send ${files.length} files` : 'Send'}
          </button>
        </div>
      )}
      {sent > 0 && !error && <div className="small" role="status">Sent. Your auditor has it.</div>}
      <ErrorNote error={error} />
    </section>
  );
}

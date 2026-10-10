import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { programmeFor } from '../content/packs';
import { repo } from '../data';
import { MAX_EVIDENCE_BYTES, opensAtPage, type Evidence, type EvidenceRef } from '../data/repo';
import { ErrorNote, Field, useAction } from '../ui';
import type { Ctx } from '../workspace';

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** A count of the files attached to one item, shown beside it. */
export function FileCount({ evidence, type, id }: { evidence: Evidence[]; type: EvidenceRef; id: string }) {
  const n = evidence.filter((e) => e.refType === type && e.refId === id).length;
  return n ? <span className="tag ok">{n} file{n === 1 ? '' : 's'}</span> : null;
}

/** The page a file points at, which can be set or changed after the file is attached. */
function PageRef({ e, locked, reload }: { e: Evidence; locked: boolean; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(e.page ?? ''));
  const { busy, error, run, setError } = useAction();
  if (!editing)
    return (
      <div className="small">
        {e.page ? (
          <span title={opensAtPage(e) ? 'Opens at this page' : 'Only a PDF can open at its page. The number is kept as a reference.'}>Page {e.page}</span>
        ) : (
          locked && null
        )}
        {!locked && (
          <button className="link small" style={{ marginLeft: e.page ? 8 : 0 }} onClick={() => setEditing(true)} aria-label={`${e.page ? 'Change' : 'Set'} the page for ${e.fileName}`}>
            {e.page ? 'Change' : 'Set a page'}
          </button>
        )}
      </div>
    );
  const save = () => {
    const n = value.trim() === '' ? null : Number(value);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 100000)) return setError('Use a whole number, 1 or more.');
    void run(async () => {
      await repo.setEvidencePage(e, n);
      setEditing(false);
      reload();
    });
  };
  return (
    <div className="row small" style={{ gap: 6, marginTop: 4 }}>
      <input type="number" min={1} aria-label={`Page for ${e.fileName}`} value={value} onChange={(x) => setValue(x.target.value)} style={{ width: 90, padding: '3px 6px' }} />
      <button disabled={busy} onClick={save}>Save</button>
      <button className="link" onClick={() => setEditing(false)}>Cancel</button>
      {error && <span className="danger">{error}</span>}
    </div>
  );
}

export function EvidenceStep(ctx: Ctx) {
  const { eng, ws, evidence, evidenceReady, locked, reload, ledgerTest, bankAccounts, adjustments, requests } = ctx;
  // A link from a figure arrives with the account already chosen.
  const [params] = useSearchParams();
  const [target, setTarget] = useState(() => (/^account:/.test(params.get('for') ?? '') && ctx.lines.some((l) => `account:${l.code}` === params.get('for')) ? params.get('for')! : 'general:'));
  const [page, setPage] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);
  const { busy, error, run, setError } = useAction();
  const programme = programmeFor(eng.type, eng.planning);

  const label = (e: Evidence): string => {
    switch (e.refType) {
      case 'programme':
        return programme.find((i) => i.id === e.refId)?.text ?? 'Work programme step';
      case 'journal':
        return `Journal ${e.refId}`;
      case 'bank':
        return `Bank: ${bankAccounts.find((b) => b.id === e.refId)?.name ?? 'statement removed'}`;
      case 'adjustment':
        return `Adjusting journal ${adjustments.find((a) => a.id === e.refId)?.ref ?? '(deleted)'}`;
      case 'account': {
        const l = ctx.lines.find((x) => x.code === e.refId);
        return `Account ${e.refId}${l ? ' ' + l.name : ''}`;
      }
      case 'request':
        return `Client request: ${requests.find((r) => r.id === e.refId)?.title ?? '(removed)'}`;
      default:
        return 'General file';
    }
  };

  const upload = () => {
    if (files.length === 0) return setError('Choose at least one file.');
    const big = files.find((f) => f.size > MAX_EVIDENCE_BYTES);
    if (big) return setError(`${big.name} is larger than 25 MB.`);
    const pageNo = page.trim() === '' ? null : Number(page);
    if (pageNo !== null && (!Number.isInteger(pageNo) || pageNo < 1 || pageNo > 100000)) return setError('The page must be a whole number, 1 or more.');
    if (pageNo !== null && files.length > 1) return setError('A page number applies to one file. Attach the files one at a time, or leave the page blank.');
    const [refType, ...rest] = target.split(':');
    void run(async () => {
      for (const f of files) {
        await repo.addEvidence(eng.id, f, {
          refType: refType as EvidenceRef,
          refId: rest.join(':'),
          note: note.trim(),
          uploadedByName: ws.me.fullName || ws.me.userId,
          page: pageNo,
        });
      }
      setFiles([]);
      setNote('');
      setPage('');
      setInputKey((k) => k + 1);
      reload();
    });
  };

  return (
    <div className="stack">
      <div>
        <h2>Evidence</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Attach the documents that support the work: confirmations, invoices, minutes, schedules. Link each one to the step, journal or bank account it supports. Files are private to your firm and cannot be added or removed once the file is signed.
        </p>
      </div>
      {!evidenceReady && (
        <div className="banner warn">
          Evidence files need a database update. Run <code>supabase/migrations/0003_team_and_evidence.sql</code> in the Supabase SQL editor, then reload this page.
        </div>
      )}
      {repo.mode === 'demo' && (
        <div className="banner warn">Demo mode lists the files but keeps their contents only until the page is reloaded.</div>
      )}

      {evidenceReady && !locked && (
        <div className="card stack">
          <h3>Attach files</h3>
          <div className="grid2">
            <Field label="Supports">
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="general:">The file in general</option>
                <optgroup label="Work programme">
                  {programme.map((i) => (
                    <option key={i.id} value={`programme:${i.id}`}>
                      {i.area}: {i.text.length > 70 ? i.text.slice(0, 70) + '…' : i.text}
                    </option>
                  ))}
                </optgroup>
                {ledgerTest && ledgerTest.highRisk.length > 0 && (
                  <optgroup label="High-risk journals">
                    {ledgerTest.highRisk.map((j) => (
                      <option key={j.entryNo} value={`journal:${j.entryNo}`}>
                        {j.entryNo} {j.description}
                      </option>
                    ))}
                  </optgroup>
                )}
                {bankAccounts.length > 0 && (
                  <optgroup label="Bank accounts">
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={`bank:${b.id}`}>{b.name}</option>
                    ))}
                  </optgroup>
                )}
                {ctx.lines.length > 0 && (
                  <optgroup label="Accounts in the trial balance">
                    {ctx.lines.map((l) => (
                      <option key={l.id} value={`account:${l.code}`}>
                        {l.code} {l.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {adjustments.length > 0 && (
                  <optgroup label="Adjusting journals">
                    {adjustments.map((a) => (
                      <option key={a.id} value={`adjustment:${a.id}`}>
                        {a.ref} {a.description}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </Field>
            <label className="field">
              <span>Files, up to 25 MB each</span>
              <input key={inputKey} type="file" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} style={{ padding: '6px 0' }} />
            </label>
          </div>
          <div className="grid2" style={{ gridTemplateColumns: '1fr 160px' }}>
            <Field label="Note">
              <input type="text" value={note} placeholder="What the document is and what it shows" onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Field label="Page, if it matters">
              <input type="number" min={1} inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} />
            </Field>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Give the page where the support is. A PDF then opens at that page from here and from any figure it supports.
          </p>
          <ErrorNote error={error} />
          <div>
            <button className="primary" disabled={busy} onClick={upload}>
              {busy ? 'Uploading…' : files.length > 1 ? `Attach ${files.length} files` : 'Attach'}
            </button>
          </div>
        </div>
      )}

      {evidenceReady && (
        <div className="card scroll-x">
          {evidence.length === 0 ? (
            <span className="muted">No files attached yet.</span>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Supports</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <button
                        className="link"
                        onClick={() =>
                          void run(async () => {
                            window.open(await repo.evidenceUrl(e), '_blank', 'noopener');
                          })
                        }
                      >
                        {e.fileName}
                      </button>
                      <div className="small muted">
                        {size(e.size)}
                        {e.note && ` · ${e.note}`}
                      </div>
                      <PageRef e={e} locked={locked} reload={reload} />
                    </td>
                    <td className="small">{label(e)}</td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>
                      {e.fromClient ? `Client: ${e.uploadedByName}` : e.uploadedByName}
                      <br />
                      <span className="muted">{new Date(e.createdAt).toLocaleDateString('en-GB')}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!locked && (
                        <button
                          className="link danger"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await repo.deleteEvidence(e);
                              reload();
                            })
                          }
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

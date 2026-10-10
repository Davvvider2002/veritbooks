import { useState } from 'react';
import { PROGRAMMES } from '../content/programmes';
import { repo } from '../data';
import { MAX_EVIDENCE_BYTES, type Evidence, type EvidenceRef } from '../data/repo';
import { ErrorNote, Field, useAction } from '../ui';
import type { Ctx } from '../workspace';

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** A count of the files attached to one item, shown beside it. */
export function FileCount({ evidence, type, id }: { evidence: Evidence[]; type: EvidenceRef; id: string }) {
  const n = evidence.filter((e) => e.refType === type && e.refId === id).length;
  return n ? <span className="tag ok">{n} file{n === 1 ? '' : 's'}</span> : null;
}

export function EvidenceStep(ctx: Ctx) {
  const { eng, ws, evidence, evidenceReady, locked, reload, ledgerTest, bankAccounts, adjustments } = ctx;
  const [target, setTarget] = useState('general:');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);
  const { busy, error, run, setError } = useAction();
  const programme = PROGRAMMES[eng.type];

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
      default:
        return 'General file';
    }
  };

  const upload = () => {
    if (files.length === 0) return setError('Choose at least one file.');
    const big = files.find((f) => f.size > MAX_EVIDENCE_BYTES);
    if (big) return setError(`${big.name} is larger than 25 MB.`);
    const [refType, ...rest] = target.split(':');
    void run(async () => {
      for (const f of files) {
        await repo.addEvidence(eng.id, f, {
          refType: refType as EvidenceRef,
          refId: rest.join(':'),
          note: note.trim(),
          uploadedByName: ws.me.fullName || ws.me.userId,
        });
      }
      setFiles([]);
      setNote('');
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
          <Field label="Note">
            <input type="text" value={note} placeholder="What the document is and what it shows" onChange={(e) => setNote(e.target.value)} />
          </Field>
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
                    </td>
                    <td className="small">{label(e)}</td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>
                      {e.uploadedByName}
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

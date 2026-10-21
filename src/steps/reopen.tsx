import { useState } from 'react';
import { repo } from '../data';
import type { Amendment, AmendmentKind } from '../data/repo';
import { longDate } from '../engine/report';
import { ErrorNote, Field, useAction, useLoad } from '../ui';
import type { Ctx } from '../workspace';
import type { ReportSettings } from '../engine/types';

type SignedReport = NonNullable<ReportSettings['signedReport']>;

/** Why a signed file can be reopened, as the auditing standards allow, and what each requires. */
export const KINDS: Record<AmendmentKind, { title: string; standard: string; detail: string }> = {
  documentation: {
    title: 'Add to or correct the audit documentation',
    standard: 'ISA 230, paragraph 16',
    detail:
      'Working papers are added or explained after the file was assembled, for example in response to a review, without changing the opinion or the financial statements. Record the reason and the effect on the conclusions. Nothing already on file should be deleted.',
  },
  subsequent_before_issue: {
    title: 'Facts found after the report was dated, before the statements were issued',
    standard: 'ISA 560, paragraphs 10 to 13',
    detail:
      'A fact that would have changed the report came to light before the financial statements were issued. If management amends them, extend the procedures to the new date and sign a new report dated no earlier than the approval of the amended statements.',
  },
  subsequent_after_issue: {
    title: 'Facts found after the statements were issued: revise and reissue',
    standard: 'ISA 560, paragraphs 14 to 17',
    detail:
      'The financial statements were issued and management will revise them. Review the steps management takes to tell everyone who received the original statements, extend the procedures to the new date, and sign a new report with a paragraph referring to the note that explains the revision.',
  },
};

/** The paragraph a reissued report carries (ISA 560, paragraph 16). The partner completes the note number. */
const reissueParagraph = (previous: string | null) =>
  `We draw attention to Note [number] to the financial statements, which describes the revision of the financial statements previously issued${previous ? ` with our report dated ${longDate(previous.slice(0, 10))}` : ''}, and the reason for it. Our opinion is not modified in respect of this matter.`;

/** The record of every reopening, and for a partner on a signed file, the way to reopen it. */
export function Amendments({ ctx }: { ctx: Ctx }) {
  const { eng, ws, reload } = ctx;
  const signed = eng.status === 'locked';
  const history = useLoad(() => repo.listAmendments(eng.id), [eng.id, eng.status]);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AmendmentKind>('documentation');
  const [reason, setReason] = useState('');
  const [effect, setEffect] = useState('');
  const [sure, setSure] = useState(false);
  const { busy, error, run } = useAction();
  const list: Amendment[] = history.data ?? [];
  const current = list.find((a) => !a.resignedAt);
  const partner = ws.me.role === 'partner';

  return (
    <>
      {current && !signed && (
        <div className="banner warn" aria-label="Reopened file">
          <strong>This file was reopened after signing.</strong> {current.reopenedByName} reopened it on {new Date(current.reopenedAt).toLocaleString('en-GB')} under {KINDS[current.kind].standard}: {current.reason} Effect on the conclusions: {current.effect}{' '}
          The report signed by {current.previousSignedByName ?? 'the partner'}
          {current.previousSignedAt ? ` on ${longDate(current.previousSignedAt.slice(0, 10))}` : ''} is kept below. Signing again dates a new report.
        </div>
      )}
      {signed && partner && (
        <div className="card stack" aria-label="Reopen the signed file">
          <div className="between">
            <h3 style={{ margin: 0 }}>Reopen the signed file</h3>
            <button className="link" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Reopen the file'}</button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            A signed file is reopened only for a reason the auditing standards recognise. The signed report and who signed it are kept, the reopening is recorded with its reason and effect, and the file must be signed again by a partner.
          </p>
          {open && (
            <>
              <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Why the file is being reopened</legend>
                {(Object.keys(KINDS) as AmendmentKind[]).map((k) => (
                  <label key={k} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 10 }}>
                    <input type="radio" name="reopen-kind" checked={kind === k} onChange={() => setKind(k)} style={{ marginTop: 4 }} />
                    <span>
                      <strong>{KINDS[k].title}</strong> <span className="tag">{KINDS[k].standard}</span>
                      <span className="small muted" style={{ display: 'block' }}>{KINDS[k].detail}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <Field label="The specific reason" hint="What happened, when it came to light, and what will be changed. At least 20 characters.">
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Field label="Effect on the conclusions reached" hint="For example: none, the opinion stands; or the financial statements will be amended and a new report signed.">
                <textarea rows={2} value={effect} onChange={(e) => setEffect(e.target.value)} />
              </Field>
              <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} style={{ marginTop: 4 }} />
                <span className="small">
                  I am the engagement partner. I understand the file returns to work in progress, the signed report is kept on record, and the file must be signed again.
                </span>
              </label>
              <ErrorNote error={error} />
              <div>
                <button
                  className="danger"
                  disabled={busy || !sure || reason.trim().length < 20 || effect.trim().length < 10}
                  onClick={() =>
                    void run(async () => {
                      await repo.reopen(eng.id, kind, reason, effect);
                      // A reissued report refers to the note explaining the revision. The partner completes it on the Report step.
                      if (kind === 'subsequent_after_issue' && !eng.report.emphasis?.trim()) {
                        const { signedReport: _s, ...report } = eng.report;
                        await repo.updateEngagement(eng.id, { report: { ...report, emphasis: reissueParagraph(eng.signedAt) } });
                      }
                      setOpen(false);
                      setSure(false);
                      reload();
                    })
                  }
                >
                  Reopen the file
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {list.length > 0 && (
        <div className="card stack" aria-label="Reopenings">
          <h3 style={{ margin: 0 }}>Reopened after signing</h3>
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Reopened</th>
                  <th>Standard</th>
                  <th>Reason</th>
                  <th>Effect on conclusions</th>
                  <th>Previously signed</th>
                  <th>Signed again</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{new Date(a.reopenedAt).toLocaleString('en-GB')}<div className="muted">{a.reopenedByName}</div></td>
                    <td className="small">{KINDS[a.kind].standard}</td>
                    <td className="small wrap">{a.reason}</td>
                    <td className="small wrap">{a.effect}</td>
                    <td className="small">{a.previousSignedByName}{a.previousSignedAt ? <div className="muted">{longDate(a.previousSignedAt.slice(0, 10))}</div> : null}</td>
                    <td className="small">{a.resignedAt ? <>{a.resignedByName}<div className="muted">{longDate(a.resignedAt.slice(0, 10))}</div></> : <span className="tag warn">Open</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.map((a) => {
            const r = a.previousReport.signedReport as SignedReport | undefined;
            return r ? (
              <details key={`r-${a.id}`}>
                <summary className="small" style={{ cursor: 'pointer' }}>
                  The report signed by {a.previousSignedByName}
                  {a.previousSignedAt ? ` on ${longDate(a.previousSignedAt.slice(0, 10))}` : ''}, exactly as it was signed
                </summary>
                <div className="small" style={{ padding: '8px 4px' }}>
                  <strong>{r.title}</strong>
                  <div className="muted">{r.addressee}</div>
                  {r.sections.map((sec, i) => (
                    <div key={i}>
                      {sec.heading && <strong style={{ display: 'block', marginTop: 8 }}>{sec.heading}</strong>}
                      {sec.paragraphs.map((p, j) => (
                        <p key={j} style={{ margin: '4px 0' }}>{p}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            ) : null;
          })}
        </div>
      )}
      <ErrorNote error={history.error} />
    </>
  );
}

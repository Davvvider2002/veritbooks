import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHECKLIST, CHECKLIST_VERSION } from '../content/checklist';
import { repo } from '../data';
import { buildChecklist, type ChecklistResult } from '../engine/checklist';
import type { ChecklistAnswer } from '../engine/types';
import { ErrorNote, useAction } from '../ui';
import type { Ctx } from '../workspace';

type Draft = Record<string, { status: '' | 'disclosed' | 'na'; note: string }>;

const TAG: Record<ChecklistResult['state'], [string, string]> = {
  covered: ['Covered by the file', 'ok'],
  disclosed: ['Disclosed', 'ok'],
  na: ['Does not apply', ''],
  open: ['No answer', 'warn'],
};

export function ChecklistStep({ eng, ws, lines, adjustments, statements, locked, reload }: Ctx) {
  const saved = eng.disclosures.checklist ?? {};
  const [draft, setDraft] = useState<Draft>(() => Object.fromEntries(Object.entries(saved).map(([id, a]) => [id, { status: a.status, note: a.note }])));
  const [openOnly, setOpenOnly] = useState(false);
  const [done, setDone] = useState(false);
  const { busy, error, run } = useAction();

  // The list is worked out from the draft, so the counts move as the preparer answers.
  const answers = useMemo(() => {
    const out: Record<string, ChecklistAnswer> = {};
    for (const [id, d] of Object.entries(draft)) {
      if (!d.status) continue;
      const was = saved[id];
      const same = was && was.status === d.status && was.note === d.note.trim();
      out[id] = same ? was : { status: d.status, note: d.note.trim(), by: ws.me.fullName || ws.me.userId, at: new Date().toISOString() };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  const results = useMemo(
    () => buildChecklist(CHECKLIST, { statements, lines, adjustments, disclosures: { ...eng.disclosures, checklist: answers }, principalActivity: eng.report.principalActivity }),
    [statements, lines, adjustments, eng.disclosures, eng.report.principalActivity, answers],
  );
  const count = (s: ChecklistResult['state']) => results.filter((r) => r.state === s).length;
  const dirty = JSON.stringify(Object.entries(answers).map(([k, a]) => [k, a.status, a.note]).sort()) !== JSON.stringify(Object.entries(saved).map(([k, a]) => [k, a.status, a.note]).sort());
  const sections = [...new Set(results.map((r) => r.item.section))];
  const set = (id: string, patch: Partial<Draft[string]>) => {
    setDone(false);
    setDraft((d) => ({ ...d, [id]: { ...(d[id] ?? { status: '', note: '' }), ...patch } }));
  };

  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>Disclosure checklist</h2>
        <div className="banner info">Import a trial balance first. The checklist is tailored to the lines the company has.</div>
      </div>
    );

  return (
    <div className="stack">
      <div>
        <h2>Disclosure checklist</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          What the financial statements must disclose under the IFRS for SMEs, limited to the lines this company has. Items the file already shows are covered for you. Answer the rest: say where it is disclosed, or why it does not apply. Sign-off waits until every item has an answer.
        </p>
      </div>
      {!locked && (
        <div className="banner warn">
          Starter checklist, version {CHECKLIST_VERSION}. It summarises the main disclosure areas and is not the text of the Standard, nor a complete list. Check it against the edition in force for this period before relying on it.
        </div>
      )}
      <div className="between">
        <div className="row">
          <span className="tag ok">{count('covered')} covered by the file</span>
          <span className="tag ok">{count('disclosed')} disclosed</span>
          <span className="tag">{count('na')} do not apply</span>
          <span className={`tag ${count('open') ? 'warn' : 'ok'}`}>{count('open')} with no answer</span>
        </div>
        <label className="small row" style={{ gap: 6 }}>
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Show only items with no answer
        </label>
      </div>

      {sections.map((section) => {
        const rows = results.filter((r) => r.item.section === section && (!openOnly || r.state === 'open'));
        if (rows.length === 0) return null;
        return (
          <div className="card" key={section}>
            <h3>{section}</h3>
            {rows.map((r) => {
              const d = draft[r.item.id] ?? { status: '', note: '' };
              const [text, cls] = TAG[r.state];
              return (
                <div className="journal checklist-item" key={r.item.id}>
                  <div className="between" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'nowrap' }}>
                    <div>{r.item.text}</div>
                    <span className={`tag ${cls}`} style={{ whiteSpace: 'nowrap' }}>{text}</span>
                  </div>
                  {r.state === 'covered' ? (
                    <div className="small muted">{r.basis}</div>
                  ) : (
                    <>
                      {r.basis && (
                        <div className="small muted">
                          Not yet shown by the file. {r.basis} <Link to={`/engagements/${eng.id}/disclosures`}>Disclosures</Link>
                        </div>
                      )}
                      <div className="row" style={{ marginTop: 8 }}>
                        <select
                          disabled={locked}
                          aria-label={`Answer: ${r.item.text}`}
                          value={d.status}
                          onChange={(e) => set(r.item.id, { status: e.target.value as Draft[string]['status'] })}
                          style={{ width: 170 }}
                        >
                          <option value="">No answer</option>
                          <option value="disclosed">Disclosed</option>
                          <option value="na">Does not apply</option>
                        </select>
                        {d.status && (
                          <input
                            type="text"
                            disabled={locked}
                            maxLength={500}
                            aria-label={`${d.status === 'na' ? 'Reason' : 'Where'}: ${r.item.text}`}
                            placeholder={d.status === 'na' ? 'Why it does not apply (required)' : 'Where it is disclosed, such as the note number'}
                            value={d.note}
                            onChange={(e) => set(r.item.id, { note: e.target.value })}
                            style={{ flex: 1, minWidth: 200 }}
                          />
                        )}
                      </div>
                      {d.status === 'na' && !d.note.trim() && <div className="small" style={{ color: 'var(--warn)', marginTop: 4 }}>Give the reason, or this stays open.</div>}
                      {r.answer && r.state !== 'open' && saved[r.item.id] === r.answer && (
                        <div className="small muted" style={{ marginTop: 4 }}>
                          {r.answer.by}, {new Date(r.answer.at).toLocaleDateString('en-GB')}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      {openOnly && count('open') === 0 && <div className="banner info">Every item has an answer.</div>}

      <ErrorNote error={error} />
      {done && !dirty && <div className="banner info">Saved.</div>}
      {!locked && (
        <div className="row">
          <button
            className="primary"
            disabled={busy || !dirty}
            onClick={() =>
              void run(async () => {
                await repo.updateEngagement(eng.id, { disclosures: { ...eng.disclosures, checklist: answers } });
                setDone(true);
                reload();
              })
            }
          >
            {busy ? 'Saving…' : 'Save checklist'}
          </button>
          {dirty && <span className="small muted">You have answers that are not saved.</span>}
        </div>
      )}
    </div>
  );
}

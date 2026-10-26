import { useState } from 'react';
import { POLICY_VERSION, policiesFor, policyCodes } from '../content/notes';
import { packOf } from '../content/packs';
import { repo } from '../data';
import type { PolicyDraft } from '../data/repo';
import { ErrorNote, useAction } from '../ui';
import type { Ctx } from '../workspace';

export function PoliciesStep(ctx: Ctx) {
  const { eng, statements, lines } = ctx;
  const codes = policyCodes(statements);
  const saved = eng.disclosures.policies ?? {};
  const confirmed = codes.filter((c) => saved[c]?.text.trim()).length;

  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>Accounting policies</h2>
        <div className="banner info">Import a trial balance first. A policy is shown for each line the company has.</div>
      </div>
    );

  return (
    <div className="stack">
      <div>
        <h2>Accounting policies</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          The wording printed in note 2 of the financial statements, one policy for each line this company has. Each starts as general wording. Edit it to say what this company actually does, then confirm it. A policy you have not confirmed prints the starter wording.
        </p>
      </div>
      <div className="banner warn">
        Starter wording, version {POLICY_VERSION}. A policy must state this company’s own methods, rates and estimates. General wording that could describe any company does not meet the {ctx.gaap === 'ifrs-smes' ? 'Standard' : 'Handbook'}.
      </div>
      <div className="row">
        <span className={`tag ${confirmed === codes.length && codes.length ? 'ok' : 'warn'}`}>
          {confirmed} of {codes.length} confirmed for this client
        </span>
      </div>
      {codes.map((code) => (
        <PolicyCard key={code} ctx={ctx} code={code} />
      ))}
    </div>
  );
}

function PolicyCard({ ctx, code }: { ctx: Ctx; code: string }) {
  const { eng, ws, lines, locked, reload } = ctx;
  const starter = policiesFor(ctx.gaap, eng.planning)[code];
  const saved = eng.disclosures.policies?.[code];
  const [text, setText] = useState(saved?.text ?? starter.text);
  const [draft, setDraft] = useState<(PolicyDraft & { model: string }) | null>(null);
  const { busy, error, run, setError } = useAction();
  const ask = useAction();
  const changed = text.trim() !== (saved?.text ?? starter.text);
  const placeholders = text.match(/\[[^\]]*\]/g) ?? [];

  const store = (next: typeof saved | undefined) =>
    run(async () => {
      const policies = { ...eng.disclosures.policies };
      if (next) policies[code] = next;
      else delete policies[code];
      await repo.updateEngagement(eng.id, { disclosures: { ...eng.disclosures, policies } });
      reload();
    });
  const confirm = () => {
    if (!text.trim()) return setError('The policy cannot be empty.');
    if (placeholders.length) return setError(`Replace ${placeholders.join(', ')} with the company’s own facts before confirming.`);
    void store({ text: text.trim(), by: ws.me.fullName || ws.me.userId, at: new Date().toISOString() });
  };

  return (
    <section className="card stack" aria-label={starter.title}>
      <div className="between">
        <h3>{starter.title}</h3>
        <span className={`tag ${saved ? 'ok' : 'warn'}`}>{saved ? 'Confirmed' : 'Starter wording'}</span>
      </div>
      <textarea rows={4} disabled={locked} aria-label={`Wording for ${starter.title}`} value={text} onChange={(e) => setText(e.target.value)} />
      {saved && !changed && (
        <div className="small muted">Confirmed by {saved.by}, {new Date(saved.at).toLocaleDateString('en-GB')}</div>
      )}
      <ErrorNote error={error ?? ask.error} />
      {!locked && (
        <div className="row">
          <button className="primary" disabled={busy || (!!saved && !changed)} onClick={confirm} aria-label={`Confirm the wording for ${starter.title}`}>
            {saved ? 'Save changes' : 'Confirm this wording'}
          </button>
          {(saved || changed) && (
            <button
              disabled={busy}
              aria-label={`Go back to the starter wording for ${starter.title}`}
              onClick={() => {
                setText(starter.text);
                if (saved) void store(undefined);
              }}
            >
              Back to starter wording
            </button>
          )}
          {ctx.ws.firm.aiEnabled && !draft && (
            <button
              disabled={ask.busy}
              aria-label={`Draft ${starter.title} for this client`}
              onClick={() =>
                void ask.run(async () => {
                  setDraft(
                    await repo.draftPolicy(eng.id, {
                      title: starter.title,
                      starter: starter.text,
                      accounts: lines.filter((l) => l.mapCode === code).map((l) => l.name),
                      industry: packOf(eng.planning)?.name ?? '',
                    }),
                  );
                })
              }
            >
              {ask.busy ? 'Asking…' : 'Draft for this client'}
            </button>
          )}
        </div>
      )}
      {draft && (
        <div className="assist">
          <div className="small" style={{ fontWeight: 600 }}>Drafted by AI from the starter wording and this line’s account names. It does not know the company’s methods or rates.</div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{draft.text}</p>
          {draft.toConfirm.length > 0 && (
            <>
              <strong className="small">Facts to confirm with the client</strong>
              <ul>{draft.toConfirm.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </>
          )}
          <div className="row">
            <button
              onClick={() => {
                setText(draft.text);
                setDraft(null);
              }}
            >
              Put this draft in the box to edit
            </button>
            <button className="link" onClick={() => setDraft(null)}>Discard</button>
            <span className="small muted">From {draft.model}. Nothing is saved until you confirm the wording yourself.</span>
          </div>
        </div>
      )}
    </section>
  );
}

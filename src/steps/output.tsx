import { useState } from 'react';
import { POLICIES } from '../content/notes';
import { PROGRAMMES } from '../content/programmes';
import { repo } from '../data';
import { canSign, signOffChecks } from '../engine/checks';
import { fmt } from '../engine/money';
import { draftReport, longDate } from '../engine/report';
import type { ReportSettings } from '../engine/types';
import { ErrorNote, Field, StatementTable, useAction, useLoad } from '../ui';
import type { Ctx } from '../workspace';
import { ChecksList } from './input';

function DraftMark({ locked }: { locked: boolean }) {
  return locked ? null : <div className="draft-mark">DRAFT · NOT SIGNED</div>;
}

function SheetHead({ ctx, title, sub }: { ctx: Ctx; title: string; sub?: string }) {
  return (
    <>
      <DraftMark locked={ctx.locked} />
      <div className="entity">{ctx.client.name}</div>
      <h2>{title}</h2>
      <div className="sub">{sub ?? `for the year ended ${longDate(ctx.eng.yearEnd)}`}</div>
    </>
  );
}

export function StatementsStep(ctx: Ctx) {
  const { eng, client, lines, statements: st } = ctx;
  const year = eng.yearEnd.slice(0, 4);
  const prior = st.hasPrior ? String(Number(year) - 1) : null;
  const r = eng.report;

  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>Financial statements</h2>
        <div className="banner info">Import a trial balance first.</div>
      </div>
    );

  const balanced = st.cur.totalAssets === st.cur.totalEquityAndLiabilities;
  const policies = Object.entries(POLICIES).filter(([code]) => st.notes.has(code));

  return (
    <div>
      <div className="stack no-print" style={{ marginBottom: 20 }}>
        <div className="between">
          <h2>Financial statements</h2>
          <button onClick={() => window.print()}>Print or save as PDF</button>
        </div>
        {st.cur.unmappedCount > 0 && (
          <div className="banner bad">
            {st.cur.unmappedCount} account(s) are not mapped, so these statements are incomplete. Finish the mapping step.
          </div>
        )}
        {!balanced && st.cur.unmappedCount === 0 && (
          <div className="banner bad">The statement of financial position does not balance. Check that the trial balance foots.</div>
        )}
        {!st.hasPrior && (
          <div className="banner warn">No prior year has been imported, so there are no comparatives and no statement of cash flows.</div>
        )}
        <div className="banner warn">
          This draft does not yet produce: the property, plant and equipment movement schedule, the tax reconciliation, related party and directors’ disclosures, comparatives for the statement of changes in equity, and years three to five of the financial summary. Add them before the statements are issued.
        </div>
      </div>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Statement of financial position" sub={`as at ${longDate(eng.yearEnd)}`} />
        <StatementTable rows={st.position} curLabel={year} priorLabel={prior} notes />
        <div className="approval">
          <p>
            These financial statements were approved by the board of directors on ____________________ and signed on its behalf by:
          </p>
          <div className="sign-grid">
            <div className="sign-line">
              {r.ceoName || '[Chief executive officer]'}
              <br />
              Chief Executive Officer
              <br />
              {r.ceoFrc || '[FRC number]'}
            </div>
            <div className="sign-line">
              {r.cfoName || '[Chief financial officer]'}
              <br />
              Chief Financial Officer
              <br />
              {r.cfoFrc || '[FRC number]'}
            </div>
          </div>
        </div>
      </section>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Statement of profit or loss and other comprehensive income" />
        <StatementTable rows={st.income} curLabel={year} priorLabel={prior} notes />
        <p style={{ marginTop: 16 }}>There were no items of other comprehensive income in the year.</p>
      </section>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Statement of changes in equity" />
        <div className="scroll-x">
          <table className="fs">
            <thead>
              <tr>
                <th></th>
                {st.equity.columns.map((c) => (
                  <th key={c} className="num">{c}<br />₦</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {st.equity.rows.map((row) => (
                <tr key={row.label} className={row.style}>
                  <td>{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="num">{fmt(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {st.cashFlow && (
        <section className="sheet">
          <SheetHead ctx={ctx} title="Statement of cash flows" />
          <StatementTable rows={st.cashFlow} curLabel={year} />
        </section>
      )}

      <section className="sheet">
        <SheetHead ctx={ctx} title="Notes to the financial statements" />
        <h3>1. General information</h3>
        <p>
          {client.name}
          {client.rcNumber ? ` (RC ${client.rcNumber})` : ''} is a company incorporated and domiciled in Nigeria under the Companies and Allied Matters Act 2020.{' '}
          {r.principalActivity ? `Its principal activity is ${r.principalActivity}.` : '[Describe the principal activity.]'}
        </p>
        <h3>2. Basis of preparation and significant accounting policies</h3>
        <p>
          These financial statements have been prepared in accordance with the IFRS for SMEs Accounting Standard issued by the International Accounting Standards Board, as adopted by the Financial Reporting Council of Nigeria, and the requirements of the Companies and Allied Matters Act 2020. They are presented in Nigerian naira, the company’s functional currency, and are prepared under the historical cost convention.
        </p>
        {policies.map(([code, p]) => (
          <p key={code}>
            <em>{p.title}.</em> {p.text}
          </p>
        ))}
        {st.noteBreakdowns.map((n) => (
          <div key={n.code}>
            <h3>
              {n.number}. {n.title}
            </h3>
            <StatementTable
              rows={[
                ...n.rows.map((x) => ({ label: x.name, cur: x.cur, prior: x.prior, style: 'line' as const })),
                { label: '', cur: n.cur, prior: n.prior, style: 'total' as const },
              ]}
              curLabel={year}
              priorLabel={prior}
            />
          </div>
        ))}
      </section>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Statement of value added" />
        <StatementTable rows={st.valueAdded} curLabel={year} priorLabel={prior} />
        <p className="small" style={{ marginTop: 16 }}>
          This statement is presented as other national disclosure, as directed by the Financial Reporting Council of Nigeria. It is not a required statement under the IFRS for SMEs Accounting Standard.
        </p>
      </section>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Financial summary" sub="other national disclosure" />
        <StatementTable rows={st.summary} curLabel={year} priorLabel={prior} />
      </section>
    </div>
  );
}

export function ReportStep(ctx: Ctx) {
  const { eng, client, ws, statements, locked, reload } = ctx;
  const [r, setR] = useState<ReportSettings>(eng.report);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const partner = ws.me.role === 'partner';
  const set = (patch: Partial<ReportSettings>) => {
    setSaved(false);
    setR({ ...r, ...patch });
  };
  const draft = draftReport({
    type: eng.type,
    clientName: client.name,
    yearEnd: eng.yearEnd,
    settings: r,
    hasCashFlow: statements.cashFlow !== null,
  });

  return (
    <div>
      <div className="stack no-print" style={{ marginBottom: 20 }}>
        <div className="between">
          <h2>Report</h2>
          <button onClick={() => window.print()}>Print or save as PDF</button>
        </div>
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await repo.updateEngagement(eng.id, { report: r });
              setSaved(true);
              reload();
            });
          }}
        >
          {eng.type === 'audit' && (
            <>
              <Field
                label="Opinion"
                hint={partner ? 'The software does not choose the opinion. It is the engagement partner’s judgment.' : 'Only the engagement partner can select the opinion.'}
              >
                <select
                  disabled={locked || !partner}
                  value={r.opinion ?? ''}
                  onChange={(e) => set({ opinion: (e.target.value || undefined) as ReportSettings['opinion'] })}
                >
                  <option value="">Not yet selected</option>
                  <option value="unmodified">Unmodified</option>
                  <option value="qualified">Qualified</option>
                  <option value="adverse">Adverse</option>
                  <option value="disclaimer">Disclaimer of opinion</option>
                </select>
              </Field>
              {r.opinion && r.opinion !== 'unmodified' && (
                <Field label="Basis for the modification">
                  <textarea disabled={locked || !partner} value={r.basis ?? ''} onChange={(e) => set({ basis: e.target.value })} />
                </Field>
              )}
            </>
          )}
          <Field label="Principal activity of the company" hint="Completes the sentence: Its principal activity is …">
            <input type="text" disabled={locked} value={r.principalActivity ?? ''} onChange={(e) => set({ principalActivity: e.target.value })} />
          </Field>
          <div className="grid2">
            <Field label="Chief executive officer">
              <input type="text" disabled={locked} value={r.ceoName ?? ''} onChange={(e) => set({ ceoName: e.target.value })} />
            </Field>
            <Field label="CEO’s FRC number">
              <input type="text" disabled={locked} value={r.ceoFrc ?? ''} onChange={(e) => set({ ceoFrc: e.target.value })} />
            </Field>
            <Field label="Chief financial officer">
              <input type="text" disabled={locked} value={r.cfoName ?? ''} onChange={(e) => set({ cfoName: e.target.value })} />
            </Field>
            <Field label="CFO’s FRC number">
              <input type="text" disabled={locked} value={r.cfoFrc ?? ''} onChange={(e) => set({ cfoFrc: e.target.value })} />
            </Field>
          </div>
          <ErrorNote error={error} />
          {saved && <div className="banner info">Saved.</div>}
          {!locked && (
            <div>
              <button className="primary" disabled={busy}>Save</button>
            </div>
          )}
        </form>
        {!locked && (
          <div className="banner warn">
            This is a draft for the engagement partner to review. The wording is starter text and must be checked against the current standards before it is issued.
          </div>
        )}
      </div>

      <section className="sheet">
        <DraftMark locked={locked} />
        <div className="entity">{ws.firm.name}</div>
        <h2>{draft.title}</h2>
        <div className="sub">{draft.addressee}</div>
        {eng.type === 'audit' && !r.opinion ? (
          <p><em>The engagement partner has not yet selected the opinion. The report is drafted once it is.</em></p>
        ) : (
          draft.sections.map((s, i) => (
            <div key={i}>
              {s.heading && <h3>{s.heading}</h3>}
              {s.paragraphs.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          ))
        )}
        <div className="sign-grid">
          <div className="sign-line">
            {locked ? (
              <>
                {eng.signedByName}
                <br />
                {eng.signedByFrc}
                <br />
                For: {ws.firm.name} ({eng.firmFrc})
                <br />
                {ws.firm.address}
                <br />
                {longDate((eng.signedAt ?? '').slice(0, 10))}
              </>
            ) : (
              <>
                [Engagement partner]
                <br />
                [FRC number]
                <br />
                For: {ws.firm.name}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function SignOffStep({ eng, ws, lines, adjustments, locked, reload, ledgerTest, bankGates }: Ctx) {
  const [confirm, setConfirm] = useState(false);
  const { busy, error, run } = useAction();
  const checks = signOffChecks({
    type: eng.type,
    lines,
    adjustments,
    planning: eng.planning,
    programme: eng.programme,
    programmeItemIds: PROGRAMMES[eng.type].map((i) => i.id),
    report: eng.report,
    firmFrc: locked ? (eng.firmFrc ?? '') : ws.firm.frcNumber,
    signerRole: locked ? 'partner' : ws.me.role,
    signerFrc: locked ? (eng.signedByFrc ?? '') : ws.me.frcNumber,
    ledger: ledgerTest,
    testing: eng.testing,
    bank: bankGates,
  });
  const ready = canSign(checks);
  const advisories = checks.filter((c) => !c.ok && !c.blocking);

  return (
    <div className="stack">
      <div>
        <h2>Sign-off</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Signing records the engagement partner’s name and FRC number on the report and locks the file. A locked file cannot be changed.
        </p>
      </div>
      {locked && (
        <div className="card">
          <h3>Signed</h3>
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            {eng.signedByName} ({eng.signedByFrc}) signed for {ws.firm.name} ({eng.firmFrc}) on{' '}
            {new Date(eng.signedAt ?? '').toLocaleString('en-GB')}.
          </p>
        </div>
      )}
      <div className="card">
        <h3>{locked ? 'Checks at sign-off' : 'Before you can sign'}</h3>
        <ChecksList checks={checks} />
      </div>
      {!locked && (
        <div className="card stack">
          {!ready && <div className="banner warn">Sign-off is blocked until every item marked ✕ is cleared.</div>}
          {ready && advisories.length > 0 && (
            <div className="banner warn">
              {advisories.length} advisory item(s) are open. You can sign, but document why each one is acceptable.
            </div>
          )}
          <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <input type="checkbox" disabled={!ready} checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ marginTop: 4 }} />
            <span>
              I am the engagement partner. I have reviewed this file and the draft report, the evidence supports the report, and I take responsibility for it.
            </span>
          </label>
          <ErrorNote error={error} />
          <div>
            <button
              className="primary"
              disabled={!ready || !confirm || busy}
              onClick={() =>
                void run(async () => {
                  await repo.sign(eng.id);
                  reload();
                })
              }
            >
              Sign and lock the file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TABLE_LABEL: Record<string, string> = {
  engagements: 'Engagement',
  tb_lines: 'Trial balance',
  adjustments: 'Journal',
  gl_entries: 'General ledger',
  bank_accounts: 'Bank statement',
  bank_lines: 'Bank transactions',
};

export function TrailStep({ eng, ws }: Ctx) {
  const { data, error } = useLoad(() => repo.listLog(eng.id), [eng.id]);
  const who = (id: string | null) => ws.members.find((m) => m.userId === id)?.fullName || 'Unknown user';
  return (
    <div className="stack">
      <div>
        <h2>Audit trail</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Every change to this file, newest first. The trail is written by the database and cannot be edited.
        </p>
      </div>
      <ErrorNote error={error} />
      <div className="card scroll-x">
        {!data ? (
          <span className="muted">Loading…</span>
        ) : data.length === 0 ? (
          <span className="muted">Nothing recorded yet.</span>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.at).toLocaleString('en-GB')}</td>
                  <td>{who(l.userId)}</td>
                  <td>
                    {TABLE_LABEL[l.table] ?? l.table} {l.action}
                  </td>
                  <td className="small muted" style={{ wordBreak: 'break-word' }}>
                    {l.detail ? JSON.stringify(l.detail).slice(0, 160) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

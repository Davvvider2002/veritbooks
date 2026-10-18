import { useRef, useState } from 'react';
import { POLICIES } from '../content/notes';
import { currencyOf } from '../content/jurisdictions';
import { repo } from '../data';
import { directorList } from '../engine/disclosures';
import { buildIxbrl, COMPANY_TYPES, ENTRY_POINT, IXBRL_DRAFT_NOTE, publicInterestScore, type CipcDetails } from '../engine/ixbrl';
import { fmt, parseAmount, cur } from '../engine/money';
import { longDate } from '../engine/report';
import { ErrorNote, Field, useAction } from '../ui';
import type { Ctx } from '../workspace';
import { StatementsStep } from './output';

/** The version written into the filing as the software that produced it. */
export const SOFTWARE_VERSION = '0.18';

const str = (k: number | undefined | null) => (k === undefined || k === null ? '' : (k / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A printed page of the statements as an XHTML fragment for a text block: the page heading,
 * logos, draft mark and footer are left out, and figures that open their source become plain text.
 */
function pageHtml(root: HTMLElement | null, id: string): string {
  const el = root?.querySelector<HTMLElement>(`#${id}`);
  if (!el) return '';
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('.draft-mark, .entity, h2, .sub, img, .letterhead, .sheet-foot, .no-print').forEach((x) => x.remove());
  copy.querySelectorAll('button').forEach((b) => b.replaceWith(document.createTextNode(b.textContent ?? '')));
  const s = new XMLSerializer();
  return Array.from(copy.childNodes)
    .map((n) => s.serializeToString(n))
    .join('')
    .trim();
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/xhtml+xml' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CipcStep(ctx: Ctx) {
  const { eng, client, statements: st, locked, reload } = ctx;
  const saved = eng.disclosures.cipc ?? {};
  const [f, setF] = useState<CipcDetails>(() => ({ country: 'South Africa', postalSame: true, ...saved }));
  const [liab, setLiab] = useState(str(saved.thirdPartyLiabilities));
  const [turn, setTurn] = useState(str(saved.turnover));
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const pages = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<CipcDetails>) => {
    setDone(null);
    setF({ ...f, ...patch });
  };
  const details = (): CipcDetails => ({
    ...f,
    thirdPartyLiabilities: liab.trim() === '' ? undefined : (parseAmount(liab) ?? undefined),
    turnover: turn.trim() === '' ? undefined : (parseAmount(turn) ?? undefined),
  });

  if (ctx.lines.length === 0)
    return (
      <div className="stack">
        <h2>CIPC filing</h2>
        <div className="banner info">Import a trial balance first.</div>
      </div>
    );

  const d = details();
  const employees = eng.disclosures.employees;
  const pis = publicInterestScore({
    employees,
    thirdPartyLiabilities: d.thirdPartyLiabilities ?? st.cur.totalLiabilities,
    turnover: d.turnover ?? st.cur.v.revenue,
    beneficialHolders: d.beneficialHolders,
    companyType: d.companyType,
    independentlyCompiled: d.independentlyCompiled,
  });
  const yearStart = (() => {
    const y = Number(eng.yearEnd.slice(0, 4)) - 1;
    const next = new Date(Date.UTC(y, Number(eng.yearEnd.slice(5, 7)) - 1, Number(eng.yearEnd.slice(8, 10)) + 1));
    return next.toISOString().slice(0, 10);
  })();

  const build = () => {
    const root = pages.current;
    const policies = Object.entries(POLICIES)
      .filter(([code]) => st.notes.has(code))
      .map(([code, p]) => `<p><em>${esc(p.title)}.</em> ${esc(eng.disclosures.policies?.[code]?.text || p.text)}</p>`)
      .join('');
    return buildIxbrl({
      entityName: client.name,
      registrationNumber: client.rcNumber ?? '',
      yearEnd: eng.yearEnd,
      yearStart,
      currency: eng.currency,
      currencyName: currencyOf(eng.currency).name,
      type: eng.type,
      st,
      details: d,
      employees,
      directors: directorList(eng.disclosures),
      principalActivity: eng.report.principalActivity ?? '',
      blocks: {
        directorsReport: pageHtml(root, 'fs-directors'),
        responsibilities: pageHtml(root, 'fs-responsibilities'),
        report: pageHtml(root, 'fs-report') || undefined,
        policies,
        notes: pageHtml(root, 'fs-notes'),
        equity: pageHtml(root, 'fs-equity') || undefined,
      },
      software: { name: 'VeritBooks', version: SOFTWARE_VERSION },
    });
  };
  const preview = build();

  const text = (label: string, key: keyof CipcDetails, hint?: string, type = 'text') => (
    <Field label={label} hint={hint}>
      <input type={type} disabled={locked} value={(f[key] as string | undefined) ?? ''} onChange={(e) => set({ [key]: e.target.value } as Partial<CipcDetails>)} />
    </Field>
  );

  return (
    <div className="stack">
      <div>
        <h2>CIPC filing</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          The annual financial statements as one iXBRL file for the CIPC annual return, with the public interest score worked out. The statements, directors’ pages and report are taken from this file as they print.
        </p>
      </div>

      <div className="banner warn">
        <strong>Draft for validation.</strong> {IXBRL_DRAFT_NOTE.replace(/^Draft for validation\. /, '')} Upload it as a test on CIPC’s e-services portal, or check it with Arelle and the CIPC 2024 taxonomy package, and correct any element CIPC rejects.
      </div>
      {eng.status !== 'locked' && <div className="banner info">These statements are not signed yet. File only the signed version.</div>}

      <div className="card stack">
        <h3>Public interest score</h3>
        <table className="data" style={{ maxWidth: 560 }}>
          <tbody>
            <tr><td>Average number of employees{employees === undefined && <div className="small muted">Enter it in the Disclosures step.</div>}</td><td className="num">{pis.employees}</td></tr>
            <tr><td>Third party liabilities, a point per R1 million or part of it</td><td className="num">{pis.liabilities}</td></tr>
            <tr><td>Turnover, a point per R1 million or part of it</td><td className="num">{pis.turnover}</td></tr>
            <tr><td>Individuals with a beneficial interest in the company’s securities</td><td className="num">{pis.holders}</td></tr>
            <tr><td><strong>Public interest score</strong></td><td className="num"><strong>{pis.total}</strong></td></tr>
          </tbody>
        </table>
        <div className="banner info">{pis.meaning} Check the company’s memorandum of incorporation, which may require more.</div>
        <div className="grid3">
          <Field label={`Third party liabilities, ${cur()}`} hint={`Blank uses total liabilities, ${cur()}${fmt(st.cur.totalLiabilities, { zero: '0' })}. Leave out amounts owed to directors and shareholders.`}>
            <input type="text" inputMode="decimal" className="num" disabled={locked} value={liab} onChange={(e) => { setDone(null); setLiab(e.target.value); }} />
          </Field>
          <Field label={`Turnover, ${cur()}`} hint={`Blank uses revenue, ${cur()}${fmt(st.cur.v.revenue, { zero: '0' })}.`}>
            <input type="text" inputMode="decimal" className="num" disabled={locked} value={turn} onChange={(e) => { setDone(null); setTurn(e.target.value); }} />
          </Field>
          <Field label="Most individuals with a beneficial interest during the year">
            <input type="number" min="0" step="1" disabled={locked} value={f.beneficialHolders ?? ''} onChange={(e) => set({ beneficialHolders: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </Field>
        </div>
        <label className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <input type="checkbox" disabled={locked} checked={!!f.independentlyCompiled} onChange={(e) => set({ independentlyCompiled: e.target.checked })} />
          <span>The statements were compiled by an independent accounting professional, not internally.</span>
        </label>
      </div>

      <div className="card stack">
        <h3>Company</h3>
        <div className="grid3">
          {text('CIPC customer code', 'customerCode')}
          <Field label="Type of company">
            <select disabled={locked} value={f.companyType ?? ''} onChange={(e) => set({ companyType: e.target.value || undefined })}>
              <option value="">Choose</option>
              {COMPANY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Registration number">
            <div style={{ padding: '8px 0' }}>{client.rcNumber || <span className="muted">Not set. Add it to the client’s details.</span>}</div>
          </Field>
          {text('Email address of the company', 'email', undefined, 'email')}
          {text('Principal place of business', 'principalPlace')}
          {text('Holding company', 'holdingCompany', 'Blank reads “The company has no holding company.”')}
        </div>
        <h4 style={{ margin: '8px 0 0' }}>Business address</h4>
        <div className="grid3">
          {text('Street', 'street')}
          {text('City', 'city')}
          {text('Postal code', 'postalCode')}
          {text('Country', 'country')}
        </div>
        <label className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <input type="checkbox" disabled={locked} checked={f.postalSame ?? true} onChange={(e) => set({ postalSame: e.target.checked })} />
          <span>The postal address is the same as the business address.</span>
        </label>
      </div>

      <div className="card stack">
        <h3>People and dates</h3>
        <div className="grid3">
          {text('Designated person responsible for compliance', 'complianceName')}
          {text('Person responsible for financial accountability', 'designatedName')}
          {text('Their telephone number', 'designatedPhone')}
          {text('Director authorised to approve the statements', 'authorisedDirector')}
          {text('Date the board approved the statements', 'approvalDate', undefined, 'date')}
          {text('Date of publication', 'publicationDate', undefined, 'date')}
          {text('Prepared by', 'preparerName', 'The individual who prepared the statements, as printed on them.')}
          {text('Their professional designation', 'preparerDesignation', 'Such as CA(SA), AGA(SA) or Professional Accountant (SA).')}
        </div>
        <details>
          <summary className="small">Taxonomy entry point</summary>
          <div style={{ marginTop: 8 }}>
            {text('Entry point (schemaRef)', 'entryPoint', `Blank uses ${ENTRY_POINT}. Replace it with the IFRS for SMEs entry point named in CIPC’s 2024 taxonomy package if CIPC reports it as not found.`)}
          </div>
        </details>
      </div>

      <div className="card stack">
        <h3>The file</h3>
        <p className="small" style={{ margin: 0 }}>
          {preview.facts} facts tagged for the year ended {longDate(eng.yearEnd)}, in {currencyOf(eng.currency).name}. The statement of financial position, profit or loss and cash flows are tagged figure by figure. The directors’ report, the statement of directors’ responsibilities, the {eng.type === 'audit' ? 'auditor’s' : 'independent'} report, the accounting policies and the notes are tagged as blocks.
        </p>
        {preview.missing.length > 0 ? (
          <div className="banner warn">
            <strong>CIPC will reject the file until these are filled in:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {preview.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="banner info">Every mandatory item has a value.</div>
        )}
        <ErrorNote error={error} />
        {done && <div className="banner info">{done}</div>}
        <div className="row">
          {!locked && (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await repo.updateEngagement(eng.id, { disclosures: { ...eng.disclosures, cipc: details() } });
                  setDone('Saved.');
                  reload();
                })
              }
            >
              Save
            </button>
          )}
          <button
            onClick={() => {
              const name = `${client.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}-AFS-${eng.yearEnd.slice(0, 4)}.xhtml`;
              download(name, build().xhtml);
            }}
          >
            Download iXBRL file
          </button>
        </div>
      </div>

      {/* The printed pages the text blocks are taken from. Not shown. */}
      <div ref={pages} hidden aria-hidden="true">
        <StatementsStep {...ctx} />
      </div>
    </div>
  );
}

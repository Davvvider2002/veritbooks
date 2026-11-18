import { useState } from 'react';
import { repo } from '../data';
import { CHART, ITEM } from '../engine/chart';
import { effectivePresentation } from '../engine/presentation';
import { titlesFor } from '../engine/frameworks';
import { legalFormOf } from '../content/entities';
import type { Presentation, PresentationTitle } from '../engine/types';
import { ErrorNote, useAction } from '../ui';
import type { Ctx } from '../workspace';

const ROUNDING = { units: 'Whole currency units', thousands: 'Thousands', millions: 'Millions' } as const;

/**
 * How this client's statements are laid out: style, rounding, expense analysis, titles, captions and
 * the optional national pages. Saved on the file; a partner or manager can also save them as the
 * firm's default for new files. Presentation changes words, order and rounding, never figures.
 */
export function PresentationPanel(ctx: Ctx) {
  const { eng, ws, jur: j, statements: st, gaap, locked, reload } = ctx;
  const firm = ws.firm.branding.presentation;
  const eff = effectivePresentation(firm, eng.report.presentation);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Presentation>(() => ({ ...eng.report.presentation }));
  const { busy, error, run } = useAction();
  const [saved, setSaved] = useState('');
  const npo = !!legalFormOf(eng.planning, j.code);
  const defaults = titlesFor(gaap, npo);
  const canFirm = ws.me.role === 'partner' || ws.me.role === 'manager';
  const draft = effectivePresentation(firm, v);
  // Captions are offered for the lines this client's statements show.
  const shown = CHART.filter((i) => st.notes.has(i.code));
  const set = (patch: Partial<Presentation>) => {
    setSaved('');
    setV((x) => ({ ...x, ...patch }));
  };
  const setTitle = (k: PresentationTitle, text: string) => set({ titles: { ...v.titles, [k]: text } });
  const setCaption = (code: string, text: string) => set({ captions: { ...v.captions, [code]: text } });
  const tidy = (p: Presentation): Presentation => ({
    ...p,
    titles: Object.fromEntries(Object.entries(p.titles ?? {}).filter(([, t]) => t?.trim())),
    captions: Object.fromEntries(Object.entries(p.captions ?? {}).filter(([, t]) => t?.trim())),
  });
  const summary = [
    eff.style === 'illustrative' ? 'International illustrative style' : 'VeritBooks standard style',
    eff.rounding === 'units' ? 'whole amounts' : `in ${eff.rounding}`,
    !npo && `expenses by ${eff.expenses}`,
    Object.keys(eff.captions).length > 0 && `${Object.keys(eff.captions).length} caption${Object.keys(eff.captions).length === 1 ? '' : 's'} changed`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="card stack no-print" aria-label="Presentation">
      <div className="between">
        <div>
          <h3 style={{ margin: 0 }}>Presentation</h3>
          <div className="small muted">{summary}.</div>
        </div>
        <button onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Close' : 'Change the layout'}
        </button>
      </div>
      {open && (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            Lay these statements out the way the client wants them. These choices change the words, order and rounding only, never the figures. {locked ? 'The file is signed, so its layout is fixed.' : ''}
          </p>
          <fieldset disabled={locked || busy} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="grid2">
              <label className="field">
                <span>Style</span>
                <select value={v.style ?? ''} onChange={(e) => set({ style: (e.target.value || undefined) as Presentation['style'] })}>
                  <option value="">Firm default ({firm?.style === 'illustrative' ? 'International illustrative' : 'VeritBooks standard'})</option>
                  <option value="standard">VeritBooks standard</option>
                  <option value="illustrative">International illustrative</option>
                </select>
              </label>
              <label className="field">
                <span>Rounding</span>
                <select value={v.rounding ?? ''} onChange={(e) => set({ rounding: (e.target.value || undefined) as Presentation['rounding'] })}>
                  <option value="">Default ({ROUNDING[effectivePresentation(firm, { style: v.style }).rounding]})</option>
                  {Object.entries(ROUNDING).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              {!npo && (
                <label className="field">
                  <span>Expenses in profit or loss</span>
                  <select value={v.expenses ?? ''} onChange={(e) => set({ expenses: (e.target.value || undefined) as Presentation['expenses'] })}>
                    <option value="">Default (by {firm?.expenses ?? 'function'})</option>
                    <option value="function">By function: cost of sales, distribution, administration</option>
                    <option value="nature">By nature: materials, employee benefits, depreciation, other</option>
                  </select>
                </label>
              )}
            </div>
            {draft.style === 'illustrative' && (
              <div className="banner info small">
                The international illustrative style shows amounts in thousands, groups the notes under section headings (performance for the year, income taxes, assets, equity and liabilities, other information), puts the material accounting policies in the last note, starts the cash flow from profit for the year, and states under each primary statement that the notes form an integral part of it.
              </div>
            )}
            {draft.expenses === 'nature' && !npo && (
              <div className="banner info small">By nature, staff costs and depreciation are drawn out of every expense line using the nature tags in the mapping. Tag every staff and depreciation account there.</div>
            )}

            <h4 style={{ margin: '8px 0 0' }}>Statement titles</h4>
            <div className="grid2">
              {(
                [
                  ['position', defaults.position],
                  ['income', defaults.income],
                  ['equity', defaults.equity],
                  ['cashflow', 'Statement of cash flows'],
                  ['notes', 'Notes to the financial statements'],
                ] as [PresentationTitle, string][]
              ).map(([k, d]) => (
                <label key={k} className="field">
                  <span>{d}</span>
                  <input type="text" maxLength={120} placeholder={firm?.titles?.[k] || d} value={v.titles?.[k] ?? ''} onChange={(e) => setTitle(k, e.target.value)} aria-label={`Title for ${d}`} />
                </label>
              ))}
            </div>

            <h4 style={{ margin: '8px 0 0' }}>Line captions</h4>
            <p className="small muted" style={{ margin: 0 }}>
              Rename a line where the client words it differently, for example Trade receivables as Accounts receivable. To show leases on their own lines, map the lease accounts to Lease liabilities in the mapping rather than renaming Borrowings.
            </p>
            <div className="grid2">
              {shown.map((i) => (
                <label key={i.code} className="field">
                  <span>{ITEM.get(i.code)!.label}</span>
                  <input type="text" maxLength={120} placeholder={firm?.captions?.[i.code] || i.label} value={v.captions?.[i.code] ?? ''} onChange={(e) => setCaption(i.code, e.target.value)} aria-label={`Caption for ${i.label}`} />
                </label>
              ))}
            </div>

            {j.nationalStatements && (
              <>
                <h4 style={{ margin: '8px 0 0' }}>Other national disclosures</h4>
                <label className="row small">
                  <input type="checkbox" checked={draft.valueAdded} onChange={(e) => set({ valueAdded: e.target.checked })} /> Statement of value added
                </label>
                <label className="row small">
                  <input type="checkbox" checked={draft.summary} onChange={(e) => set({ summary: e.target.checked })} /> Financial summary
                </label>
                {(!draft.valueAdded || !draft.summary) && <div className="small muted">The Financial Reporting Council expects both in statutory accounts. Leave them out only for copies such as management or bank packs.</div>}
              </>
            )}
          </fieldset>
          <ErrorNote error={error} />
          {!locked && (
            <div className="row">
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await repo.updateEngagement(eng.id, { report: { ...eng.report, presentation: tidy(v) } });
                    setSaved('Saved for this client.');
                    reload();
                  })
                }
              >
                Save for this client
              </button>
              {canFirm && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await repo.setBranding({ ...ws.firm.branding, presentation: tidy({ ...firm, ...v, captions: { ...firm?.captions, ...v.captions }, titles: { ...firm?.titles, ...v.titles } }) });
                      // The firm's settings load with the workspace.
                      window.location.reload();
                    })
                  }
                >
                  Save as the firm’s default
                </button>
              )}
              {eng.report.presentation && Object.keys(eng.report.presentation).length > 0 && (
                <button
                  className="link"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const { presentation: _p, ...rest } = eng.report;
                      await repo.updateEngagement(eng.id, { report: rest });
                      setV({});
                      setSaved('This client now follows the firm’s default.');
                      reload();
                    })
                  }
                >
                  Use the firm’s default
                </button>
              )}
              {saved && <span className="small muted">{saved}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

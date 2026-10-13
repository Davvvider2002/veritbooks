// The firm's branding on printed pages: the cover, the contents, the letterhead and the footer.
import { longDate } from '../engine/report';
import type { Ctx } from '../workspace';

/** Who the firm is to this client, in the wording of the engagement. */
export const roleOf = (type: string) => (type === 'audit' ? 'Auditors' : type === 'review' ? 'Independent reviewers' : 'Accountants');

/** The firm's letterhead, at the top of the auditor's report and the management letter. */
export function BrandedHead({ ctx }: { ctx: Ctx }) {
  const b = ctx.ws.firm.branding;
  if (!b.logo || b.logoOnReport === false) return null;
  return (
    <div className="letterhead">
      <img src={b.logo} alt={ctx.ws.firm.name} />
    </div>
  );
}

/** The footer printed at the bottom of each page. */
export function PageFoot({ ctx }: { ctx: Ctx }) {
  const text = ctx.ws.firm.branding.footer?.trim();
  return text ? <div className="sheet-foot">{text}</div> : null;
}

/** The front page of the financial statements. */
export function CoverSheet({ ctx }: { ctx: Ctx }) {
  const { client, eng, ws } = ctx;
  const b = ws.firm.branding;
  return (
    <section className="sheet cover">
      {b.logo && b.watermark && <img className="watermark" src={b.logo} alt="" />}
      {client.logo && (
        <div className={`cover-logo ${client.logoPlacement ?? 'centre'}`}>
          <img src={client.logo} alt={`${client.name} logo`} />
        </div>
      )}
      <div className="cover-body">
        <h1>{client.name}</h1>
        {client.rcNumber && <div className="cover-rc">RC {client.rcNumber}</div>}
        <div className="cover-title">Annual report and financial statements</div>
        <div className="cover-sub">for the year ended {longDate(eng.yearEnd)}</div>
      </div>
      <div className="cover-foot">
        <div>
          {roleOf(eng.type)}: {ws.firm.name}
        </div>
        {eng.fileNo && <div className="small">File no. {eng.fileNo}</div>}
      </div>
      <PageFoot ctx={ctx} />
    </section>
  );
}

/** The contents page. Each entry links to its page when read on screen. */
export function ContentsSheet({ ctx, entries }: { ctx: Ctx; entries: { id: string; title: string }[] }) {
  return (
    <section className="sheet">
      <div className="entity">{ctx.client.name}</div>
      <h2>Contents</h2>
      <div className="sub">for the year ended {longDate(ctx.eng.yearEnd)}</div>
      <ol className="contents">
        {entries.map((e) => (
          <li key={e.id}>
            <a href={`#${e.id}`}>{e.title}</a>
          </li>
        ))}
      </ol>
      <PageFoot ctx={ctx} />
    </section>
  );
}

import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PROGRAMMES } from './content/programmes';
import { repo } from './data';
import type { Client, Engagement, Workspace } from './data/repo';
import { validateTrialBalance } from './engine/checks';
import { longDate } from './engine/report';
import { buildStatements, type Statements } from './engine/statements';
import type { Adjustment, TbLine } from './engine/types';
import { TYPE_LABEL } from './pages';
import { ImportStep, MappingStep } from './steps/input';
import { ReportStep, SignOffStep, StatementsStep, TrailStep } from './steps/output';
import { JournalsStep, PlanningStep, ProgrammeStep } from './steps/work';
import { ErrorNote, useLoad } from './ui';

export interface Ctx {
  ws: Workspace;
  eng: Engagement;
  client: Client;
  lines: TbLine[];
  adjustments: Adjustment[];
  statements: Statements;
  locked: boolean;
  reload: () => void;
}

const STEPS = [
  { slug: 'import', label: 'Trial balance', el: ImportStep },
  { slug: 'mapping', label: 'Mapping', el: MappingStep },
  { slug: 'planning', label: 'Planning', el: PlanningStep },
  { slug: 'programme', label: 'Work programme', el: ProgrammeStep },
  { slug: 'journals', label: 'Journals', el: JournalsStep },
  { slug: 'statements', label: 'Financial statements', el: StatementsStep },
  { slug: 'report', label: 'Report', el: ReportStep },
  { slug: 'sign-off', label: 'Sign-off', el: SignOffStep },
  { slug: 'trail', label: 'Audit trail', el: TrailStep },
] as const;

export function EngagementPage({ ws }: { ws: Workspace }) {
  const { id = '', step } = useParams();
  const { data, error, reload } = useLoad(async () => {
    const eng = await repo.getEngagement(id);
    if (!eng) return null;
    const [clients, lines, adjustments] = await Promise.all([
      repo.listClients(),
      repo.listLines(id),
      repo.listAdjustments(id),
    ]);
    return { eng, client: clients.find((c) => c.id === eng.clientId) ?? null, lines, adjustments };
  }, [id]);

  const statements = useMemo(
    () => (data ? buildStatements(data.lines, data.adjustments) : null),
    [data],
  );

  if (error) return <div className="page"><ErrorNote error={error} /></div>;
  if (data === undefined) return <div className="page muted">Loading…</div>;
  if (data === null || !data.client || !statements)
    return (
      <div className="page">
        <div className="banner warn">This engagement was not found. <Link to="/">Back to engagements</Link></div>
      </div>
    );

  // Review and compilation engagements have no materiality step in this version.
  const steps = STEPS.filter((s) => s.slug !== 'planning' || data.eng.type !== 'compilation');
  const current = steps.find((s) => s.slug === step) ?? steps[0];
  const Step = current.el;
  const ctx: Ctx = {
    ws,
    eng: data.eng,
    client: data.client,
    lines: data.lines,
    adjustments: data.adjustments,
    statements,
    locked: data.eng.status === 'locked',
    reload,
  };
  const tb = validateTrialBalance(data.lines);
  const programmeDone = PROGRAMMES[data.eng.type].filter((i) => data.eng.programme[i.id]?.done).length;

  return (
    <div className="page">
      <div className="between no-print" style={{ marginBottom: 22 }}>
        <div>
          <div className="small muted">
            <Link to="/">Engagements</Link> / {TYPE_LABEL[data.eng.type]}
          </div>
          <h1 style={{ marginTop: 4 }}>{data.client.name}</h1>
          <div className="muted">Year ended {longDate(data.eng.yearEnd)} · IFRS for SMEs</div>
        </div>
        <div className="row">
          {data.lines.length > 0 && (
            <span className={`tag ${tb.every((c) => c.ok || !c.blocking) ? 'ok' : 'warn'}`}>
              {tb.every((c) => c.ok || !c.blocking) ? 'Trial balance clean' : 'Trial balance needs attention'}
            </span>
          )}
          <span className="tag">
            Programme {programmeDone}/{PROGRAMMES[data.eng.type].length}
          </span>
          {ctx.locked ? <span className="tag ok">Signed and locked</span> : <span className="tag">In progress</span>}
        </div>
      </div>

      <div className="workspace">
        <nav className="steps" aria-label="Engagement steps">
          {steps.map((s, i) => (
            <Link
              key={s.slug}
              to={`/engagements/${id}/${s.slug}`}
              className={s.slug === current.slug ? 'active' : ''}
              aria-current={s.slug === current.slug ? 'step' : undefined}
            >
              <span className="n">{i + 1}</span>
              {s.label}
            </Link>
          ))}
        </nav>
        <main>
          {ctx.locked && current.slug !== 'statements' && current.slug !== 'report' && (
            <div className="banner info no-print" style={{ marginBottom: 16 }}>
              This file was signed by {data.eng.signedByName} on {longDate((data.eng.signedAt ?? '').slice(0, 10))} and is locked. Nothing in it can be changed.
            </div>
          )}
          <Step {...ctx} />
        </main>
      </div>
    </div>
  );
}

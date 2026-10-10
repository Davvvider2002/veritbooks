import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { repo } from '../data';
import type { PublicPrices } from '../data/repo';
import { CTA, FALLBACK_PRICING, FOUNDING_BADGE, FOUNDING_PERCENT_OF_PRICE, HERO, LINKS } from './config';
import './landing.css';

const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');

/** A button that goes to a route in the app, a section of this page, or another site. */
function Go({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  if (to.startsWith('#') || to.startsWith('http') || to.startsWith('mailto:'))
    return (
      <a href={to} className={className}>
        {children}
      </a>
    );
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

/** The supplied logo, set side by side for the navigation bar: its mark, then its wordmark. */
const Logo = () => (
  <span className="lp-logo">
    <img src="/landing/logo-mark.png" alt="" width={236} height={184} className="mark" />
    <img src="/landing/logo-word.png" alt="VeritBooks" width={446} height={71} className="word" />
  </span>
);
/** The logo exactly as supplied, on a white tile so it reads on the dark footer. */
const LogoTile = () => (
  <span className="lp-logo-tile">
    <img src="/landing/logo.png" alt="VeritBooks" width={442} height={267} />
  </span>
);

// Simple line icons, drawn here so nothing is loaded from elsewhere.
const ICONS: Record<string, ReactNode> = {
  statements: <path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7M9 8h3" />,
  workflow: <path d="M4 6h10M4 12h16M4 18h8M18 5l2 2-2 2M16 17l2 2 3-4" />,
  requests: <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" />,
  evidence: <path d="M9 7a3 3 0 0 1 6 0v8a2 2 0 0 1-4 0V8M6 12v3a6 6 0 0 0 12 0v-3" />,
  group: <path d="M12 3v5M5 13v-2h14v2M3 13h4v5H3zM10 13h4v5h-4zM17 13h4v5h-4zM10 3h4v5h-4z" />,
  quality: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4" />,
  import: <path d="M12 3v11M8 10l4 4 4-4M4 17v3h16v-3" />,
  plan: <path d="M4 5h16v14H4zM4 10h16M9 5v14" />,
  review: <path d="M6 3h9l4 4v14H6zM9 13l2 2 4-4" />,
  sign: <path d="M4 19c4 0 3-9 6-9s1 7 4 7 2-4 6-4M4 22h16" />,
};
const Icon = ({ name }: { name: string }) => (
  <svg className="lp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
);

const FEATURES: { icon: string; label: string; head: string; text: string; groups: { title?: string; items: string[] }[] }[] = [
  {
    icon: 'statements',
    label: 'Financial statement preparation',
    head: 'From trial balance to financial statements.',
    text: 'Import accounting balances, map accounts to financial statement lines and generate a complete set of statements with notes and supporting schedules.',
    groups: [{ items: ['Trial balance import', 'Comparative financial information', 'Statement of financial position', 'Profit or loss', 'Changes in equity', 'Cash flows', 'Notes and supporting schedules', 'Statement of value added', 'Five-year financial summary'] }],
  },
  {
    icon: 'workflow',
    label: 'Audit and review workflows',
    head: 'Structured work. Clear sign-off.',
    text: 'Plan engagements, document procedures, record findings and track completion before a partner signs.',
    groups: [
      { title: 'Every engagement', items: ['Engagement work programmes', 'Adjustments, each with its journal', 'Sign-off checks'] },
      { title: 'Audit and review', items: ['Materiality calculations', 'Analytical review'] },
      { title: 'Audit only', items: ['Journal risk indicators from the general ledger', 'Bank statement reconciliation'] },
    ],
  },
  {
    icon: 'requests',
    label: 'Client document requests',
    head: 'Collect client documents without the back-and-forth.',
    text: 'Create a client request list and share a secure upload link so clients can submit requested files without creating an account.',
    groups: [{ items: ['Standard request templates', 'Expiring upload links', 'Document review and return reasons', 'Submitted files linked to their request and to evidence'] }],
  },
  {
    icon: 'evidence',
    label: 'Evidence and audit trail',
    head: 'Keep every figure connected to its support.',
    text: 'Link evidence to work programme steps, journals, bank accounts, trial balance accounts and client requests.',
    groups: [{ items: ['Evidence attachments', 'Financial figure traceability', 'Document page references', 'Recorded changes', 'Signed engagement file locking'] }],
  },
  {
    icon: 'group',
    label: 'Group consolidation',
    head: 'Consolidate group accounts in one workflow.',
    text: 'Prepare consolidated financial statements for supported groups, including subsidiaries, associates, joint ventures and relevant consolidation adjustments.',
    groups: [{ items: ['Goodwill', 'Non-controlling interests', 'Intercompany eliminations', 'Foreign subsidiaries', 'Sub-groups', 'Consolidated financial statements and notes'] }, { title: 'Scope', items: ['Supported group structures only. Some complex scenarios are outside the current scope.'] }],
  },
  {
    icon: 'quality',
    label: 'Firm quality management',
    head: 'Bring quality oversight into the workflow.',
    text: 'Maintain a quality management register, track findings and remedial actions, record evaluations and monitor engagement progress.',
    groups: [{ items: ['ISQM 1-oriented quality management register', 'Quality risks and responses', 'Monitoring findings', 'Remedial actions', 'Independence confirmations', 'Engagement monitoring'] }],
  },
];

const STEPS = [
  { icon: 'import', head: 'Import the Numbers', text: "Bring in the client's trial balance, prior-year figures, general ledger and bank statements from supported CSV, Excel or PDF files." },
  { icon: 'plan', head: 'Map, Plan and Perform', text: 'Map accounts, establish materiality where applicable, investigate movements, perform procedures and record audit adjustments.' },
  { icon: 'review', head: 'Prepare and Review', text: 'Complete disclosures, accounting policies and checklists. Generate financial statements with notes and the engagement report.' },
  { icon: 'sign', head: 'Partner Sign-off', text: 'Review outstanding checks, confirm independence and complete partner-controlled sign-off. The signed file is locked and changes are recorded in the audit trail.' },
];

const FIRM = [
  'Multiple client engagements in one workspace',
  'Partner, manager and staff roles',
  'Client-specific working files',
  'Review progress and outstanding tasks',
  'Independence confirmations',
  'Firm quality management',
  'Partner-controlled report opinions and sign-off',
  'A permanent, database-written audit trail',
];

const AI = [
  'Account mapping options, with confidence levels and reasons',
  'Possible explanations for flagged journals',
  'Questions to consider when investigating financial movements',
  'Draft accounting policy wording, with placeholders for unknown facts',
];

const TRUST = [
  ['Computed, not typed', 'Financial statement figures are computed from the trial balance and journals. They are not typed into statement lines.'],
  ['Traceable figures', 'Figures can be traced to the underlying accounts and supporting records.'],
  ['Checks before sign-off', 'The application checks engagement completion before a partner can sign.'],
  ['Authorised signing', 'Only an authorised partner with the required FRC number can sign.'],
  ['Locked when signed', 'Signed files are locked against further changes.'],
  ['Recorded changes', 'Changes made before signing are recorded in the audit trail.'],
  ['Separated firm data', "Each firm's data is separated from other firms' data."],
  ['AI under partner control', 'AI assistance is optional and controlled by a partner.'],
];

const SCOPE =
  'Current product scope: companies reporting under IFRS for SMEs that are not public interest entities. The current documented edition follows the 2015 second edition of IFRS for SMEs; the 2025 third edition requires assessment and updating. Certain complex consolidation scenarios and other specialist requirements are not currently supported. Firms should verify the applicable standards and product scope before relying on an engagement file.';

const ENGAGEMENT_COPY: Record<string, { name: string; text: string }> = {
  compilation: { name: 'One Compilation', text: 'Financial statements compiled from the client’s records, with a compilation report.' },
  review: { name: 'One Review', text: 'A review engagement with analytical review, a work programme and a review report.' },
  audit: { name: 'One Audit', text: 'A full audit file: planning, ledger and bank testing, evidence and the audit report.' },
  group: { name: 'Group Consolidation Add-on', text: 'Added to a single engagement for a parent with subsidiaries. Priced on top of the engagement.' },
};

interface Pricing {
  plans: { code: string; name: string; price: number | null; users: number | null; engagements: number | null }[];
  engagements: { code: string; price: number | null }[];
  vatPercent: number | null;
  foundingLeft: number;
  live: boolean;
}
const fallback = (): Pricing => ({
  plans: FALLBACK_PRICING.plans.map((p) => ({ code: p.code, name: p.name, price: p.priceNaira, users: p.users, engagements: p.engagements })),
  engagements: FALLBACK_PRICING.engagements.map((p) => ({ code: p.code, price: p.priceNaira })),
  vatPercent: null,
  foundingLeft: 0,
  live: false,
});
const fromLive = (d: PublicPrices): Pricing => ({
  plans: d.plans.map((p) => ({ code: p.code, name: p.name, price: p.priceKobo > 0 ? p.priceKobo / 100 : null, users: p.maxUsers, engagements: p.maxEngagements })),
  engagements: d.engagementPrices.map((p) => ({ code: p.code, price: p.priceKobo > 0 ? p.priceKobo / 100 : null })),
  vatPercent: d.vatPercent,
  foundingLeft: d.foundingLeft,
  live: true,
});

function PlanCard({ p, founding, featured }: { p: Pricing['plans'][number]; founding: boolean; featured: boolean }) {
  return (
    <article className={`lp-plan${featured ? ' featured' : ''}`} aria-label={`${p.name} plan`}>
      <header>
        <h3>{p.name}</h3>
        {founding && p.price !== null && FOUNDING_BADGE && <span className="lp-badge">{FOUNDING_BADGE}</span>}
      </header>
      {p.price === null ? (
        <p className="lp-price none">Contact us for pricing</p>
      ) : (
        <div>
          <p className="lp-price">
            {naira(p.price)} <span>a year</span>
          </p>
          {founding && (
            <p className="lp-sub">
              Founding firms pay {naira((p.price * FOUNDING_PERCENT_OF_PRICE) / 100)} in their first year.
            </p>
          )}
        </div>
      )}
      <ul>
        <li>{p.users === null ? 'Unlimited users' : `Up to ${p.users} users`}</li>
        <li>{p.engagements === null ? 'Engagement allowance to be confirmed' : `${p.engagements} new engagements a year`}</li>
        <li>Audit, review and compilation files</li>
        <li>Consolidation, client requests and quality management</li>
      </ul>
      <Go to={CTA.getStarted} className={`lp-btn ${featured ? 'solid' : 'line'}`}>
        Choose {p.name}
      </Go>
    </article>
  );
}

const FAQ: [string, string][] = [
  ['What types of engagements does VeritBooks support?', 'Audit, review and compilation engagements for companies within the current documented product scope.'],
  ['Can I import accounting data from other systems?', 'Yes. The documented import formats include CSV, Excel and PDF for specified data types. Guides are provided for Sage 50, QuickBooks Desktop and Tally. Direct Zoho Books integration is planned but currently on hold.'],
  ['Can my clients upload supporting documents?', 'Yes. You can create a secure, time-limited upload link. Clients do not need to create an account.'],
  ['Does VeritBooks decide the audit opinion?', 'No. The responsible professional makes the judgement. VeritBooks supports report preparation and completion checks but does not choose the opinion.'],
  ['Can VeritBooks consolidate group accounts?', 'Yes, for supported consolidation scenarios involving subsidiaries, associates, joint ventures and relevant adjustments. Certain complex scenarios remain outside the documented scope.'],
  ['Does the platform support AI?', 'Optional AI assistance provides suggestions for specified tasks. A partner must enable it, and professionals remain responsible for reviewing and deciding what to use.'],
  ['How much does VeritBooks cost?', 'There are yearly Solo, Practice and Firm subscriptions, and you can pay for an individual engagement instead. Current prices are in the pricing section above. Every new firm starts with a 14 day free trial.'],
  ['Can a signed file be edited?', 'No. A signed engagement file is locked. Changes before signing are recorded in the audit trail.'],
  ['What is the current product scope?', SCOPE],
];

export function Landing() {
  const [pricing, setPricing] = useState<Pricing>(fallback);
  const [contact, setContact] = useState<string | null>(LINKS.contactEmail);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    let live = true;
    repo
      .publicPrices()
      .then((d) => {
        if (!live) return;
        if (d.plans.length) setPricing(fromLive(d));
        if (d.supportEmail) setContact(d.supportEmail);
      })
      .catch(() => undefined); // the fallback stays: "Contact us for pricing"
    return () => {
      live = false;
    };
  }, []);

  const founding = pricing.live && pricing.foundingLeft > 0;
  const nav = [
    ['#features', 'Features'],
    ['#how', 'How it works'],
    ['#pricing', 'Pricing'],
    ['#faq', 'FAQ'],
  ];
  return (
    <div className="lp">
      <a className="lp-skip" href="#main">
        Skip to content
      </a>
      {repo.mode === 'demo' && <div className="lp-demo">Demo mode. Data is kept in this browser only.</div>}
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <a href="#top" aria-label="Top of page">
            <Logo />
          </a>
          <button className="lp-menu" aria-expanded={menu} aria-controls="lp-links" onClick={() => setMenu(!menu)}>
            Menu
          </button>
          <nav id="lp-links" className={menu ? 'open' : ''} aria-label="Sections">
            {nav.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenu(false)}>
                {label}
              </a>
            ))}
            <Go to={CTA.signIn} className="lp-signin">
              Sign in
            </Go>
            <Go to={CTA.getStarted} className="lp-btn solid small">
              Get Started
            </Go>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="lp-hero" id="top">
          <div className="lp-wrap lp-hero-in">
            <div>
              <p className="lp-eyebrow">Accounting &amp; Audit Software</p>
              <h1>From trial balance to signed financial statements.</h1>
              <p className="lp-lead">
                Prepare financial statements, manage audit and review engagements, organise supporting evidence and take your client files through a structured, partner-controlled sign-off process, all in one workspace.
              </p>
              <div className="lp-cta">
                <Go to={CTA.getStarted} className="lp-btn solid">
                  Get Started
                </Go>
                <Go to={CTA.explore} className="lp-btn line">
                  Explore Features
                </Go>
              </div>
              <p className="lp-sub">14 day free trial. No card needed to start.</p>
              <ul className="lp-attrs">
                <li>Audit, Review &amp; Compilation</li>
                <li>IFRS for SMEs</li>
                <li>Built for Nigerian Accounting Firms</li>
              </ul>
            </div>
            <figure className={`lp-photo${HERO.placeholder ? ' placeholder' : ''}`}>
              <img src={HERO.src} alt={HERO.alt} width={1600} height={900} fetchPriority="high" decoding="async" />
            </figure>
          </div>
        </section>

        <section className="lp-section" id="features">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2>Everything your engagement needs, in one file.</h2>
              <p>Bring the client's figures, professional work, supporting evidence, financial statements and signed report together in one structured engagement file.</p>
            </div>
            <div className="lp-cards">
              {FEATURES.map((f) => (
                <article key={f.label} className="lp-card">
                  <Icon name={f.icon} />
                  <p className="lp-label">{f.label}</p>
                  <h3>{f.head}</h3>
                  <p>{f.text}</p>
                  {f.groups.map((g, i) => (
                    <div key={i}>
                      {g.title && <p className="lp-group">{g.title}</p>}
                      <ul>
                        {g.items.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section alt" id="how">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2>How it works</h2>
              <p>Four stages take a client file from raw figures to a signed report.</p>
            </div>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.head}>
                  <span className="lp-dot">
                    <Icon name={s.icon} />
                  </span>
                  <p className="lp-label">Step {i + 1}</p>
                  <h3>{s.head}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-section" id="firms">
          <div className="lp-wrap lp-split">
            <div>
              <h2>Designed around the way professional firms work.</h2>
              <ul className="lp-ticks">
                {FIRM.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <figure className="lp-shot">
              <img src="/landing/screen-signoff.png" alt="The VeritBooks sign-off step, listing the checks a file must pass before a partner can sign" loading="lazy" decoding="async" width={1280} height={900} />
              <figcaption>The sign-off step in VeritBooks, shown with sample data.</figcaption>
            </figure>
          </div>
        </section>

        <section className="lp-section alt" id="ai">
          <div className="lp-wrap lp-split">
            <div>
              <h2>AI assistance. Professional judgement stays with you.</h2>
              <p>When a partner turns it on, AI assistance can suggest:</p>
              <ul className="lp-ticks">
                {AI.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <blockquote className="lp-quote">
              VeritBooks supports professional judgement; it does not replace it. AI does not choose an audit opinion, conclude on a test or sign an engagement. Suggestions require human review.
            </blockquote>
          </div>
        </section>

        <section className="lp-section" id="pricing">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2>Simple pricing for the way your firm works.</h2>
              <p>Choose a yearly subscription for ongoing practice work or pay for an individual engagement when you need it.</p>
            </div>
            <h3 className="lp-kicker">Yearly plans</h3>
            <div className="lp-plans">
              {pricing.plans.map((p, i) => (
                <PlanCard key={p.code} p={p} founding={founding} featured={i === 1} />
              ))}
            </div>
            <h3 className="lp-kicker">Single engagements</h3>
            <div className="lp-singles">
              {pricing.engagements.map((e) => {
                const copy = ENGAGEMENT_COPY[e.code];
                if (!copy) return null;
                return (
                  <article key={e.code} className={`lp-single${e.code === 'group' ? ' addon' : ''}`}>
                    <h4>{copy.name}</h4>
                    <p>{copy.text}</p>
                    <p className={`lp-price small${e.price === null ? ' none' : ''}`}>{e.price === null ? 'Contact us for pricing' : `${e.code === 'group' ? '+ ' : ''}${naira(e.price)}`}</p>
                    <Go to={CTA.getStarted} className="lp-btn line small">
                      {e.code === 'group' ? 'Add to an engagement' : 'Get Started'}
                    </Go>
                  </article>
                );
              })}
            </div>
            <aside className="lp-founding" aria-label="Founding customer pricing">
              <h3>Founding customer pricing</h3>
              <p>
                Your founding-firm price is protected for two years from the date you join. New prices apply to your next payment, and founding firms retain the price applicable when they joined until their two-year founding period ends.
              </p>
              {founding && <p className="lp-sub">{pricing.foundingLeft} of 20 founding places are open.</p>}
            </aside>
            <p className="lp-note">
              {pricing.vatPercent ? `Prices are before VAT at ${pricing.vatPercent}%. ` : ''}Applicable taxes and payment terms are shown before checkout. You create an account first, then choose a plan or a single engagement inside the app. Nothing is charged when you sign up.
            </p>
          </div>
        </section>

        <section className="lp-section alt" id="trust">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2>Built for traceability and accountable sign-off.</h2>
              <p>These are the rules the software applies to every file.</p>
            </div>
            <dl className="lp-trust">
              {TRUST.map(([t, d]) => (
                <div key={t}>
                  <dt>{t}</dt>
                  <dd>{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="lp-section" id="faq">
          <div className="lp-wrap lp-narrow">
            <div className="lp-head">
              <h2>Frequently asked questions</h2>
            </div>
            <div className="lp-faq">
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap">
            <h2>Bring your next engagement into one structured workflow.</h2>
            <p>Prepare financial statements, organise evidence and manage engagement completion with VeritBooks.</p>
            <div className="lp-cta">
              <Go to={CTA.getStarted} className="lp-btn invert">
                Get Started
              </Go>
              <Go to={CTA.explore} className="lp-btn ghost">
                Explore the Platform
              </Go>
            </div>
            <p className="lp-sub">Built for professional accountants and audit firms in Nigeria.</p>
          </div>
        </section>
      </main>

      <footer className="lp-footer" id="contact">
        <div className="lp-wrap lp-foot">
          <div>
            <LogoTile />
            <p>An engagement platform for audit, review and compilation work, from trial balance to signed financial statements.</p>
          </div>
          <nav aria-label="Footer">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <Go to={CTA.signIn}>Sign in</Go>
          </nav>
          <div className="lp-legal">
            {contact ? <a href={`mailto:${contact}`}>Contact: {contact}</a> : <span>Contact details to be published</span>}
            {LINKS.privacy ? <Go to={LINKS.privacy}>Privacy Policy</Go> : <span>Privacy Policy, to be published</span>}
            {LINKS.terms ? <Go to={LINKS.terms}>Terms of Service</Go> : <span>Terms of Service, to be published</span>}
          </div>
        </div>
        <div className="lp-wrap">
          <p className="lp-scope">{SCOPE}</p>
          <p className="lp-copy">© {new Date().getFullYear()} VeritBooks</p>
        </div>
      </footer>
    </div>
  );
}

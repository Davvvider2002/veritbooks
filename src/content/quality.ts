/**
 * Starting material for a firm's system of quality management under ISQM 1.
 *
 * STATUS: starter content, version 0.1. These risks and responses show how the register works.
 * ISQM 1 requires each firm to identify its own quality risks from its own circumstances.
 * A firm must tailor this list, and a qualified person must review it, before relying on it.
 */
export const QUALITY_VERSION = '0.1-starter';

export type Component = 'governance' | 'ethics' | 'acceptance' | 'performance' | 'resources' | 'information' | 'monitoring';

export const COMPONENTS: { id: Component; label: string }[] = [
  { id: 'governance', label: 'Governance and leadership' },
  { id: 'ethics', label: 'Relevant ethical requirements' },
  { id: 'acceptance', label: 'Acceptance and continuance' },
  { id: 'performance', label: 'Engagement performance' },
  { id: 'resources', label: 'Resources' },
  { id: 'information', label: 'Information and communication' },
  { id: 'monitoring', label: 'Monitoring and remediation' },
];
export const COMPONENT_LABEL = Object.fromEntries(COMPONENTS.map((c) => [c.id, c.label])) as Record<Component, string>;

export const SEVERITIES = [
  { id: 'finding', label: 'Finding, not a deficiency' },
  { id: 'deficiency', label: 'Deficiency' },
  { id: 'severe', label: 'Severe deficiency' },
  { id: 'pervasive', label: 'Severe and pervasive deficiency' },
] as const;
export type Severity = (typeof SEVERITIES)[number]['id'];

export const CONCLUSIONS = {
  effective: 'The system gives reasonable assurance that its objectives are being achieved.',
  effective_except: 'Except for the deficiencies identified, which are severe but not pervasive, the system gives reasonable assurance that its objectives are being achieved.',
  not_effective: 'The system does not give reasonable assurance that its objectives are being achieved.',
} as const;
export type Conclusion = keyof typeof CONCLUSIONS;

export const STARTER_RISKS: { component: Component; title: string; detail: string; response: string }[] = [
  { component: 'governance', title: 'Commercial pressure outweighs quality', detail: 'Fee targets or client relationships lead partners to accept shortcuts.', response: 'Partner appraisal weighs quality results ahead of fees. Quality is a standing item at partner meetings.' },
  { component: 'governance', title: 'Responsibility for quality is unclear', detail: 'No named person is accountable for the system or for parts of it.', response: 'The managing partner holds ultimate responsibility. Operational responsibility for each component is assigned by name and recorded here.' },
  { component: 'ethics', title: 'Threats to independence are not identified', detail: 'A team member holds an interest in, or has a relationship with, a client and it is not known.', response: 'Annual independence declarations from all staff. A confirmation from each team member on every engagement, recorded in the file before sign-off.' },
  { component: 'ethics', title: 'Long association with a client', detail: 'The same partner signs for many years and familiarity weakens scepticism.', response: 'Years of service by partner are tracked for each client. Rotation or a safeguard is considered after an agreed number of years.' },
  { component: 'ethics', title: 'Non-audit services impair independence', detail: 'The firm prepares the accounts or gives tax advice to a client it also audits.', response: 'Each non-audit service is approved by the engagement partner with the threats and safeguards documented.' },
  { component: 'acceptance', title: 'A client is accepted without understanding its integrity', detail: 'The firm takes on a client whose owners or business expose it to undue risk.', response: 'Acceptance checks on owners and directors, with partner approval, before an engagement letter is issued.' },
  { component: 'acceptance', title: 'The firm lacks the competence or time for an engagement', detail: 'Work is accepted in a sector or of a size the firm cannot properly staff.', response: 'Acceptance and continuance record the skills, time and any specialist needed, and who will provide them.' },
  { component: 'acceptance', title: 'A public interest entity is audited under the wrong methodology', detail: 'A listed or regulated entity is taken through a file designed for smaller companies.', response: 'Every engagement confirms the entity is not a public interest entity before it is opened.' },
  { component: 'performance', title: 'Work is not reviewed before the report is signed', detail: 'The partner signs without evidence of supervision and review.', response: 'The file cannot be signed until every programme step is complete and the partner has confirmed their review.' },
  { component: 'performance', title: 'Difficult or contentious matters are not consulted on', detail: 'A judgement is taken by one person without challenge.', response: 'A consultation policy names the matters that must be discussed with a second partner or an external reviewer, and how the conclusion is recorded.' },
  { component: 'performance', title: 'Files are changed after the report date', detail: 'Documentation is added or altered once the report is issued.', response: 'Files lock at signing and cannot be changed. Every change before then is recorded in the audit trail.' },
  { component: 'resources', title: 'Staff lack current technical knowledge', detail: 'Changes in standards, tax or company law are missed.', response: 'A training plan each year, with attendance recorded. Institute continuing education requirements are tracked.' },
  { component: 'resources', title: 'Technology or methodology content is out of date', detail: 'Programmes, checklists or report wording no longer reflect the standards in force.', response: 'Content is versioned and reviewed when standards change. Starter content is replaced by reviewed content before use.' },
  { component: 'information', title: 'Quality matters are not communicated to staff', detail: 'Findings and changes to policy do not reach the people doing the work.', response: 'The register and findings are visible to all staff. Changes are briefed at staff meetings and recorded.' },
  { component: 'monitoring', title: 'Completed engagements are not inspected', detail: 'No one looks back at finished files, so repeated weaknesses go unseen.', response: 'At least one completed file for each partner is inspected on a cycle, by someone not involved in it. Findings are logged here with a root cause and an action.' },
  { component: 'monitoring', title: 'Deficiencies are identified but not fixed', detail: 'Actions are agreed and then left.', response: 'Each finding has an owner and a due date. Overdue actions are reviewed by the managing partner each quarter.' },
];

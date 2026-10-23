import type { EngagementType, ReportSettings } from './types';
import { frameworkText, JURISDICTIONS, type Jurisdiction } from '../content/jurisdictions';

export interface ReportInput {
  type: EngagementType;
  clientName: string;
  yearEnd: string; // ISO date
  settings: ReportSettings;
  hasCashFlow: boolean;
  /** True when the client is a parent with subsidiaries, and the report covers the group as well as the company. */
  group?: boolean;
  /** True when the consolidated statement of cash flows is among the statements. */
  groupCashFlow?: boolean;
  /** Where the firm practises. Nigeria when not given. */
  jurisdiction?: Jurisdiction;
  /** A not-for-profit: who governs it and who the report is addressed to. */
  npo?: { governors: { plural: string; possessive: string }; addressee: string };
}

export interface ReportSection {
  heading: string;
  paragraphs: string[];
}

export interface DraftReport {
  title: string;
  addressee: string;
  sections: ReportSection[];
}

export const longDate = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

const OPINION_HEADING = {
  unmodified: 'Opinion',
  qualified: 'Qualified opinion',
  adverse: 'Adverse opinion',
  disclaimer: 'Disclaimer of opinion',
} as const;

/**
 * Draft report wording. The structure follows the elements an auditor's report carries
 * (opinion, basis, responsibilities, other legal requirements). The wording is a starting
 * draft for the engagement partner, who owns the opinion and must review every paragraph
 * against the current standards and the companies law of the firm's country.
 */
export function draftReport(i: ReportInput): DraftReport {
  const company = companyReport(i);
  const r = i.group ? groupReport(company, i) : company;
  return i.npo ? npoReport(r, i.npo) : r;
}

/**
 * Rewords a report for a not-for-profit: its statements are of income and expenditure and of
 * changes in funds, it is governed by trustees, directors or a board, and it is an organisation.
 */
function npoReport(r: DraftReport, n: NonNullable<ReportInput['npo']>): DraftReport {
  const reword = (p: string) =>
    p
      .replace(/the statements? of profit or loss( and other comprehensive income)?/g, 'the statement of income and expenditure')
      .replace(/the statement of changes in equity/g, 'the statement of changes in funds')
      .replace(/\bThe directors’/g, `The ${n.governors.possessive}`)
      .replace(/\bthe directors’/g, `the ${n.governors.possessive}`)
      .replace(/\bThe directors\b/g, `The ${n.governors.plural}`)
      .replace(/\bthe directors\b/g, `the ${n.governors.plural}`)
      .replace(/\bthe company’s\b/g, 'the organisation’s')
      .replace(/\bthe company\b/g, 'the organisation')
      .replace(/statement of profit or loss/g, 'statement of income and expenditure');
  return {
    title: r.title,
    addressee: n.addressee,
    sections: r.sections.map((s) => ({ heading: reword(s.heading), paragraphs: s.paragraphs.map(reword) })),
  };
}

/**
 * Rewords a company report to cover the consolidated statements as well. A parent presents
 * consolidated and separate financial statements together, under one report.
 * Starter wording, like the rest: the partner must check it against ISA 700 and ISA 600 (Revised).
 */
function groupReport(r: DraftReport, i: ReportInput): DraftReport {
  const name = i.clientName;
  const date = longDate(i.yearEnd);
  const cash = i.hasCashFlow;
  const single =
    `the statement of financial position as at ${date}, the statement of profit or loss, ` +
    `the statement of changes in equity${cash ? ' and the statement of cash flows' : ''} ` +
    'for the year then ended, and the notes to the financial statements, including a summary of significant accounting policies';
  const both =
    `the consolidated and separate statements of financial position as at ${date}, the consolidated and separate statements of profit or loss` +
    `${i.groupCashFlow ? ', the consolidated statement of changes in equity and the consolidated statement of cash flows' : ' and the consolidated statement of changes in equity'}, ` +
    `the separate statement of changes in equity${cash ? ' and the separate statement of cash flows' : ''} ` +
    'for the year then ended, and the notes to the consolidated and separate financial statements, including a summary of significant accounting policies';
  const reword = (p: string) =>
    p
      .replace(single, both)
      .replace(`financial statements of ${name}`, `consolidated and separate financial statements of ${name} (the Company) and its subsidiaries (together, the Group)`)
      .replace(`the financial position of ${name} as at ${date}, and its financial performance${cash ? ' and cash flows' : ''}`, `the consolidated and separate financial position of the Group and the Company as at ${date}, and their consolidated and separate financial performance${cash ? ' and cash flows' : ''}`)
      .replace(/(?<!separate )financial statements/g, 'consolidated and separate financial statements')
      .replace(/\bthe company’s\b/g, 'the Group’s and the Company’s')
      .replace(/\bthe company\b/g, 'the Group and the Company');
  const sections = r.sections.map((s) => ({ heading: reword(s.heading), paragraphs: s.paragraphs.map(reword) }));
  const duties = sections.find((s) => s.heading.startsWith('Auditor’s responsibilities'));
  if (i.type === 'audit' && duties && (i.settings.opinion ?? 'unmodified') !== 'disclaimer') {
    duties.paragraphs.push(
      'We plan and perform the group audit to obtain sufficient appropriate audit evidence regarding the financial information of the entities or business units within the Group, as a basis for forming an opinion on the consolidated financial statements. We are responsible for the direction, supervision and review of the audit work performed for the purposes of the group audit. We remain solely responsible for our audit opinion.',
    );
  }
  return { title: r.title, addressee: r.addressee, sections };
}

/** The conclusion of a review report, which the practitioner may modify as an auditor modifies an opinion. */
function reviewConclusion(i: ReportInput, fair: string): ReportSection[] {
  const kind = i.settings.opinion ?? 'unmodified';
  const basis = i.settings.basis?.trim() || '[The practitioner must describe the matter giving rise to the modification.]';
  if (kind === 'unmodified')
    return [{ heading: 'Conclusion', paragraphs: [`Based on our review, nothing has come to our attention that causes us to believe that these financial statements do not present fairly, in all material respects, ${fair}.`] }];
  const name = { qualified: 'qualified conclusion', adverse: 'adverse conclusion', disclaimer: 'disclaimer of conclusion' }[kind];
  const text = {
    qualified: `Based on our review, except for the effects of the matter described in the Basis for qualified conclusion paragraph, nothing has come to our attention that causes us to believe that these financial statements do not present fairly, in all material respects, ${fair}.`,
    adverse: `Based on our review, due to the significance of the matter described in the Basis for adverse conclusion paragraph, these financial statements do not present fairly, in all material respects, ${fair}.`,
    disclaimer: 'Due to the significance of the matter described in the Basis for disclaimer of conclusion paragraph, we were unable to obtain sufficient appropriate evidence to form a conclusion on the accompanying financial statements. Accordingly, we do not express a conclusion on these financial statements.',
  }[kind];
  return [
    { heading: `Basis for ${name}`, paragraphs: [basis] },
    { heading: `${name[0].toUpperCase()}${name.slice(1)}`, paragraphs: [text] },
  ];
}

function companyReport(i: ReportInput): DraftReport {
  const date = longDate(i.yearEnd);
  const list =
    `the statement of financial position as at ${date}, the statement of profit or loss, ` +
    `the statement of changes in equity${i.hasCashFlow ? ' and the statement of cash flows' : ''} ` +
    `for the year then ended, and the notes to the financial statements, including a summary of significant accounting policies`;
  const j = i.jurisdiction ?? JURISDICTIONS.NG;
  const framework = frameworkText(j);

  if (i.type === 'compilation') {
    return {
      title: 'Practitioner’s compilation report',
      addressee: `To the directors of ${i.clientName}`,
      sections: [
        {
          heading: '',
          paragraphs: [
            `We have compiled the accompanying financial statements of ${i.clientName} from information the directors provided. They comprise ${list}.`,
            'We performed this engagement in accordance with International Standard on Related Services 4410 (Revised), Compilation Engagements. We applied our expertise in accounting and financial reporting to assist the directors in preparing and presenting these statements, and we complied with relevant ethical requirements.',
            'These financial statements and the accuracy and completeness of the information used to compile them are the responsibility of the directors.',
            `A compilation is not an assurance engagement. We are not required to verify the accuracy or completeness of the information provided to us. Accordingly, we do not express an audit opinion or a review conclusion on whether these financial statements are prepared in accordance with ${framework}.`,
          ],
        },
      ],
    };
  }

  if (i.type === 'review') {
    return {
      title: 'Independent practitioner’s review report',
      addressee: `To the members of ${i.clientName}`,
      sections: [
        {
          heading: '',
          paragraphs: [`We have reviewed the accompanying financial statements of ${i.clientName}, which comprise ${list}.`],
        },
        {
          heading: 'Directors’ responsibility',
          paragraphs: [
            `The directors are responsible for the preparation and fair presentation of these financial statements in accordance with ${framework}, and for such internal control as they determine is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.`,
          ],
        },
        {
          heading: 'Practitioner’s responsibility',
          paragraphs: [
            'Our responsibility is to express a conclusion on the financial statements. We conducted our review in accordance with International Standard on Review Engagements 2400 (Revised). That standard requires us to conclude whether anything has come to our attention that causes us to believe the statements are not prepared, in all material respects, in accordance with the framework, and to comply with relevant ethical requirements.',
            'A review is a limited assurance engagement. It consists mainly of enquiries of management and others, and analytical procedures. The procedures are substantially less than those performed in an audit, and we do not express an audit opinion.',
          ],
        },
        ...reviewConclusion(i, `the financial position of ${i.clientName} as at ${date}, and its financial performance${i.hasCashFlow ? ' and cash flows' : ''} for the year then ended, in accordance with ${framework}`),
        ...(i.settings.emphasis?.trim()
          ? [{ heading: 'Emphasis of matter', paragraphs: [i.settings.emphasis.trim(), 'Our conclusion is not modified in respect of this matter.'] }]
          : []),
      ],
    };
  }

  const opinion = i.settings.opinion ?? 'unmodified';
  const basis = i.settings.basis?.trim() || '[The engagement partner must describe the matter giving rise to the modification.]';
  const fair = `the financial position of ${i.clientName} as at ${date}, and its financial performance${i.hasCashFlow ? ' and cash flows' : ''} for the year then ended in accordance with ${framework}`;

  const opinionText = {
    unmodified: `In our opinion, the accompanying financial statements give a true and fair view of ${fair}.`,
    qualified: `In our opinion, except for the effects of the matter described in the Basis for qualified opinion section of our report, the accompanying financial statements give a true and fair view of ${fair}.`,
    adverse: `In our opinion, because of the significance of the matter described in the Basis for adverse opinion section of our report, the accompanying financial statements do not give a true and fair view of ${fair}.`,
    disclaimer: `We do not express an opinion on the accompanying financial statements. Because of the significance of the matter described in the Basis for disclaimer of opinion section of our report, we have not been able to obtain sufficient appropriate audit evidence to provide a basis for an audit opinion.`,
  }[opinion];

  const intro =
    opinion === 'disclaimer'
      ? `We were engaged to audit the financial statements of ${i.clientName}, which comprise ${list}.`
      : `We have audited the financial statements of ${i.clientName}, which comprise ${list}.`;

  const independent =
    j.independence ??
    `We are independent of the company in accordance with the ethical requirements relevant to our audit of the financial statements in ${j.inName}, and we have fulfilled our other ethical responsibilities in accordance with those requirements.`;
  const standards = `We conducted our audit in accordance with International Standards on Auditing. Our responsibilities under those standards are described in the Auditor’s responsibilities section of our report. ${independent}`;

  const basisParagraphs = {
    unmodified: [standards, 'We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.'],
    qualified: [basis, standards, 'We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our qualified opinion.'],
    adverse: [basis, standards, 'We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our adverse opinion.'],
    disclaimer: [basis],
  }[opinion];

  // Paragraphs the partner adds. Each is written by the partner: the software supplies the heading
  // and the sentence the standards require after it. None appears in a disclaimer of opinion.
  const s = i.settings;
  const added: ReportSection[] = [];
  if (opinion !== 'disclaimer') {
    if (s.goingConcern?.trim() && opinion !== 'adverse')
      added.push({ heading: 'Material uncertainty related to going concern', paragraphs: [s.goingConcern.trim(), 'Our opinion is not modified in respect of this matter.'] });
    if (s.emphasis?.trim()) added.push({ heading: 'Emphasis of matter', paragraphs: [s.emphasis.trim(), 'Our opinion is not modified in respect of this matter.'] });
    if (s.otherMatter?.trim()) added.push({ heading: 'Other matter', paragraphs: [s.otherMatter.trim()] });
    added.push({
      heading: 'Other information',
      paragraphs: [
        `The directors are responsible for the other information. The other information comprises ${j.nationalStatements ? 'the report of the directors, the statement of directors’ responsibilities, the statement of value added and the financial summary' : 'the report of the directors and the statement of directors’ responsibilities'}, which we obtained before the date of this report. It does not include the financial statements and our auditor’s report on them.`,
        'Our opinion on the financial statements does not cover the other information and we do not express any form of assurance conclusion on it.',
        'In connection with our audit of the financial statements, our responsibility is to read the other information and, in doing so, consider whether it is materially inconsistent with the financial statements or our knowledge obtained in the audit, or otherwise appears to be materially misstated. If, based on the work we have performed, we conclude that there is a material misstatement of the other information, we are required to report that fact.',
        s.otherInformation?.trim() ? s.otherInformation.trim() : 'We have nothing to report in this regard.',
      ],
    });
  }

  const sections: ReportSection[] = [
    { heading: OPINION_HEADING[opinion], paragraphs: [intro, opinionText] },
    { heading: `Basis for ${OPINION_HEADING[opinion].toLowerCase()}`, paragraphs: basisParagraphs },
    ...added,
    {
      heading: 'Responsibilities of the directors for the financial statements',
      paragraphs: [
        `The directors are responsible for the preparation of financial statements that give a true and fair view in accordance with ${framework}, and for such internal control as they determine is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.`,
        'In preparing the financial statements, the directors are responsible for assessing the company’s ability to continue as a going concern, disclosing matters related to going concern where applicable, and using the going concern basis of accounting unless they intend to liquidate the company or to cease operations, or have no realistic alternative but to do so.',
      ],
    },
    {
      heading: 'Auditor’s responsibilities for the audit of the financial statements',
      paragraphs:
        opinion === 'disclaimer'
          ? [
              'Our responsibility is to conduct an audit of the company’s financial statements in accordance with International Standards on Auditing and to issue an auditor’s report. However, because of the matter described in the Basis for disclaimer of opinion section, we were not able to obtain sufficient appropriate audit evidence to provide a basis for an audit opinion.',
              independent,
            ]
          : [
              'Our objectives are to obtain reasonable assurance about whether the financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor’s report that includes our opinion. Reasonable assurance is a high level of assurance, but it is not a guarantee that an audit conducted in accordance with International Standards on Auditing will always detect a material misstatement when it exists.',
              'Misstatements can arise from fraud or error. They are considered material if, individually or in aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these financial statements.',
              'As part of an audit we exercise professional judgment and maintain professional scepticism throughout. We identify and assess the risks of material misstatement, design and perform procedures responsive to those risks, obtain an understanding of internal control relevant to the audit, evaluate the accounting policies used and the estimates made by the directors, conclude on the appropriateness of the going concern basis, and evaluate the overall presentation of the financial statements. We communicate with the directors regarding the planned scope and timing of the audit and significant audit findings.',
            ],
    },
    ...(j.statutoryConfirmations && j.companiesAct
      ? [
          {
            heading: 'Report on other legal and regulatory requirements',
            paragraphs: [
              `In accordance with the requirements of ${j.companiesAct}, we confirm that:`,
              '(i) we have obtained all the information and explanations which, to the best of our knowledge and belief, were necessary for the purpose of our audit;',
              '(ii) in our opinion, proper books of account have been kept by the company, so far as appears from our examination of those books; and',
              '(iii) the company’s statement of financial position and statement of profit or loss are in agreement with the books of account.',
            ],
          },
        ]
      : []),
  ];

  return {
    title: 'Independent auditor’s report',
    addressee: `To the members of ${i.clientName}`,
    sections,
  };
}

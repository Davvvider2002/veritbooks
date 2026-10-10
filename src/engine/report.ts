import type { EngagementType, ReportSettings } from './types';

export interface ReportInput {
  type: EngagementType;
  clientName: string;
  yearEnd: string; // ISO date
  settings: ReportSettings;
  hasCashFlow: boolean;
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
 * against the current standards and the Companies and Allied Matters Act 2020.
 */
export function draftReport(i: ReportInput): DraftReport {
  const date = longDate(i.yearEnd);
  const list =
    `the statement of financial position as at ${date}, the statement of profit or loss, ` +
    `the statement of changes in equity${i.hasCashFlow ? ' and the statement of cash flows' : ''} ` +
    `for the year then ended, and the notes to the financial statements, including a summary of significant accounting policies`;
  const framework =
    'the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011';

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
        {
          heading: 'Conclusion',
          paragraphs: [
            `Based on our review, nothing has come to our attention that causes us to believe that these financial statements do not present fairly, in all material respects, the financial position of ${i.clientName} as at ${date}, and its financial performance${i.hasCashFlow ? ' and cash flows' : ''} for the year then ended, in accordance with ${framework}.`,
          ],
        },
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

  const standards =
    'We conducted our audit in accordance with International Standards on Auditing. Our responsibilities under those standards are described in the Auditor’s responsibilities section of our report. We are independent of the company in accordance with the ethical requirements relevant to our audit of the financial statements in Nigeria, and we have fulfilled our other ethical responsibilities in accordance with those requirements.';

  const basisParagraphs = {
    unmodified: [standards, 'We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.'],
    qualified: [basis, standards, 'We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our qualified opinion.'],
    adverse: [basis, standards, 'We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our adverse opinion.'],
    disclaimer: [basis],
  }[opinion];

  const sections: ReportSection[] = [
    { heading: OPINION_HEADING[opinion], paragraphs: [intro, opinionText] },
    { heading: `Basis for ${OPINION_HEADING[opinion].toLowerCase()}`, paragraphs: basisParagraphs },
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
              'We are independent of the company in accordance with the ethical requirements relevant to our audit of the financial statements in Nigeria, and we have fulfilled our other ethical responsibilities in accordance with those requirements.',
            ]
          : [
              'Our objectives are to obtain reasonable assurance about whether the financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor’s report that includes our opinion. Reasonable assurance is a high level of assurance, but it is not a guarantee that an audit conducted in accordance with International Standards on Auditing will always detect a material misstatement when it exists.',
              'Misstatements can arise from fraud or error. They are considered material if, individually or in aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these financial statements.',
              'As part of an audit we exercise professional judgment and maintain professional scepticism throughout. We identify and assess the risks of material misstatement, design and perform procedures responsive to those risks, obtain an understanding of internal control relevant to the audit, evaluate the accounting policies used and the estimates made by the directors, conclude on the appropriateness of the going concern basis, and evaluate the overall presentation of the financial statements. We communicate with the directors regarding the planned scope and timing of the audit and significant audit findings.',
            ],
    },
    {
      heading: 'Report on other legal and regulatory requirements',
      paragraphs: [
        'In accordance with the requirements of the Companies and Allied Matters Act 2020, we confirm that:',
        '(i) we have obtained all the information and explanations which, to the best of our knowledge and belief, were necessary for the purpose of our audit;',
        '(ii) in our opinion, proper books of account have been kept by the company, so far as appears from our examination of those books; and',
        '(iii) the company’s statement of financial position and statement of profit or loss are in agreement with the books of account.',
      ],
    },
  ];

  return {
    title: 'Independent auditor’s report',
    addressee: `To the members of ${i.clientName}`,
    sections,
  };
}

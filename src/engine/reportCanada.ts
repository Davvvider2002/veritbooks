import type { DraftReport, ReportInput, ReportSection } from './report';
import { longDate } from './report';

/**
 * Canadian report wording: the auditor's report under the Canadian Auditing Standards (CAS 700),
 * the review engagement report under CSRE 2400, and the compilation engagement report under
 * CSRS 4200, for statements under ASPE or, for a not-for-profit, ASNPO.
 *
 * The structure follows the illustrative reports CPA Canada publishes with each standard. Starter
 * wording: the engagement partner must check every paragraph against the standards in force,
 * including CAS 240 and CAS 570 as revised for periods beginning on or after 15 December 2026.
 */

export interface CanadaReportInput extends ReportInput {
  /** Compilation only: the basis of accounting is not ASPE, so the report names Note 1 instead. */
  specialBasis?: boolean;
}

/** The statements a Canadian set comprises, in the words a Canadian report uses. */
export function canadianStatements(i: Pick<ReportInput, 'hasCashFlow' | 'npo' | 'group'>): { positionName: string; others: string[]; framework: string } {
  const cons = i.group ? 'consolidated ' : '';
  if (i.npo)
    return {
      positionName: `${cons}statement of financial position`,
      others: ['operations', 'changes in net assets', ...(i.hasCashFlow ? ['cash flows'] : [])],
      framework: 'Canadian accounting standards for not-for-profit organizations',
    };
  return {
    positionName: `${cons}balance sheet`,
    others: ['income', 'retained earnings', ...(i.hasCashFlow ? ['cash flows'] : [])],
    framework: 'Canadian accounting standards for private enterprises',
  };
}

const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

export function canadaReport(i: CanadaReportInput): DraftReport {
  const name = i.clientName;
  const date = longDate(i.yearEnd);
  const s = canadianStatements(i);
  const cons = i.group ? 'consolidated ' : '';
  const entity = i.npo ? 'Organization' : i.group ? 'Group' : 'Company';
  const the = `the ${entity}`;
  const statements = `the ${s.positionName} as at ${date}, and the ${cons}statements of ${and(s.others)} for the year then ended`;
  const comprise = `${statements}, and notes to the ${cons}financial statements, including a summary of significant accounting policies`;
  const results = i.npo ? `its results of operations${i.hasCashFlow ? ' and its cash flows' : ''}` : `its results of operations${i.hasCashFlow ? ' and its cash flows' : ''}`;
  const fair = `the ${cons}financial position of ${the} as at ${date}, and ${results} for the year then ended in accordance with ${s.framework}`;
  const members = i.npo ? `To the Members of ${name}` : `To the Shareholders of ${name}`;
  const fs = `${cons}financial statements`;
  const named = `${name} (the ${entity})${i.group ? ' and its subsidiaries' : ''}`;

  if (i.type === 'compilation') {
    const what = i.specialBasis
      ? `the ${s.positionName} of ${name} as at ${date}, the ${cons}statements of ${and(s.others)} for the year then ended, and Note 1, which describes the basis of accounting applied in the preparation of the compiled financial information (“financial information”)`
      : `the ${fs} of ${name}, which comprise ${comprise}`;
    return {
      title: 'Compilation engagement report',
      addressee: `To Management of ${name}`,
      sections: [
        {
          heading: '',
          paragraphs: [
            `On the basis of information provided by management, we have compiled ${what}.`,
            `Management is responsible for the accompanying ${i.specialBasis ? 'financial information' : fs}, including the accuracy and completeness of the underlying information used to compile it and the selection of the basis of accounting.`,
            `We performed this engagement in accordance with Canadian Standard on Related Services (CSRS) 4200, Compilation Engagements, which requires us to comply with relevant ethical requirements. Our responsibility is to assist management in the preparation of the ${i.specialBasis ? 'financial information' : fs}.`,
            `We did not perform an audit engagement or a review engagement, nor were we required to perform procedures to verify the accuracy or completeness of the information provided by management. Accordingly, we do not express an audit opinion or a review conclusion, or provide any form of assurance on the ${i.specialBasis ? 'financial information' : fs}.`,
            `Readers are cautioned that the ${i.specialBasis ? 'financial information' : fs} may not be appropriate for their purposes.`,
          ],
        },
      ],
    };
  }

  if (i.type === 'review') {
    const kind = i.settings.opinion ?? 'unmodified';
    const basis = i.settings.basis?.trim() || '[The practitioner must describe the matter giving rise to the modification.]';
    const concl: ReportSection[] =
      kind === 'unmodified'
        ? [{ heading: 'Conclusion', paragraphs: [`Based on our review, nothing has come to our attention that causes us to believe that the ${fs} do not present fairly, in all material respects, ${fair}.`] }]
        : [
            {
              heading: { qualified: 'Basis for qualified conclusion', adverse: 'Basis for adverse conclusion', disclaimer: 'Basis for denial of conclusion' }[kind],
              paragraphs: [basis],
            },
            {
              heading: { qualified: 'Qualified conclusion', adverse: 'Adverse conclusion', disclaimer: 'Denial of conclusion' }[kind],
              paragraphs: [
                {
                  qualified: `Based on our review, except for the effects of the matter described in the Basis for Qualified Conclusion paragraph, nothing has come to our attention that causes us to believe that the ${fs} do not present fairly, in all material respects, ${fair}.`,
                  adverse: `Based on our review, due to the significance of the matter described in the Basis for Adverse Conclusion paragraph, the ${fs} do not present fairly, in all material respects, ${fair}.`,
                  disclaimer: `Due to the significance of the matter described in the Basis for Denial of Conclusion paragraph, we were unable to obtain sufficient appropriate evidence to form a basis for a review conclusion on the ${fs}. Accordingly, we do not express a conclusion on these ${fs}.`,
                }[kind],
              ],
            },
          ];
    return {
      title: 'Independent practitioner’s review engagement report',
      addressee: members,
      sections: [
        { heading: '', paragraphs: [`We have reviewed the accompanying ${fs} of ${named} that comprise ${statements}, and a summary of significant accounting policies and other explanatory information.`] },
        {
          heading: `Management’s responsibility for the ${fs}`,
          paragraphs: [
            `Management is responsible for the preparation and fair presentation of these ${fs} in accordance with ${s.framework}, and for such internal control as management determines is necessary to enable the preparation of ${fs} that are free from material misstatement, whether due to fraud or error.`,
          ],
        },
        {
          heading: 'Practitioner’s responsibility',
          paragraphs: [
            `Our responsibility is to express a conclusion on the accompanying ${fs} based on our review. We conducted our review in accordance with Canadian generally accepted standards for review engagements, which require us to comply with relevant ethical requirements.`,
            `A review of ${fs} in accordance with Canadian generally accepted standards for review engagements is a limited assurance engagement. The practitioner performs procedures, primarily consisting of making inquiries of management and others within the entity, as appropriate, and applying analytical procedures, and evaluates the evidence obtained.`,
            `The procedures performed in a review are substantially less in extent than, and vary in nature from, those performed in an audit conducted in accordance with Canadian generally accepted auditing standards. Accordingly, we do not express an audit opinion on these ${fs}.`,
          ],
        },
        ...concl,
        ...(i.settings.emphasis?.trim() && kind !== 'disclaimer' ? [{ heading: 'Emphasis of matter', paragraphs: [i.settings.emphasis.trim(), 'Our conclusion is not modified in respect of this matter.'] }] : []),
        ...(i.settings.otherMatter?.trim() && kind !== 'disclaimer' ? [{ heading: 'Other matter', paragraphs: [i.settings.otherMatter.trim()] }] : []),
      ],
    };
  }

  // Audit, CAS 700.
  const opinion = i.settings.opinion ?? 'unmodified';
  const basis = i.settings.basis?.trim() || '[The engagement partner must describe the matter giving rise to the modification.]';
  const heading = { unmodified: 'Opinion', qualified: 'Qualified opinion', adverse: 'Adverse opinion', disclaimer: 'Disclaimer of opinion' }[opinion];
  const intro = opinion === 'disclaimer' ? `We were engaged to audit the ${fs} of ${named}, which comprise ${comprise}.` : `We have audited the ${fs} of ${named}, which comprise ${comprise}.`;
  const opinionText = {
    unmodified: `In our opinion, the accompanying ${fs} present fairly, in all material respects, ${fair}.`,
    qualified: `In our opinion, except for the effects of the matter described in the Basis for Qualified Opinion section of our report, the accompanying ${fs} present fairly, in all material respects, ${fair}.`,
    adverse: `In our opinion, because of the significance of the matter discussed in the Basis for Adverse Opinion section of our report, the accompanying ${fs} do not present fairly, in all material respects, ${fair}.`,
    disclaimer: `We do not express an opinion on the accompanying ${fs} of ${the}. Because of the significance of the matter described in the Basis for Disclaimer of Opinion section of our report, we have not been able to obtain sufficient appropriate audit evidence to provide a basis for an audit opinion on these ${fs}.`,
  }[opinion];
  const independent = `We are independent of ${the} in accordance with the ethical requirements that are relevant to our audit of the ${fs} in Canada, and we have fulfilled our other ethical responsibilities in accordance with these requirements.`;
  const standards = `We conducted our audit in accordance with Canadian generally accepted auditing standards. Our responsibilities under those standards are further described in the Auditor’s Responsibilities for the Audit of the ${i.group ? 'Consolidated ' : ''}Financial Statements section of our report. ${independent}`;
  const sufficient = { unmodified: 'opinion', qualified: 'qualified opinion', adverse: 'adverse opinion', disclaimer: '' }[opinion];
  const st = i.settings;
  const added: ReportSection[] = [];
  if (opinion !== 'disclaimer') {
    if (st.goingConcern?.trim() && opinion !== 'adverse')
      added.push({ heading: 'Material uncertainty related to going concern', paragraphs: [st.goingConcern.trim(), 'Our opinion is not modified in respect of this matter.'] });
    if (st.emphasis?.trim()) added.push({ heading: 'Emphasis of matter', paragraphs: [st.emphasis.trim(), 'Our opinion is not modified in respect of this matter.'] });
    if (st.otherMatter?.trim()) added.push({ heading: 'Other matter', paragraphs: [st.otherMatter.trim()] });
    if (st.otherInformation?.trim())
      added.push({
        heading: 'Other information',
        paragraphs: [
          `Management is responsible for the other information. Our opinion on the ${fs} does not cover the other information and we do not express any form of assurance conclusion thereon. In connection with our audit, our responsibility is to read the other information and consider whether it is materially inconsistent with the ${fs} or our knowledge obtained in the audit, or otherwise appears to be materially misstated.`,
          st.otherInformation.trim(),
        ],
      });
  }
  const sections: ReportSection[] = [
    { heading, paragraphs: [intro, opinionText] },
    {
      heading: `Basis for ${heading.toLowerCase()}`,
      paragraphs: opinion === 'disclaimer' ? [basis] : [...(opinion === 'unmodified' ? [] : [basis]), standards, `We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our ${sufficient}.`],
    },
    ...added,
    {
      heading: `Responsibilities of management and those charged with governance for the ${fs}`,
      paragraphs: [
        `Management is responsible for the preparation and fair presentation of the ${fs} in accordance with ${s.framework}, and for such internal control as management determines is necessary to enable the preparation of ${fs} that are free from material misstatement, whether due to fraud or error.`,
        `In preparing the ${fs}, management is responsible for assessing ${the}’s ability to continue as a going concern, disclosing, as applicable, matters related to going concern and using the going concern basis of accounting unless management either intends to liquidate ${the} or to cease operations, or has no realistic alternative but to do so.`,
        `Those charged with governance are responsible for overseeing ${the}’s financial reporting process.`,
      ],
    },
    {
      heading: `Auditor’s responsibilities for the audit of the ${fs}`,
      paragraphs:
        opinion === 'disclaimer'
          ? [
              `Our responsibility is to conduct an audit of ${the}’s ${fs} in accordance with Canadian generally accepted auditing standards and to issue an auditor’s report. However, because of the matter described in the Basis for Disclaimer of Opinion section of our report, we were not able to obtain sufficient appropriate audit evidence to provide a basis for an audit opinion on these ${fs}.`,
              independent,
            ]
          : [
              `Our objectives are to obtain reasonable assurance about whether the ${fs} as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor’s report that includes our opinion. Reasonable assurance is a high level of assurance, but is not a guarantee that an audit conducted in accordance with Canadian generally accepted auditing standards will always detect a material misstatement when it exists. Misstatements can arise from fraud or error and are considered material if, individually or in the aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these ${fs}.`,
              'As part of an audit in accordance with Canadian generally accepted auditing standards, we exercise professional judgment and maintain professional skepticism throughout the audit. We also:',
              `• Identify and assess the risks of material misstatement of the ${fs}, whether due to fraud or error, design and perform audit procedures responsive to those risks, and obtain audit evidence that is sufficient and appropriate to provide a basis for our opinion. The risk of not detecting a material misstatement resulting from fraud is higher than for one resulting from error, as fraud may involve collusion, forgery, intentional omissions, misrepresentations, or the override of internal control.`,
              `• Obtain an understanding of internal control relevant to the audit in order to design audit procedures that are appropriate in the circumstances, but not for the purpose of expressing an opinion on the effectiveness of ${the}’s internal control.`,
              '• Evaluate the appropriateness of accounting policies used and the reasonableness of accounting estimates and related disclosures made by management.',
              `• Conclude on the appropriateness of management’s use of the going concern basis of accounting and, based on the audit evidence obtained, whether a material uncertainty exists related to events or conditions that may cast significant doubt on ${the}’s ability to continue as a going concern. If we conclude that a material uncertainty exists, we are required to draw attention in our auditor’s report to the related disclosures in the ${fs} or, if such disclosures are inadequate, to modify our opinion. Our conclusions are based on the audit evidence obtained up to the date of our auditor’s report. However, future events or conditions may cause ${the} to cease to continue as a going concern.`,
              `• Evaluate the overall presentation, structure and content of the ${fs}, including the disclosures, and whether the ${fs} represent the underlying transactions and events in a manner that achieves fair presentation.`,
              ...(i.group
                ? [`• Obtain sufficient appropriate audit evidence regarding the financial information of the entities or business activities within the Group to express an opinion on the ${fs}. We are responsible for the direction, supervision and performance of the group audit. We remain solely responsible for our audit opinion.`]
                : []),
              'We communicate with those charged with governance regarding, among other matters, the planned scope and timing of the audit and significant audit findings, including any significant deficiencies in internal control that we identify during our audit.',
            ],
    },
  ];
  return { title: 'Independent auditor’s report', addressee: members, sections };
}

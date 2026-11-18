/**
 * What's new: the releases firms see after they sign in, newest first. Each one says what changed,
 * then shows how to use it, step by step, with screenshots from public/releases/<id>/.
 * Add a new release at the top. Its id marks it unread for every user until they open it.
 */
export interface Release {
  id: string;
  /** The date it went live, as YYYY-MM-DD. */
  date: string;
  title: string;
  summary: string;
  highlights: string[];
  steps: { title: string; text: string; image?: string; alt?: string }[];
  /** A closing tip or caution, when there is one. */
  note?: string;
}

const img = (release: string, name: string) => `/releases/${release}/${name}.png`;

export const RELEASES: Release[] = [
  {
    id: '0.29',
    date: '2026-11-18',
    title: 'Lay out the financial statements the way your client wants them',
    summary:
      'Every client has its own way of reading its accounts. The new Presentation panel lets you choose the style, rounding, expense analysis, statement titles and line captions for each client, or set them once as your firm’s default. The figures never change, only the way they are presented.',
    highlights: [
      'International illustrative style, modelled on the layout of the large international firms’ published IFRS statements.',
      'Amounts in whole units, thousands or millions, with “In thousands of Nigerian naira” under each title.',
      'Expenses in profit or loss by function or by nature.',
      'Your own wording for any statement title or line, such as “Accounts receivable” for trade receivables.',
      'The statement of value added and the financial summary can be left out of management and bank copies.',
    ],
    steps: [
      {
        title: 'Open the Presentation panel',
        text: 'Open the client’s engagement and go to the Financial statements step. The Presentation panel sits at the top and shows the current layout in one line. Select Change the layout.',
        image: img('0.29', 'step1'),
        alt: 'The Presentation panel at the top of the Financial statements step, with the Change the layout button',
      },
      {
        title: 'Choose the style, rounding and expense analysis',
        text: 'Pick International illustrative for the international firm layout. It shows amounts in thousands, groups the notes under section headings, puts the accounting policies in the last note and starts the cash flow from profit for the year. Choose by nature if the client presents employee benefits and depreciation as separate lines.',
        image: img('0.29', 'step2'),
        alt: 'The style, rounding and expenses choices, with International illustrative and By nature selected',
      },
      {
        title: 'Reword titles and captions where the client asks',
        text: 'Type the client’s own wording beside any statement title or line. Leave a box empty to keep the standard wording. A caption follows the line into the notes and the cash flow.',
        image: img('0.29', 'step3'),
        alt: 'Line captions, with Trade receivables renamed Accounts receivable',
      },
      {
        title: 'Save for this client, or for the whole firm',
        text: 'Save for this client applies the layout to this file only. Save as the firm’s default makes it the starting point for every client that has no layout of its own. A partner or manager can set the firm’s default. Use the firm’s default undoes a client’s own choices.',
        image: img('0.29', 'step4'),
        alt: 'The optional national pages and the Save for this client and Save as the firm’s default buttons',
      },
      {
        title: 'Review the result',
        text: 'The statements redraw at once. Here is the statement of financial position in the international style, in thousands, with the client’s caption and the note numbers renumbered to match the grouped notes.',
        image: img('0.29', 'result-position'),
        alt: 'The statement of financial position in thousands of Nigerian naira, with Accounts receivable',
      },
      {
        title: 'Profit or loss by nature',
        text: 'By nature, staff costs and depreciation are drawn out of every expense line using the nature tags in the mapping. Operating profit is the same either way.',
        image: img('0.29', 'result-income'),
        alt: 'The statement of profit or loss with raw materials, employee benefits, depreciation and other operating expenses',
      },
      {
        title: 'Notes grouped under section headings',
        text: 'In the international style the notes fall under Basis of preparation, Performance for the year, Income taxes, Assets, Equity and liabilities, Other information and Accounting policies.',
        image: img('0.29', 'result-notes'),
        alt: 'The notes to the financial statements grouped under section headings',
      },
    ],
    note: 'A signed file’s layout is fixed, so set the presentation before the partner signs. When rounding to thousands each figure is rounded on its own, as published statements are, so a total can differ from the sum of its lines by one.',
  },
  {
    id: '0.28',
    date: '2026-11-10',
    title: 'Investment property, leases and biological assets on their own lines',
    summary:
      'Right-of-use assets, investment property and biological assets are now separate lines in the statement of financial position, each with its notes, disclosure checks and audit steps. Lease liabilities are split between current and non-current.',
    highlights: [
      'New lines: right-of-use assets, investment property, biological assets, and lease liabilities (current and non-current).',
      'The cash flow keeps a new lease out of cash and shows lease principal paid under financing.',
      'A movement note for right-of-use assets, checked with depreciation.',
      'Work programme steps for leases, investment property and biological assets.',
      'Accounting policies and disclosure checklist items for each.',
    ],
    steps: [
      {
        title: 'Map the accounts to the new lines',
        text: 'In the Mapping step, VeritBooks now suggests right-of-use, lease liability, investment property and livestock accounts on their own lines. On a file you mapped before this release, remap those accounts once. Depreciation, interest, rent and fair value gains on them stay in profit or loss.',
      },
      {
        title: 'See them in the statements',
        text: 'Each class shows as its own line with its own note.',
        image: img('0.28', 'position'),
        alt: 'A statement of financial position with right-of-use assets, investment property, biological assets and lease liabilities',
      },
      {
        title: 'Check the cash flow',
        text: 'Lease principal paid appears under financing, and purchases of investment property and biological assets under investing.',
        image: img('0.28', 'cash-flow'),
        alt: 'A statement of cash flows with principal elements of lease payments and purchases of investment property',
      },
      {
        title: 'Review the right-of-use note',
        text: 'Cost and accumulated depreciation at the start and end of the year, with additions and the charge.',
        image: img('0.28', 'right-of-use-note'),
        alt: 'The right-of-use assets movement note',
      },
      {
        title: 'Work through the new audit steps',
        text: 'The Work programme adds steps for each class the client holds.',
        image: img('0.28', 'programme'),
        alt: 'Investment property steps in the work programme',
      },
    ],
  },
  {
    id: '0.27',
    date: '2026-11-10',
    title: 'Audit steps for every asset and liability, not only property, plant and equipment',
    summary:
      'The work programme now follows the trial balance. Each asset and liability the client holds brings its own audit steps, and intangible assets get a movement note of their own.',
    highlights: [
      'Steps for intangible assets, investments, borrowings, provisions, deferred tax, other receivables and other payables.',
      'Steps appear only for the balances the client has. A service company no longer sees an inventory count.',
      'An intangible assets movement note: cost, accumulated amortisation, additions, disposals and the charge.',
      'Accumulated amortisation is now suggested as an intangible asset, not property, plant and equipment.',
    ],
    steps: [
      {
        title: 'Open the Work programme',
        text: 'Import and map the trial balance first. The Work programme then shows an area for each class of asset and liability with a balance in any year.',
        image: img('0.27', 'programme'),
        alt: 'Intangible assets steps in the work programme',
      },
      {
        title: 'Enter disposals in Disclosures',
        text: 'In the Disclosures step, enter the cost and amortisation of intangible assets disposed of, as you do for property, plant and equipment. VeritBooks checks both schedules together against the charge in profit or loss.',
        image: img('0.27', 'disclosures'),
        alt: 'The intangible assets movement schedule and the depreciation and amortisation check',
      },
      {
        title: 'Review the note',
        text: 'The intangible assets note prints in the financial statements.',
        image: img('0.27', 'intangibles-note'),
        alt: 'The intangible assets movement note',
      },
    ],
    note: 'On a file you mapped before this release, move any accumulated amortisation account from property, plant and equipment to intangible assets.',
  },
  {
    id: '0.26',
    date: '2026-10-30',
    title: 'Delete journals in one go, and choose what a purge clears',
    summary:
      'You can now tick several journals and delete them together. When you purge a trial balance to import a revised one, VeritBooks asks whether the journals passed should go too, so the year can start clean.',
    highlights: ['Select all, or tick the journals you want, then delete them together.', 'The purge asks whether to keep the journals passed or delete them with the trial balance.', 'Every deletion is recorded in the audit trail.'],
    steps: [
      {
        title: 'Tick the journals to delete',
        text: 'In the Journals step, tick the box beside each journal in Journals passed, or use Select all. Select Delete selected, check the list of journals named, then Confirm delete.',
        image: img('0.26', 'journals'),
        alt: 'Journals passed with two journals ticked and the confirm delete prompt',
      },
      {
        title: 'Choose what the purge clears',
        text: 'In the Trial balance step, select Purge trial balance. If the file has journals, choose to keep them, matched to the new trial balance by account code, or delete them too. Then Confirm purge and import the revised file.',
        image: img('0.26', 'purge'),
        alt: 'The purge asking whether to keep or delete the journals passed',
      },
    ],
    note: 'A deleted bank journal sends its statement item back to the Bank step, unposted, so you can post it again.',
  },
];

export const latestRelease = RELEASES[0];

import type { EngagementType, Planning } from '../engine/types';
import { CHECKLIST, type ChecklistItem } from './checklist';
import { PROGRAMMES, type ProgrammeItem } from './programmes';
import { STANDARD_REQUESTS } from './requests';

/**
 * Industry packs. A pack adds to the general content for one kind of business: more work
 * programme steps, more disclosure checklist items, and more things to ask the client for.
 * It never removes anything from the general content.
 *
 * STATUS: starter content, version 0.1. The steps and items show how a pack works. They are
 * not a reviewed methodology and must be reviewed by a qualified technical author against
 * the standards adopted by the Financial Reporting Council of Nigeria before live use.
 */
export const PACK_VERSION = '0.1-starter';

export interface Pack {
  id: string;
  name: string;
  /** Who the pack is for, in a sentence. */
  summary: string;
  programme: Partial<Record<EngagementType, ProgrammeItem[]>>;
  checklist: ChecklistItem[];
  requests: { title: string; detail: string }[];
}

const INV = 'Inventories and production';
const S13 = 'Section 13: Inventories';

export const PACKS: Pack[] = [
  {
    id: 'trading_manufacturing',
    name: 'Trading and manufacturing',
    summary: 'Companies that buy, make and sell goods, where inventories and cost of sales carry most of the risk.',
    programme: {
      audit: [
        { id: 'tm-a-inv-1', area: INV, text: 'Review the client’s count instructions before the count, and evaluate whether they will give a reliable result.' },
        { id: 'tm-a-inv-2', area: INV, text: 'At the count, make test counts in both directions, from the floor to the sheets and from the sheets to the floor, and record them.' },
        { id: 'tm-a-inv-3', area: INV, text: 'Record the last goods received and despatch note numbers at the count, and test purchases and sales cut-off against them.' },
        { id: 'tm-a-inv-4', area: INV, text: 'Trace the test counts to the final inventory listing, and test the listing for arithmetic and for items added after the count.' },
        { id: 'tm-a-inv-5', area: INV, text: 'Test the cost of raw materials and goods for resale to supplier invoices, including freight, import duty and clearing charges.' },
        { id: 'tm-a-inv-6', area: INV, text: 'For manufactured goods, test the build-up of cost: materials, labour and production overheads, absorbed on normal capacity.' },
        { id: 'tm-a-inv-7', area: INV, text: 'Test work in progress for stage of completion and the cost attached to it.' },
        { id: 'tm-a-inv-8', area: INV, text: 'Compare cost to selling price less costs to sell, using after-date sales, and identify slow-moving, damaged and expired items.' },
        { id: 'tm-a-inv-9', area: INV, text: 'Identify inventories held by third parties or on consignment, and goods in transit, and confirm who owns them at the year end.' },
        { id: 'tm-a-inv-10', area: INV, text: 'Analyse gross margin by product line and by month, and investigate movements that the business does not explain.' },
        { id: 'tm-a-inv-11', area: INV, text: 'Agree import documentation to purchases for significant imports, and test the exchange rate used to record them.' },
      ],
      review: [
        { id: 'tm-r-inv-1', area: INV, text: 'Enquire how the year-end count was carried out, who supervised it, and how differences from the records were dealt with.' },
        { id: 'tm-r-inv-2', area: INV, text: 'Enquire how cost is determined, including overheads in manufactured goods, and whether the method is the same as last year.' },
        { id: 'tm-r-inv-3', area: INV, text: 'Enquire about slow-moving, damaged and expired inventories and how they have been written down.' },
        { id: 'tm-r-inv-4', area: INV, text: 'Compare gross margin and inventory days to last year, and obtain explanations for significant changes.' },
      ],
    },
    checklist: [
      { id: 'tm-s13-classes', section: S13, text: 'Inventories are analysed between raw materials, work in progress, finished goods and goods for resale, as they apply.', when: ['inventories'] },
      { id: 'tm-s13-overheads', section: S13, text: 'The policy explains how production overheads are included in the cost of manufactured goods.', when: ['inventories'] },
      { id: 'tm-s13-writedown', section: S13, text: 'The amount of any write-down of inventories to selling price less costs to sell is disclosed, with any reversal.', when: ['inventories'] },
      { id: 'tm-s13-third-party', section: S13, text: 'Inventories held by third parties, held on consignment or in transit are dealt with consistently, and the treatment is clear from the notes.', when: ['inventories'] },
    ],
    requests: [
      { title: 'Inventory count instructions', detail: 'The written instructions given to the count teams, with the date, locations and names of supervisors.' },
      { title: 'Last goods received and despatch notes', detail: 'The last five of each before the count and the first five after it, at every location.' },
      { title: 'Product costing records', detail: 'Bills of materials, labour rates and the overhead absorption calculation for manufactured goods.' },
      { title: 'Slow-moving and damaged inventory report', detail: 'Items with no movement in six months, and items damaged, expired or written down in the year.' },
      { title: 'Import documentation', detail: 'For significant imports: Form M, bills of lading, customs duty assessments and clearing agents’ invoices.' },
      { title: 'Inventories held elsewhere', detail: 'A list of goods held by third parties, on consignment or in transit at the year end, with confirmations.' },
    ],
  },
];

/** The pack chosen for an engagement, or null for the general content alone. */
export const packOf = (planning: Planning): Pack | null => PACKS.find((p) => p.id === planning.industry) ?? null;

/** The work programme for an engagement: the general steps, then the steps of its pack. */
export const programmeFor = (type: EngagementType, planning: Planning): ProgrammeItem[] => [
  ...PROGRAMMES[type],
  ...(packOf(planning)?.programme[type] ?? []),
];

/** The disclosure checklist for an engagement, with pack items placed in their section. */
export function checklistFor(planning: Planning): ChecklistItem[] {
  const extra = packOf(planning)?.checklist ?? [];
  if (extra.length === 0) return CHECKLIST;
  const out: ChecklistItem[] = [];
  const placed = new Set<string>();
  CHECKLIST.forEach((item, i) => {
    out.push(item);
    if (CHECKLIST[i + 1]?.section !== item.section) {
      for (const x of extra) if (x.section === item.section) (out.push(x), placed.add(x.id));
    }
  });
  return [...out, ...extra.filter((x) => !placed.has(x.id))];
}

export const requestsFor = (planning: Planning) => [...STANDARD_REQUESTS, ...(packOf(planning)?.requests ?? [])];

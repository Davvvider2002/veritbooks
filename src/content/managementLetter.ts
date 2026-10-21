// The standard wording of the letter to management. Each part can be replaced by the firm's own.
// {client}, {year end}, {work} and {firm} are filled in when the letter is printed.
import type { LetterPart } from '../engine/types';

export const LETTER_PARTS: { key: LetterPart; label: string; rows: number; standard: string }[] = [
  { key: 'salutation', label: 'Salutation', rows: 1, standard: 'Dear Sirs,' },
  { key: 'title', label: 'Title', rows: 1, standard: 'Report to management for the year ended {year end}' },
  { key: 'intro', label: 'Opening paragraph', rows: 3, standard: 'In the course of our {work} of the financial statements of {client} for the year ended {year end}, we noted the matters set out below. We bring them to your attention with our recommendations.' },
  { key: 'limitation', label: 'Scope and use of the letter', rows: 3, standard: 'Our {work} was not designed to identify every weakness in internal control, so this letter does not list all the weaknesses that may exist. It is written for the board and management of the company and should not be given to anyone else without our consent.' },
  { key: 'observation', label: 'Heading: observation', rows: 1, standard: 'Observation.' },
  { key: 'implication', label: 'Heading: implication', rows: 1, standard: 'Implication.' },
  { key: 'recommendation', label: 'Heading: recommendation', rows: 1, standard: 'Recommendation.' },
  { key: 'response', label: 'Heading: management’s response', rows: 1, standard: 'Management’s response.' },
  { key: 'awaiting', label: 'Text while a response is awaited', rows: 1, standard: '[Awaiting management’s response]' },
  { key: 'closing', label: 'Closing paragraph', rows: 2, standard: 'We thank the directors and staff for their help during the {work}. We would be glad to discuss any of these matters.' },
  { key: 'signoff', label: 'Sign-off', rows: 1, standard: 'Yours faithfully,' },
];

/** A part of the letter as it prints: the firm's wording or the standard, with the fields filled in. */
export function letterText(key: LetterPart, wording: Partial<Record<LetterPart, string>> | undefined, fill: { client: string; yearEnd: string; work: string; firm: string }): string {
  const own = wording?.[key];
  const text = own !== undefined && own.trim() !== '' ? own : LETTER_PARTS.find((p) => p.key === key)!.standard;
  return text.replace(/\{client\}/g, fill.client).replace(/\{year end\}/g, fill.yearEnd).replace(/\{work\}/g, fill.work).replace(/\{firm\}/g, fill.firm);
}

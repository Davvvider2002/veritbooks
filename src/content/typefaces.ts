/**
 * Typefaces for the firm's reports: the financial statements, the auditor's report, the cover
 * and the management letter. The two original choices use fonts already on the reader's
 * device. The rest are open-licence fonts from Google Fonts, loaded only when a firm uses one,
 * and several are metric-compatible with the Office fonts firms already send reports in
 * (Arimo for Arial, Tinos for Times New Roman, Carlito for Calibri, Caladea for Cambria), so a
 * report keeps its line breaks when compared with a Word draft.
 */
export interface Typeface {
  id: string;
  label: string;
  group: 'Serif' | 'Sans serif';
  /** The CSS font stack, the chosen face first, then close fallbacks. */
  stack: string;
  /** The Google Fonts family request, when the face is loaded from there. */
  google?: string;
  /** In a sentence, what it is like. */
  note: string;
}

const SERIF_FALLBACK = "Georgia, 'Times New Roman', serif";
const SANS_FALLBACK = "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export const TYPEFACES: Typeface[] = [
  { id: 'serif', label: 'Classic', group: 'Serif', stack: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif", note: 'Palatino style, from the reader’s own device.' },
  { id: 'times', label: 'Times (Tinos)', group: 'Serif', stack: `Tinos, 'Times New Roman', Times, ${SERIF_FALLBACK}`, google: 'Tinos:ital,wght@0,400;0,700;1,400', note: 'Measures like Times New Roman.' },
  { id: 'cambria', label: 'Cambria style (Caladea)', group: 'Serif', stack: `Caladea, Cambria, ${SERIF_FALLBACK}`, google: 'Caladea:ital,wght@0,400;0,700;1,400', note: 'Measures like Cambria, the Word default for headings.' },
  { id: 'garamond', label: 'Garamond', group: 'Serif', stack: `'EB Garamond', Garamond, ${SERIF_FALLBACK}`, google: 'EB+Garamond:ital,wght@0,400;0,600;0,700;1,400', note: 'Traditional book face, light on the page.' },
  { id: 'baskerville', label: 'Baskerville', group: 'Serif', stack: `'Libre Baskerville', Baskerville, ${SERIF_FALLBACK}`, google: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400', note: 'Formal and wide, suits annual reports.' },
  { id: 'merriweather', label: 'Merriweather', group: 'Serif', stack: `Merriweather, ${SERIF_FALLBACK}`, google: 'Merriweather:ital,wght@0,400;0,700;1,400', note: 'Sturdy and easy to read on screen.' },
  { id: 'source-serif', label: 'Source Serif', group: 'Serif', stack: `'Source Serif 4', ${SERIF_FALLBACK}`, google: 'Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400', note: 'Crisp modern serif with clear figures.' },
  { id: 'sans', label: 'Modern', group: 'Sans serif', stack: SANS_FALLBACK, note: 'The reader’s system font.' },
  { id: 'arial', label: 'Arial style (Arimo)', group: 'Sans serif', stack: `Arimo, Arial, Helvetica, ${SANS_FALLBACK}`, google: 'Arimo:ital,wght@0,400;0,600;0,700;1,400', note: 'Measures like Arial.' },
  { id: 'calibri', label: 'Calibri style (Carlito)', group: 'Sans serif', stack: `Carlito, Calibri, ${SANS_FALLBACK}`, google: 'Carlito:ital,wght@0,400;0,700;1,400', note: 'Measures like Calibri, the Word default.' },
  { id: 'inter', label: 'Inter', group: 'Sans serif', stack: `Inter, ${SANS_FALLBACK}`, google: 'Inter:wght@400;500;600;700', note: 'Neutral, with tabular figures for columns.' },
  { id: 'open-sans', label: 'Open Sans', group: 'Sans serif', stack: `'Open Sans', ${SANS_FALLBACK}`, google: 'Open+Sans:ital,wght@0,400;0,600;0,700;1,400', note: 'Friendly and open.' },
  { id: 'lato', label: 'Lato', group: 'Sans serif', stack: `Lato, ${SANS_FALLBACK}`, google: 'Lato:ital,wght@0,400;0,700;1,400', note: 'Warm and rounded.' },
  { id: 'roboto', label: 'Roboto', group: 'Sans serif', stack: `Roboto, ${SANS_FALLBACK}`, google: 'Roboto:ital,wght@0,400;0,500;0,700;1,400', note: 'Compact; fits wide tables.' },
  { id: 'source-sans', label: 'Source Sans', group: 'Sans serif', stack: `'Source Sans 3', ${SANS_FALLBACK}`, google: 'Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400', note: 'Clear and economical.' },
  { id: 'montserrat', label: 'Montserrat', group: 'Sans serif', stack: `Montserrat, ${SANS_FALLBACK}`, google: 'Montserrat:ital,wght@0,400;0,600;0,700;1,400', note: 'Geometric; best for covers and headings.' },
];

export const typefaceOf = (id: string | undefined): Typeface => TYPEFACES.find((t) => t.id === id) ?? TYPEFACES[0];

/** Loads a face from Google Fonts once, so screen and print both use it. */
export function loadTypeface(t: Typeface): void {
  if (!t.google || typeof document === 'undefined') return;
  const id = `vb-font-${t.id}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${t.google}&display=swap`;
  document.head.appendChild(link);
}

/** Sets the report typeface for every report sheet on the page. */
export function applyReportTypeface(id: string | undefined): void {
  const t = typefaceOf(id);
  loadTypeface(t);
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--report-font', t.stack);
}

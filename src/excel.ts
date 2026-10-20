// Saving and sharing Excel workbooks in the browser.
import type { SheetSpec } from './engine/etbSheets';

async function toBlob(sheets: SheetSpec[]): Promise<Blob> {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  return writeExcelFile(sheets as never).toBlob();
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** A file name without characters that Windows or mail programs refuse. */
export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function downloadWorkbook(sheets: SheetSpec[], name: string) {
  save(await toBlob(sheets), `${safeFileName(name)}.xlsx`);
}

/**
 * Sends the workbook to the client. Where the device can share files (Outlook, Mail, WhatsApp and
 * the like), it opens the share sheet with the file attached. Otherwise the file is saved and an
 * email is opened with the subject and message filled in, for the file to be attached.
 * Returns how it was sent, for the message shown afterwards.
 */
export async function sendWorkbook(sheets: SheetSpec[], name: string, subject: string, body: string): Promise<'shared' | 'email' | 'cancelled'> {
  const blob = await toBlob(sheets);
  const fileName = `${safeFileName(name)}.xlsx`;
  const file = new File([blob], fileName, { type: XLSX });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: subject, text: body });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  save(blob, fileName);
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\nAttached: ${fileName}`)}`;
  return 'email';
}

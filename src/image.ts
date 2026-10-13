/**
 * Reads an image file the user chose and returns it as a small PNG data URL, at most
 * 600 x 300 pixels, so a logo can be kept with the firm or client record.
 */
export async function readLogo(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) throw new Error('Choose a PNG, JPEG, WebP or SVG image.');
  if (file.size > 5_000_000) throw new Error('The image is larger than 5 MB. Choose a smaller one.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('The image could not be read.'));
      i.src = url;
    });
    const w = img.naturalWidth || 600;
    const h = img.naturalHeight || 300;
    const scale = Math.min(1, 600 / w, 300 / h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/png');
    if (out.length > 380_000) throw new Error('The logo is too detailed to keep. Use a simpler or smaller image.');
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

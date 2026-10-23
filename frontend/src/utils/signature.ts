/**
 * Helpers for the staff member's electronic signature image.
 *
 * Signatures are usually produced in a design tool (Canva, Word, a scanner)
 * and come as a PNG/JPEG with a large empty white margin around the ink.
 * The helpers below trim that margin and downscale the artwork so the stored
 * image stays small and the PDF renders it at a sensible size.
 */

const MAX_WIDTH = 900;
const MAX_HEIGHT = 320;
/** Pixels of transparent padding kept around the trimmed artwork. */
const TRIM_PADDING = 8;

/**
 * The signature artwork is served by this app under the layout of the bucket
 * (`/signatures_memo/<owner>/<file>`). The URL that is stored in the database
 * is absolute, but only its path is used to load the image: the request then
 * stays on this origin, so the session cookie is sent along and the picture
 * is never blocked by the content security policy.
 */
export const signatureImageSrc = (url?: string | null): string => {
  if (!url) return '';
  const withoutQuery = url.split('?')[0].split('#')[0];
  const marker = '/signatures_memo/';
  const index = withoutQuery.indexOf(marker);
  if (index < 0) return url;
  return withoutQuery.slice(index);
};

/**
 * True when the acknowledgement carries an electronic signature. Only such a
 * record may be turned into a PDF: a document without the artwork would claim
 * to be signed while it is not.
 */
export const hasAppliedSignature = (record?: {
  signatureApplied?: boolean;
  signatureUrl?: string | null;
} | null): boolean => Boolean(record?.signatureApplied && record?.signatureUrl);

/**
 * Loads the artwork that this app serves and returns it as a data URL. The
 * PDF renderer cannot read an image from a URL, so the bytes are inlined
 * before they are placed on the document.
 */
export const fetchSignatureDataUrl = async (url?: string | null): Promise<string | null> => {
  const src = signatureImageSrc(url);
  if (!src) return null;
  if (src.startsWith('data:')) return src;

  try {
    const response = await fetch(src, { credentials: 'include' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('The signature image could not be read.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(blob);
    });
  } catch {
    // A missing artwork must never stop the document from being produced.
    return null;
  }
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The signature image could not be read.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The signature image could not be decoded.'));
    image.src = src;
  });

/** Cuts the blank border away and returns the trimmed artwork on a canvas. */
const trimTransparentBorder = (source: HTMLCanvasElement): HTMLCanvasElement => {  const ctx = source.getContext('2d');
  if (!ctx) return source;

  const { width, height } = source;
  const pixels = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = pixels[index + 3];
      const isWhite =
        pixels[index] > 245 && pixels[index + 1] > 245 && pixels[index + 2] > 245;
      if (alpha <= 20 || isWhite) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // A fully blank image is kept as-is — there is nothing to trim.
  if (maxX < 0 || maxY < 0) return source;

  const left = Math.max(0, minX - TRIM_PADDING);
  const top = Math.max(0, minY - TRIM_PADDING);
  const right = Math.min(width - 1, maxX + TRIM_PADDING);
  const bottom = Math.min(height - 1, maxY + TRIM_PADDING);
  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;

  const trimmed = document.createElement('canvas');
  trimmed.width = cropWidth;
  trimmed.height = cropHeight;
  trimmed.getContext('2d')?.drawImage(
    source,
    left,
    top,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );
  return trimmed;
};

export interface NormalizedSignature {
  /** PNG data URL, ready to be stored and embedded in a PDF. */
  dataUrl: string;
  fileName: string;
}

/**
 * Trims the blank margin from a canvas (a drawn signature pad or an uploaded
 * picture) and returns it as a PNG data URL with a transparent background.
 */
export const trimSignatureCanvas = (canvas: HTMLCanvasElement): string => {
  const trimmed = trimTransparentBorder(canvas);
  return trimmed.toDataURL('image/png');
};

/**
 * Reads a signature file, trims its blank border, downscales it and returns
 * a PNG data URL. The artwork keeps its aspect ratio, so the PDF can place it
 * without distorting the strokes.
 */
export const normalizeSignatureImage = async (file: File): Promise<NormalizedSignature> => {
  if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) {
    throw new Error('Use a PNG or JPEG image for your signature.');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('The signature image must be smaller than 2 MB.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(rawDataUrl);

  const scale = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser cannot process the signature image.');
  ctx.drawImage(image, 0, 0, width, height);

  const trimmed = trimTransparentBorder(canvas);
  const dataUrl = trimmed.toDataURL('image/png');
  const fileName = file.name.replace(/\.[^.]+$/, '') || 'signature';

  return { dataUrl, fileName };
};

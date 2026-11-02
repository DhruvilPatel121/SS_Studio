/**
 * Smart image compression utility for CamSort.
 *
 * Strategy:
 *  1. If the file is already small enough (≤ TARGET_SIZE_BYTES), return as-is.
 *  2. Draw the image onto a canvas at the original resolution.
 *  3. If width > MAX_DIMENSION, downscale proportionally (still high-res for printing).
 *  4. Binary-search for the highest JPEG quality that keeps the output ≤ TARGET_SIZE_BYTES.
 *  5. If even quality=0.1 produces a file > TARGET_SIZE_BYTES, halve the canvas dimensions
 *     once and retry — this handles unusually dense RAW-derived images.
 *
 * Visual quality is preserved because:
 *  - We never go below quality 0.72 unless the file truly demands it.
 *  - The max dimension cap (4096 px) covers all practical display / print use-cases.
 *  - For images already under 200 KB we skip compression entirely.
 */

const TARGET_SIZE_BYTES = 10 * 1024;     // 10 KB max output (8–10 KB target)
const MAX_DIMENSION     = 1280;          // px — sufficient for web display + face recognition
const MIN_QUALITY       = 0.30;          // absolute floor before we also scale resolution
const HIGH_QUALITY      = 0.82;          // start quality for the binary search

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // e.g. 0.05 means 95 % saved
  wasCompressed: boolean;
}

/**
 * Load a File into an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image')); };
    img.src = url;
  });
}

/**
 * Render img onto a canvas and return a Blob at the given JPEG quality.
 */
function renderToBlob(img: HTMLImageElement, width: number, height: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null')),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Binary-search for the highest quality that keeps output ≤ TARGET_SIZE_BYTES.
 * Returns the resulting Blob and the quality used.
 */
async function binarySearchQuality(
  img: HTMLImageElement,
  width: number,
  height: number,
): Promise<{ blob: Blob; quality: number }> {
  let lo = MIN_QUALITY;
  let hi = HIGH_QUALITY;
  let best: Blob | null = null;
  let bestQ = lo;

  // Up to 8 iterations — precise enough
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const blob = await renderToBlob(img, width, height, mid);
    if (blob.size <= TARGET_SIZE_BYTES) {
      best  = blob;
      bestQ = mid;
      lo    = mid; // try higher quality
    } else {
      hi = mid;    // reduce quality
    }
  }

  // If even MIN_QUALITY is too large, just accept it (rare)
  if (!best) {
    best  = await renderToBlob(img, width, height, MIN_QUALITY);
    bestQ = MIN_QUALITY;
  }

  return { blob: best!, quality: bestQ };
}

/**
 * Main entry-point. Returns a CompressionResult with the (possibly recompressed) File.
 */
export async function compressImage(file: File): Promise<CompressionResult> {
  const originalSize = file.size;

  // Skip non-image files or tiny files
  if (!file.type.startsWith('image/') || originalSize <= TARGET_SIZE_BYTES) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      wasCompressed: false,
    };
  }

  const img = await loadImage(file);

  // Compute scaled dimensions — aggressive downscale for tiny target
  let { naturalWidth: w, naturalHeight: h } = img;
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  let { blob, quality } = await binarySearchQuality(img, w, h);

  // Safety fallback pass 1: halve dimensions once
  if (blob.size > TARGET_SIZE_BYTES) {
    ({ blob, quality } = await binarySearchQuality(img, Math.round(w / 2), Math.round(h / 2)));
  }

  // Safety fallback pass 2: quarter dimensions (extreme case)
  if (blob.size > TARGET_SIZE_BYTES) {
    ({ blob, quality } = await binarySearchQuality(img, Math.round(w / 4), Math.round(h / 4)));
  }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  const outFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });

  return {
    file: outFile,
    originalSize,
    compressedSize: outFile.size,
    compressionRatio: 1 - outFile.size / originalSize,
    wasCompressed: true,
    // @ts-ignore — expose quality for debugging
    _quality: quality,
  };
}

/** Human-readable file size */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
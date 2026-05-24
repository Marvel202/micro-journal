/**
 * Compress an image File before storing it.
 * Uses OffscreenCanvas — runs entirely in the browser, zero dependencies.
 *
 * Default: longest edge ≤ 1200px, JPEG quality 0.82
 * Typical phone photo: 4–8 MB → 150–300 KB
 */
export async function compressPhoto(
  file: File,
  maxPx = 1200,
  quality = 0.82,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.convertToBlob({ type: "image/jpeg", quality });
}

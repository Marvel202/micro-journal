/**
 * Compress an image File before storing it.
 * Uses HTMLCanvasElement + toBlob — works on all browsers including iOS Safari.
 * (OffscreenCanvas.convertToBlob is unreliable on iOS Safari.)
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

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob returned null"));
      },
      "image/jpeg",
      quality,
    );
  });
}

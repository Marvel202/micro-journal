/**
 * Compress an image File before storing it (especially important for iPhone camera photos).
 *
 * Strategy (in order):
 * 1. Try fast `createImageBitmap` path
 * 2. Fall back to classic `<img>` + canvas (much better compatibility with iOS camera HEIC)
 * 3. Last resort: use the original file unchanged (guarantees the user can always save)
 *
 * Target: longest edge ≤ 1200px, JPEG quality ~0.82 when compression succeeds.
 */
export async function compressPhoto(
  file: File,
  maxPx = 1200,
  quality = 0.82,
): Promise<Blob> {
  // Fast path — preferred when the browser can handle the file
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const blob = await bitmapToJpegBlob(bitmap, maxPx, quality);
      bitmap.close();
      return blob;
    } catch (err) {
      bitmap.close();
      throw err;
    }
  } catch (err) {
    console.warn("[compressPhoto] createImageBitmap failed, trying <img> fallback:", err);
  }

  // Second path — classic <img> + canvas (more compatible with many iOS HEIC camera shots)
  try {
    return await compressViaImageElement(file, maxPx, quality);
  } catch (err) {
    console.warn("[compressPhoto] <img> fallback also failed:", err);
  }

  // Last resort: use the original file as-is.
  // This guarantees the user can save the photo even if both compression methods fail
  // (common with certain iPhone HEIC files). File size will be larger than ideal.
  console.warn("[compressPhoto] Both compression attempts failed. Using original file without compression.");
  return file; // File extends Blob, so this is safe
}

/** Draw ImageBitmap to canvas and export as JPEG Blob */
async function bitmapToJpegBlob(
  bitmap: ImageBitmap,
  maxPx: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("canvas.toBlob returned null (bitmap path)"));
        }
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Classic fallback loader — works better with HEIC from iOS camera */
async function compressViaImageElement(
  file: File,
  maxPx: number,
  quality: number,
): Promise<Blob> {
  const url = URL.createObjectURL(file);

  try {
    const img = await loadImage(url);

    const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.drawImage(img, 0, 0, w, h);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("canvas.toBlob returned null (img fallback)"));
          }
        },
        "image/jpeg",
        quality,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image for compression fallback"));
    img.src = src;
  });
}

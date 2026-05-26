/**
 * Compress an image File before storing it (especially important for iPhone camera photos).
 *
 * Strategy:
 * 1. Try the fast `createImageBitmap` path first (good performance + orientation handling when it works).
 * 2. If that fails (very common with HEIC from iOS camera in certain Safari versions),
 *    fall back to the classic `<img>` + canvas path, which is more reliable on real-world iOS devices.
 *
 * Target: longest edge ≤ 1200px, JPEG quality ~0.82
 * Typical phone photo: 4–8 MB → 150–300 KB
 */
export async function compressPhoto(
  file: File,
  maxPx = 1200,
  quality = 0.82,
): Promise<Blob> {
  // Fast path — preferred when the browser can handle the file (most cases)
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const blob = await bitmapToJpegBlob(bitmap, maxPx, quality);
      bitmap.close();
      return blob;
    } catch (err) {
      bitmap.close();
      throw err; // will be caught by outer catch and trigger fallback
    }
  } catch (err) {
    console.warn("[compressPhoto] createImageBitmap failed (common on iOS HEIC camera files), falling back to <img> path:", err);

    // Fallback path — much more reliable for photos taken directly with iPhone camera
    return compressViaImageElement(file, maxPx, quality);
  }
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

// FIREBASE: Firebase Storage. Replace the body of uploadImage with
//   const r = ref(storage, `${folder}/${Date.now()}-${file.name}`);
//   await uploadBytes(r, file);
//   return getDownloadURL(r);
// Contract: takes a File + folder name ("listings" | "avatars"), returns a public URL string.
// Never store image bytes / base64 in Firestore (1 MB document limit) — store only the URL.
import { delay } from "./db.js";

const MAX_BYTES = 8 * 1024 * 1024;

// Demo implementation: downscale in the browser and return a small data URL so localStorage doesn't overflow.
export async function uploadImage(file, folder = "listings") {
  if (!file?.type?.startsWith("image/"))
    throw new Error("Please choose an image file.");
  if (file.size > MAX_BYTES) throw new Error("Image must be under 8 MB.");
  await delay(100);
  const maxSide = folder === "avatars" ? 256 : 1200;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

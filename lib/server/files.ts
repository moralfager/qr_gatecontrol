import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const uploadRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR || "storage/uploads");

export function safeFileName(name: string) {
  return path
    .basename(name || "document.bin")
    .replace(/[^A-Za-zА-Яа-я0-9_. -]+/g, "_")
    .replace(/^[ .]+|[ .]+$/g, "") || "document.bin";
}

export async function saveUpload(applicationId: number, file: File) {
  const dir = path.join(/*turbopackIgnore: true*/ uploadRoot, String(applicationId));
  await mkdir(dir, { recursive: true });
  const originalName = safeFileName(file.name);
  const storedName = `${crypto.randomBytes(12).toString("hex")}_${originalName}`;
  const target = path.join(dir, storedName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(target, bytes);
  return {
    originalName,
    storedPath: path.relative(process.cwd(), target).replace(/\\/g, "/"),
    mimeType: file.type || "application/octet-stream",
    sizeBytes: bytes.length,
  };
}

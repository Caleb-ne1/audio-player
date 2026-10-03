import { createHash } from "node:crypto";

export async function getFileHash(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  return createHash("sha256")
    .update(buffer)
    .digest("hex");
}
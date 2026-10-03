import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { tracks } from "@/db/schema";

export async function generateTrackObjectKey(
  fileName: string,
  fileHash: string,
) {
  const existingTrack = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.fileHash, fileHash))
    .limit(1);

  if (existingTrack.length > 0) {
    throw new Error("Track already exists");
  }

  const extension = fileName.split(".").pop()?.toLowerCase();

  if (!extension) {
    throw new Error("File must have an extension");
  }

  return `tracks/${randomUUID()}.${extension}`;
}
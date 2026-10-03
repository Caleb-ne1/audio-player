import { parseBuffer } from "music-metadata";

export async function getMusicMetadata(
  buffer: Buffer,
  fileName: string
) {
  const metadata = await parseBuffer(buffer, {
    mimeType: undefined,
    size: buffer.length,
  });

  return {
    title: metadata.common.title ?? fileName,
    artist: metadata.common.artist ?? null,
    album: metadata.common.album ?? null,
    albumArtist: metadata.common.albumartist ?? null,
    trackNumber: metadata.common.track.no ?? null,
    discNumber: metadata.common.disk.no ?? null,
    year: metadata.common.year ?? null,
    genre: metadata.common.genre?.[0] ?? null,
    duration: metadata.format.duration ?? null,
  };
}
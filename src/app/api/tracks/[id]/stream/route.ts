
import { NextRequest, NextResponse } from "next/server";
import {
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";

import { db } from "@/db/db";
import { tracks } from "@/db/schema";
import { s3 } from "@/lib/storage/s3";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Helper function to fetch track details from the database
async function getTrack(trackId: number) {
  const [track] = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      fileObjectKey: tracks.fileObjectKey,
    })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  return track;
}

// Helper function to parse the Range header and return the start and end byte positions
function parseRange(range: string, size: number) {
  const match = range.match(/^bytes=(\d*)-(\d*)$/);

  if (!match) {
    return null;
  }

  const startString = match[1];
  const endString = match[2];

  // bytes=-500
  // Last 500 bytes
  if (!startString && endString) {
    const suffixLength = Number(endString);

    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }

    const start = Math.max(size - suffixLength, 0);
    const end = size - 1;

    return { start, end };
  }

  if (!startString) {
    return null;
  }

  const start = Number(startString);

  if (!Number.isSafeInteger(start) || start < 0 || start >= size) {
    return null;
  }

  let end = endString ? Number(endString) : size - 1;

  if (!Number.isSafeInteger(end) || end < start) {
    return null;
  }

  end = Math.min(end, size - 1);

  return { start, end };
}

// Helper function to determine the content type based on the file extension
function getContentType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "flac":
      return "audio/flac";
    case "ogg":
      return "audio/ogg";
    case "opus":
      return "audio/opus";
    case "wav":
      return "audio/wav";
    default:
      return "application/octet-stream";
  }
}

// HEAD handler to inspect the track and return metadata without streaming the file
export async function HEAD(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const trackId = Number(id);

    if (!Number.isSafeInteger(trackId) || trackId <= 0) {
      return new Response(null, { status: 400 });
    }

    const track = await getTrack(trackId);

    if (!track) {
      return new Response(null, { status: 404 });
    }

    const object = await s3.send(
      new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: track.fileObjectKey,
      })
    );

    if (object.ContentLength === undefined) {
      return new Response(null, { status: 502 });
    }

    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type":
          object.ContentType ??
          getContentType(track.title),

        "Content-Length": String(object.ContentLength),

        "Accept-Ranges": "bytes",

        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to inspect track:", error);

    return new Response(null, {
      status: 500,
    });
  }
}

// GET handler to stream the audio file, supporting range requests for partial content delivery
export async function GET(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const trackId = Number(id);

    if (!Number.isSafeInteger(trackId) || trackId <= 0) {
      return NextResponse.json(
        { error: "Invalid track ID" },
        { status: 400 }
      );
    }

    const track = await getTrack(trackId);

    if (!track) {
      return NextResponse.json(
        { error: "Track not found" },
        { status: 404 }
      );
    }

    // First get object metadata.
    const metadata = await s3.send(
      new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: track.fileObjectKey,
      })
    );

    const size = metadata.ContentLength;

    if (size === undefined || size <= 0) {
      return NextResponse.json(
        { error: "Audio file is empty or unavailable" },
        { status: 502 }
      );
    }

    const rangeHeader = req.headers.get("range");

    const baseHeaders = {
      "Content-Type":
        metadata.ContentType ??
        getContentType(track.title),

      "Accept-Ranges": "bytes",

      "Cache-Control": "private, no-store",

      "Content-Disposition": `inline; filename="${track.title.replace(
        /["\\\r\n]/g,
        "_"
      )}"`,
    };

    // No Range header return the complete file.
    if (!rangeHeader) {
      const object = await s3.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: track.fileObjectKey,
        })
      );

      if (!object.Body) {
        return NextResponse.json(
          { error: "Audio file is unavailable" },
          { status: 502 }
        );
      }

      return new Response(
        object.Body.transformToWebStream(),
        {
          status: 200,
          headers: {
            ...baseHeaders,
            "Content-Length": String(size),
          },
        }
      );
    }

    const range = parseRange(rangeHeader, size);

    if (!range) {
      return new Response(null, {
        status: 416,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes */${size}`,
        },
      });
    }

    const { start, end } = range;
    const contentLength = end - start + 1;

    const object = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: track.fileObjectKey,
        Range: `bytes=${start}-${end}`,
      })
    );

    if (!object.Body) {
      return NextResponse.json(
        { error: "Audio file is unavailable" },
        { status: 502 }
      );
    }

    return new Response(
      object.Body.transformToWebStream(),
      {
        status: 206,
        headers: {
          ...baseHeaders,

          "Content-Length": String(contentLength),

          "Content-Range": `bytes ${start}-${end}/${size}`,
        },
      }
    );
  } catch (error) {
    console.error("Failed to stream track:", error);

    return NextResponse.json(
      { error: "Failed to retrieve audio file" },
      { status: 500 }
    );
  }
}
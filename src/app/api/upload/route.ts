import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/db/db";
import { generateTrackObjectKey } from "@/lib/generate-object-key";
import { getMusicMetadata } from "@/lib/metadata";
import { getFileHash } from "@/lib/file-hash";
import { tracks, albums, artists } from "@/db/schema";
import { eq } from "drizzle-orm";
import { s3 } from "@/lib/storage/s3";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const uploadedFiles = [];

    // Loop through each file and upload it to S3
    for (const file of files ) {
        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Invalid file" }, { status: 400 });
        }

        // supported file types
        const supportedFileTypes = ["audio/mpeg", "audio/wav", "audio/ogg"];

        if (!supportedFileTypes.includes(file.type)) {
            return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
        }

        const fileName = file.name;
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        // metadata extraction
        const metadata = await getMusicMetadata(fileBuffer, fileName);

        // files hash
        const fileHash = await getFileHash(file);

        // object key
        const objectKey = await generateTrackObjectKey(fileName, fileHash);

        const uploadParams = {
            Bucket: process.env.S3_BUCKET!,
            Key: objectKey,
            Body: fileBuffer,
            ContentType: file.type,
        };

        await s3.send(new PutObjectCommand(uploadParams));

        uploadedFiles.push(fileName);

        // duration  (seconds)
        const duration = metadata.duration ? Math.round(metadata.duration * 1000)
  : 0;

        // add artist and album if they don't exist
        const existingArtist = (await db.select().from(artists).where(eq(artists.name, metadata.artist ?? "Unknown Artist"))).find(artist => artist.name === (metadata.artist ?? "Unknown Artist"));

        if (!existingArtist) {
            // add to to artists
            await db.insert(artists).values({
                name: metadata.artist ?? "Unknown Artist",
            });
        }

        // add artist and album if they don't exist
        const existingAlbum = (await db.select().from(albums).where(eq(albums.title, metadata.album ?? "Unknown Album"))).find(album => album.title === (metadata.album ?? "Unknown Album"));   

        if (!existingAlbum) {
            // add to to albums
            await db.insert(albums).values({
                title: metadata.album ?? "Unknown Album",
                artistId: existingArtist?.id ?? (await db.select().from(artists).where(eq(artists.name, metadata.artist ?? "Unknown Artist"))).find(artist => artist.name === (metadata.artist ?? "Unknown Artist"))?.id ?? 0,
            });
        }

        // add to tracks table
        await db.insert(tracks).values({
            title: fileName,
            fileHash: await getFileHash(file),
            albumId: existingAlbum?.id ?? (await db.select().from(albums).where(eq(albums.title, metadata.album ?? "Unknown Album"))).find(album => album.title === (metadata.album ?? "Unknown Album"))?.id ?? 0,
            duration: duration ?? 0,
            fileObjectKey: objectKey,
        });
    }

    return NextResponse.json({  message: "Files uploaded successfully"}, { status: 200 });
  } catch (error) {
    if(error instanceof Error) { 
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
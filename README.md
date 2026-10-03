# Music

A simple self-hosted music streaming application built as a **learning project**.

The project explores how a music streaming application can handle audio uploads, metadata, object storage, database records, and HTTP audio streaming.

## Tech Stack

* **Next.js** - application and API
* **React** - user interface
* **TypeScript** - type safety
* **Tailwind CSS** - styling
* **MariaDB** - database
* **Drizzle ORM** - database access
* **RustFS** - S3-compatible object storage
* **AWS SDK** - communication with object storage
* **music-metadata** - audio metadata extraction

## Architecture

```text
                    ┌───────────────┐
                    │    Browser    │
                    │               │
                    │ Music Player  │
                    └───────┬───────┘
                            │
                            │ HTTP
                            ▼
                    ┌───────────────┐
                    │    Next.js    │
                    │               │
                    │ UI + API      │
                    └───────┬───────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
        ┌───────────────┐       ┌───────────────┐
        │    MariaDB    │       │    RustFS     │
        │               │       │               │
        │ Track metadata│       │ Audio files   │
        │ Artists       │       │               │
        │ Albums        │       │               │
        └───────────────┘       └───────────────┘
```

The database stores information about the music, while RustFS stores the actual audio files.

This separation was one of the main concepts explored in the project.

## Features

### Music Library

* View uploaded tracks
* Search by title, artist, or album
* Sort tracks
* Pagination
* Display track duration
* Display artist and album information

### Upload

* Upload multiple audio files
* Upload through a modal
* Store audio files in RustFS
* Store track information in MariaDB
* Generate SHA-256 file hashes

### Audio Player

* Play and pause
* Previous and next track
* Automatic next-track playback
* Seek through a track
* Volume control
* Browser-based HTML5 audio playback

### Streaming

Audio is streamed through the application using:

```text
GET /api/tracks/:id/stream
```

The endpoint supports HTTP byte-range requests:

```text
Range: bytes=0-999999
```

This allows the browser to request portions of an audio file instead of requiring the entire file to be downloaded before playback.

## Database Structure

The database currently contains three main tables:

```text
artists
   │
   ▼
albums
   │
   ▼
tracks
```

### Artists

```text
artists
├── id
├── name
├── created_at
└── updated_at
```

### Albums

```text
albums
├── id
├── title
├── artist_id
├── created_at
└── updated_at
```

### Tracks

```text
tracks
├── id
├── title
├── album_id
├── duration
├── original_file_name
├── file_hash
├── file_object_key
├── created_at
└── updated_at
```

`duration` is stored in milliseconds.

`file_hash` represents the contents of the uploaded file, while `file_object_key` identifies the corresponding object in RustFS.

## Project Structure

```text
audio-player/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── tracks/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── stream/
│   │   │   │   │       └── route.ts
│   │   │   │   └── route.ts
│   │   │   │
│   │   │   └── upload/
│   │   │       └── route.ts
│   │   │
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── db/
│   │   ├── db.ts
│   │   └── schema.ts
│   │
│   └── lib/
│       └── storage/
│           ├── s3.ts
│           └── s3-test.ts
│
├── drizzle/
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

The frontend is intentionally kept in a single `page.tsx` because the purpose of the project was to learn the underlying concepts without introducing unnecessary application architecture.

## Environment Variables

Create a `.env` file:

```env
DATABASE_URL=mysql://username:password@localhost:3306/music

S3_ENDPOINT=http://your-s3-endpoint
S3_REGION=home
S3_BUCKET=music

AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

Keep `.env` out of version control.

## Running the Project

Install dependencies:

```bash
npm install
```

Generate Drizzle migrations:

```bash
npx drizzle-kit generate
```

Apply migrations:

```bash
npx drizzle-kit migrate
```

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## API

### Get tracks

```http
GET /api/tracks
```

### Search

```http
GET /api/tracks?search=artist
```

### Sorting

```http
GET /api/tracks?sortBy=title&order=asc
```

Supported sort fields:

```text
title
artist
album
duration
createdAt
```

### Pagination

```http
GET /api/tracks?page=1&limit=20
```

### Upload

```http
POST /api/upload
```

Files are submitted using the `files` multipart form field.

Multiple files can be uploaded in a single request.

### Stream

```http
GET /api/tracks/:id/stream
```

Example:

```text
/api/tracks/1/stream
```

The endpoint supports HTTP `Range` requests and returns `206 Partial Content` when a valid range is requested.

## Storage

The project uses RustFS as an S3-compatible object store.

Instead of storing audio like:

```text
uploads/
├── song1.mp3
├── song2.mp3
└── song3.mp3
```

the application treats the audio as objects in object storage.

The database stores the reference:

```text
file_object_key
```

while RustFS stores the actual file.

Conceptually:

```text
MariaDB

Track
 ├── title
 ├── artist
 ├── album
 └── file_object_key
              │
              ▼
           RustFS
              │
              └── audio object
```

## What This Project Demonstrates

The main purpose of the project was to learn how the different parts of a media application fit together.

In particular:

* Building APIs with Next.js
* Working with MariaDB
* Using Drizzle ORM
* Designing relational tables
* Uploading files with `multipart/form-data`
* Generating file hashes
* Using S3-compatible object storage
* Retrieving objects from storage
* HTTP range requests
* Browser audio streaming
* Building a basic music player
* Searching and paginating database results
* Connecting a React frontend to backend APIs

## Project Goal

The goal was **learning**, not building a production-ready music service.

The project was intentionally built from the ground up to understand what happens behind a music streaming application—from uploading a file and storing its metadata to retrieving the file and playing it in the browser.


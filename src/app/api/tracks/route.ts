
import { NextRequest, NextResponse } from "next/server";
import { eq, or, like, asc, desc, count } from "drizzle-orm";

import { db } from "@/db/db";
import { tracks, albums, artists } from "@/db/schema";

// Define the columns that can be used for sorting
const sortColumns = {
  title: tracks.title,
  artist: artists.name,
  album: albums.title,
  duration: tracks.duration,
  createdAt: tracks.createdAt,
} as const;

type SortBy = keyof typeof sortColumns;

// GET handler for fetching tracks with pagination, sorting and filtering
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;

    // Filtering
    const search = params.get("search")?.trim();

    // Sorting
    const requestedSort = params.get("sortBy") ?? "title";
    const sortBy: SortBy = Object.hasOwn(sortColumns, requestedSort)
      ? (requestedSort as SortBy)
      : "title";

    const order = params.get("order") === "desc" ? "desc" : "asc";

    // Pagination
    const requestedPage = Number(params.get("page") ?? 1);
    const requestedLimit = Number(params.get("limit") ?? 20);

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 20;

    const offset = (page - 1) * limit;

    const query = db
      .select({
        id: tracks.id,
        title: tracks.title,
        duration: tracks.duration,
        artist: artists.name,
        album: albums.title,
        createdAt: tracks.createdAt,
      })
      .from(tracks)
      .leftJoin(albums, eq(tracks.albumId, albums.id))
      .leftJoin(artists, eq(albums.artistId, artists.id));

    // Count query to get the total number of tracks matching the filter
    const countQuery = db
      .select({ total: count() })
      .from(tracks)
      .leftJoin(albums, eq(tracks.albumId, albums.id))
      .leftJoin(artists, eq(albums.artistId, artists.id));

    const filteredQuery = search
      ? query.where(
          or(
            like(tracks.title, `%${search}%`),
            like(artists.name, `%${search}%`),
            like(albums.title, `%${search}%`)
          )
        )
      : query;

    const filteredCountQuery = search
      ? countQuery.where(
          or(
            like(tracks.title, `%${search}%`),
            like(artists.name, `%${search}%`),
            like(albums.title, `%${search}%`)
          )
        )
      : countQuery;

    const [result, countResult] = await Promise.all([
      filteredQuery
        .orderBy(
          order === "desc"
            ? desc(sortColumns[sortBy])
            : asc(sortColumns[sortBy])
        )
        .limit(limit)
        .offset(offset),
      filteredCountQuery,
    ]);

    const total = Number(countResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: result,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && total > 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch tracks:", error);

    return NextResponse.json(
      { error: "Failed to fetch tracks" },
      { status: 500 }
    );
  }
}
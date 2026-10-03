import { int, mysqlTable, varchar, timestamp } from "drizzle-orm/mysql-core";

// artists table
export const artists = mysqlTable("artists", {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// albums table
export const albums = mysqlTable("albums", {
    id: int("id").primaryKey().autoincrement(),
    title: varchar("title", { length: 255 }).notNull(),
    artistId: int("artist_id").notNull().references(() => artists.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// tracks table
export const tracks = mysqlTable("tracks", {
    id: int("id").primaryKey().autoincrement(),
    title: varchar("title", { length: 255 }).notNull(),
    albumId: int("album_id").notNull().references(() => albums.id),
    duration: int("duration").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

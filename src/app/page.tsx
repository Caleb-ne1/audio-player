"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Track = {
  id: number;
  title: string;
  duration: number | null;
  artist: string | null;
  album: string | null;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type SortBy = "title" | "artist" | "album" | "duration" | "createdAt";
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
  { value: "album", label: "Album" },
  { value: "duration", label: "Length" },
  { value: "createdAt", label: "Recently added" },
];


function formatDuration(duration: number | null) {
  if (duration === null) return "–:––";
  const totalSeconds = Math.floor(duration / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatPlayerTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/*
 * Tracks have no artwork, so every track gets a stable "sleeve"
 * generated from its text. The same hue also tints the whole page
 * while that track is playing.
 */
function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function trackHue(track: Track) {
  return hashString(`${track.album ?? ""}${track.artist ?? ""}`) % 360;
}

function sleeveStyle(track: Track): React.CSSProperties {
  const hue = trackHue(track);
  const seed = hashString(track.title);
  const angle = seed % 360;
  const hue2 = (hue + 40 + (seed % 50)) % 360;

  return {
    background: `linear-gradient(${angle}deg, hsl(${hue} 70% 52%), hsl(${hue2} 75% 34%))`,
  };
}

type IconProps = { className?: string };

const PlayIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8Z" />
  </svg>
);

const PauseIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="6" y="4" width="4.5" height="16" rx="1.2" />
    <rect x="13.5" y="4" width="4.5" height="16" rx="1.2" />
  </svg>
);

const PrevIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="5" y="5" width="2.5" height="14" rx="1" />
    <path d="M19 6.2v11.6a.8.8 0 0 1-1.25.66l-8.4-5.8a.8.8 0 0 1 0-1.32l8.4-5.8A.8.8 0 0 1 19 6.2Z" />
  </svg>
);

const NextIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="16.5" y="5" width="2.5" height="14" rx="1" />
    <path d="M5 6.2v11.6a.8.8 0 0 0 1.25.66l8.4-5.8a.8.8 0 0 0 0-1.32l-8.4-5.8A.8.8 0 0 0 5 6.2Z" />
  </svg>
);

const SearchIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const UploadIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14" />
  </svg>
);

const VolumeIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

/* Animated bars shown on the row that is playing */
function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2, 3].map((bar) => (
        <span
          key={bar}
          className="eq-bar w-[3px] rounded-full bg-white"
          style={{
            height: "100%",
            animationDelay: `${bar * 0.15}s`,
            animationPlayState: playing ? "running" : "paused",
          }}
        />
      ))}
    </span>
  );
}

/* A square cover generated from the track */
function Sleeve({
  track,
  className = "h-11 w-11",
  children,
}: {
  track: Track;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-md ${className}`}
      style={sleeveStyle(track)}
    >
      {/* the record peeking out of the sleeve */}
      <span className="absolute -bottom-3 -right-3 h-3/4 w-3/4 rounded-full border border-white/20 bg-black/25" />
      <span className="absolute bottom-[2px] right-[2px] h-2 w-2 rounded-full bg-white/50" />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Home() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Library
  const [tracks, setTracks] = useState<Track[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Sorting
  const [sortBy, setSortBy] = useState<SortBy>("title");
  const [order, setOrder] = useState<SortOrder>("asc");

  // Pagination
  const [page, setPage] = useState(1);

  // Player
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Upload
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const hue = currentTrack ? trackHue(currentTrack) : 265;
  const accent = `hsl(${hue} 90% 72%)`;
  const progress =
    playerDuration > 0 ? Math.min(100, (currentTime / playerDuration) * 100) : 0;

  /* Load tracks */
  const loadTracks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      params.set("sortBy", sortBy);
      params.set("order", order);
      if (search) params.set("search", search);

      const response = await fetch(`/api/tracks?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch tracks");

      const data = await response.json();
      setTracks(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Failed to load tracks:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load tracks"
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, order]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  /* Search */
  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  /* Sorting */
  function handleSortChange(value: SortBy) {
    if (value === sortBy) {
      setOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(value);
      setOrder(value === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
  }

  /* Play track */
  function playTrack(track: Track) {
    setCurrentTrack(track);
    setIsPlaying(true);
    setCurrentTime(0);
    setPlayerDuration(0);
  }

  /* Load selected track into audio element */
  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    const audio = audioRef.current;
    audio.src = `/api/tracks/${currentTrack.id}/stream`;
    audio.load();

    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch((error) => {
        console.error("Failed to play audio:", error);
        setIsPlaying(false);
      });
  }, [currentTrack]);

  /* Play / pause */
  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    try {
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error("Playback failed:", error);
    }
  }

  function previousTrack() {
    if (!currentTrack || tracks.length === 0) return;

    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);

    if (currentIndex > 0) {
      playTrack(tracks[currentIndex - 1]);
      return;
    }
    if (audioRef.current) audioRef.current.currentTime = 0;
  }

  function nextTrack() {
    if (!currentTrack || tracks.length === 0) return;

    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex < tracks.length - 1) {
      playTrack(tracks[currentIndex + 1]);
    }
  }

  function handleEnded() {
    if (!currentTrack) return;

    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex < tracks.length - 1) {
      playTrack(tracks[currentIndex + 1]);
    } else {
      setIsPlaying(false);
    }
  }

  /* Seek / volume */
  function handleSeek(event: React.ChangeEvent<HTMLInputElement>) {
    const time = Number(event.target.value);
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
  }

  function handleVolumeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = Number(event.target.value);
    setVolume(value);
    if (audioRef.current) audioRef.current.volume = value;
  }

  function handleTimeUpdate() {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  }

  function handleLoadedMetadata() {
    if (audioRef.current) setPlayerDuration(audioRef.current.duration);
  }

  /* Upload */
  function addFiles(files: File[]) {
    setSelectedFiles((existing) => {
      const known = new Set(existing.map((f) => `${f.name}-${f.size}`));
      return [...existing, ...files.filter((f) => !known.has(`${f.name}-${f.size}`))];
    });
    setUploadError(null);
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    // Allows selecting the same file again later.
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (uploading) return;
    addFiles(
      Array.from(event.dataTransfer.files).filter((f) =>
        f.type.startsWith("audio/")
      )
    );
  }

  function removeFile(index: number) {
    setSelectedFiles((files) => files.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      for (const file of selectedFiles) formData.append("files", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload failed");

      setSelectedFiles([]);
      await loadTracks();
      setUploadOpen(false);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadError(
        error instanceof Error ? error.message : "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  }

  function closeUploadModal() {
    if (uploading) return;
    setUploadOpen(false);
    setSelectedFiles([]);
    setUploadError(null);
  }

  /* Keyboard: Escape closes the modal, Space toggles playback */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && uploadOpen && !uploading) {
        closeUploadModal();
        return;
      }

      const target = event.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "BUTTON";

      if (event.code === "Space" && !typing && !uploadOpen && currentTrack) {
        event.preventDefault();
        togglePlay();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadOpen, uploading, currentTrack]);

  /* -------------------------------------------------------------- */
  /* Render                                                          */
  /* -------------------------------------------------------------- */

  return (
    <main
      className="relative min-h-screen overflow-x-hidden bg-[#13111a] pb-44 text-[#ece8f4]"
      style={{
        fontFamily: "var(--font-body), system-ui, sans-serif",
        ["--accent" as string]: accent,
      }}
    >
      <style>{`
        .display { font-family: var(--font-display), system-ui, sans-serif; }

        @keyframes eq {
          0%, 100% { transform: scaleY(0.25); }
          50% { transform: scaleY(1); }
        }
        .eq-bar {
          transform-origin: bottom;
          animation: eq 0.9s ease-in-out infinite;
        }

        .range {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,0.14);
          outline: none;
          cursor: pointer;
        }
        .range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #fff;
          border: 0;
          opacity: 0;
          transition: opacity .15s;
        }
        .range::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #fff;
          border: 0;
          opacity: 0;
          transition: opacity .15s;
        }
        .range:hover::-webkit-slider-thumb,
        .range:focus-visible::-webkit-slider-thumb { opacity: 1; }
        .range:hover::-moz-range-thumb,
        .range:focus-visible::-moz-range-thumb { opacity: 1; }

        .focus-ring:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .eq-bar { animation: none; transform: scaleY(0.6); }
          * { transition-duration: 0s !important; }
        }
      `}</style>

      {/* Ambient tint: takes the colour of whatever is playing */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] transition-colors duration-1000"
        style={{
          backgroundColor: `hsl(${hue} 65% ${currentTrack ? 30 : 18}%)`,
          opacity: currentTrack ? 0.5 : 0.35,
          maskImage:
            "radial-gradient(70% 100% at 50% 0%, #000 0%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(70% 100% at 50% 0%, #000 0%, transparent 100%)",
        }}
      />

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="metadata"
      />

      <div className="relative mx-auto max-w-5xl px-5 sm:px-8">
        {/* Header */}
        <header className="flex items-center gap-4 py-6">
          <h1 className="display text-2xl font-semibold tracking-tight">
            Music
          </h1>

          <form onSubmit={handleSearch} className="relative ml-auto w-full max-w-md">
            <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f879c]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search songs, artists, albums"
              aria-label="Search your library"
              className="focus-ring w-full rounded-full border border-white/10 bg-white/[0.06] py-2.5 pl-10 pr-10 text-sm outline-none transition placeholder:text-[#8f879c] focus:border-white/25 focus:bg-white/10"
            />
            {(searchInput || search) && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="focus-ring absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#8f879c] transition hover:text-white"
              >
                ×
              </button>
            )}
          </form>

          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="focus-ring flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-[#13111a] transition hover:bg-white/85"
          >
            <UploadIcon />
            <span className="hidden sm:inline">Add music</span>
          </button>
        </header>

        {/* Library heading */}
        <section className="pb-24 pt-10 sm:pt-14">
          <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="display text-5xl font-semibold leading-none tracking-tight sm:text-6xl">
                {search ? `“${search}”` : "Your library"}
              </h2>
              <p className="mt-3 text-sm text-[#8f879c]">
                {pagination?.total ?? 0}{" "}
                {pagination?.total === 1 ? "track" : "tracks"}
                {search && " found"}
              </p>
            </div>

            {/* Sort: tap a chip to sort, tap again to flip direction */}
            <div
              role="group"
              aria-label="Sort tracks"
              className="-mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0"
            >
              {SORT_OPTIONS.map((option) => {
                const selected = sortBy === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSortChange(option.value)}
                    aria-pressed={selected}
                    className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${
                      selected
                        ? "bg-white/15 text-white"
                        : "text-[#8f879c] hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {option.label}
                    {selected && (
                      <span aria-label={order === "asc" ? "ascending" : "descending"}>
                        {order === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {!loading && error && (
            <div
              role="alert"
              className="rounded-xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-300"
            >
              {error}.{" "}
              <button
                type="button"
                onClick={loadTracks}
                className="focus-ring underline underline-offset-2 hover:text-white"
              >
                Try again
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-1" aria-busy="true" aria-label="Loading tracks">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-3 py-3">
                  <div className="h-11 w-11 animate-pulse rounded-md bg-white/[0.07]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-white/[0.07]" />
                    <div className="h-3 w-1/5 animate-pulse rounded bg-white/[0.05]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && !error && tracks.length === 0 && (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/15 px-6 py-20 text-center">
              <h3 className="display text-2xl font-semibold">
                {search ? "Nothing matches that search" : "Your library is empty"}
              </h3>
              <p className="mt-2 max-w-xs text-sm text-[#8f879c]">
                {search
                  ? "Check the spelling or search by artist or album instead."
                  : "Add some songs and they will show up here, ready to play."}
              </p>
              <button
                type="button"
                onClick={search ? clearSearch : () => setUploadOpen(true)}
                className="focus-ring mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#13111a] transition hover:bg-white/85"
              >
                {search ? "Clear search" : "Add music"}
              </button>
            </div>
          )}

          {/* Track list */}
          {!loading && !error && tracks.length > 0 && (
            <div>
              <div className="hidden grid-cols-[44px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_64px] gap-4 border-b border-white/10 px-3 pb-3 text-xs text-[#8f879c] md:grid">
                <span />
                <span>Title</span>
                <span>Artist</span>
                <span>Album</span>
                <span className="text-right">Length</span>
              </div>

              <ul className="mt-2">
                {tracks.map((track) => {
                  const active = currentTrack?.id === track.id;

                  return (
                    <li key={track.id}>
                      <button
                        type="button"
                        onClick={() => (active ? togglePlay() : playTrack(track))}
                        aria-label={`${active && isPlaying ? "Pause" : "Play"} ${track.title}`}
                        className={`focus-ring group grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-3 py-2.5 text-left transition md:grid-cols-[44px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_64px] ${
                          active ? "bg-white/10" : "hover:bg-white/[0.06]"
                        }`}
                      >
                        {/* Cover with play state */}
                        <Sleeve track={track}>
                          <span
                            className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white transition ${
                              active
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                            }`}
                          >
                            {active && isPlaying ? (
                              <Equalizer playing />
                            ) : (
                              <PlayIcon />
                            )}
                          </span>
                        </Sleeve>

                        {/* Title (+ artist on mobile) */}
                        <div className="min-w-0">
                          <p
                            className="truncate font-medium"
                            style={active ? { color: "var(--accent)" } : undefined}
                          >
                            {track.title}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-[#8f879c] md:hidden">
                            {track.artist ?? "Unknown artist"}
                          </p>
                        </div>

                        <p className="hidden truncate text-sm text-[#b3abc0] md:block">
                          {track.artist ?? "Unknown artist"}
                        </p>

                        <p className="hidden truncate text-sm text-[#b3abc0] md:block">
                          {track.album ?? "Unknown album"}
                        </p>

                        <p className="text-right text-sm tabular-nums text-[#8f879c]">
                          {formatDuration(track.duration)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Pagination */}
          {!loading && pagination && pagination.totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-8 flex items-center justify-between"
            >
              <p className="text-sm text-[#8f879c]">
                Page {pagination.page} of {pagination.totalPages}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => setPage((current) => current - 1)}
                  className="focus-ring rounded-full border border-white/15 px-4 py-2 text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                  className="focus-ring rounded-full border border-white/15 px-4 py-2 text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </section>
      </div>

      {/* Upload modal */}
      {uploadOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-title"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeUploadModal();
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/10 bg-[#1b1824] shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between px-6 pb-2 pt-6">
              <div>
                <h2 id="upload-title" className="display text-2xl font-semibold">
                  Add music
                </h2>
                <p className="mt-1 text-sm text-[#8f879c]">
                  Songs are added to your library when the upload finishes.
                </p>
              </div>

              <button
                type="button"
                disabled={uploading}
                onClick={closeUploadModal}
                aria-label="Close"
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#8f879c] transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                ×
              </button>
            </div>

            <div className="p-6 pt-4">
              <label
                htmlFor="music-upload"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-6 py-10 text-center transition ${
                  uploading
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:border-white/40 hover:bg-white/[0.06]"
                }`}
              >
                <UploadIcon className="mb-3 h-6 w-6 text-[#b3abc0]" />
                <p className="font-medium">Drop audio files here or browse</p>
                <p className="mt-1 text-sm text-[#8f879c]">
                  MP3, FLAC, M4A, OGG, WAV and more
                </p>

                <input
                  id="music-upload"
                  type="file"
                  multiple
                  accept="audio/*"
                  className="sr-only"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </label>

              {selectedFiles.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-sm text-[#8f879c]">
                    {selectedFiles.length}{" "}
                    {selectedFiles.length === 1 ? "file" : "files"} ready
                  </p>

                  <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${file.size}`}
                        className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{file.name}</p>
                          <p className="text-xs text-[#8f879c]">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => removeFile(index)}
                          aria-label={`Remove ${file.name}`}
                          className="focus-ring flex h-7 w-7 items-center justify-center rounded-full text-lg text-[#8f879c] transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {uploadError && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                >
                  {uploadError}
                </div>
              )}

              <button
                type="button"
                disabled={selectedFiles.length === 0 || uploading}
                onClick={handleUpload}
                className="focus-ring mt-6 w-full rounded-full bg-white px-4 py-3 text-sm font-medium text-[#13111a] transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading
                  ? "Uploading…"
                  : selectedFiles.length > 0
                    ? `Upload ${selectedFiles.length} ${
                        selectedFiles.length === 1 ? "song" : "songs"
                      }`
                    : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player dock */}
      {currentTrack && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6 sm:pb-5">
          <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-3xl border border-white/10 bg-[#1b1824]/90 p-3 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] sm:p-4">
            {/* Now playing */}
            <div className="flex min-w-0 items-center gap-3">
              <Sleeve track={currentTrack} className="h-12 w-12 sm:h-14 sm:w-14" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {currentTrack.title}
                </p>
                <p className="truncate text-xs text-[#8f879c]">
                  {currentTrack.artist ?? "Unknown artist"}
                </p>
              </div>
            </div>

            {/* Controls + progress */}
            <div className="order-3 col-span-2 flex flex-col items-center gap-1.5 sm:order-none sm:col-span-1">
              <div className="hidden items-center gap-3 sm:flex">
                <button
                  type="button"
                  onClick={previousTrack}
                  aria-label="Previous track"
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-[#b3abc0] transition hover:text-white"
                >
                  <PrevIcon />
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="focus-ring flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#13111a] transition hover:scale-105"
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={nextTrack}
                  aria-label="Next track"
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-[#b3abc0] transition hover:text-white"
                >
                  <NextIcon />
                </button>
              </div>

              <div className="flex w-full items-center gap-3">
                <span className="w-9 text-right text-xs tabular-nums text-[#8f879c]">
                  {formatPlayerTime(currentTime)}
                </span>

                <input
                  type="range"
                  aria-label="Seek"
                  min="0"
                  max={playerDuration || 0}
                  step="0.1"
                  value={Math.min(currentTime, playerDuration || 0)}
                  onChange={handleSeek}
                  className="range flex-1"
                  style={{
                    background: `linear-gradient(to right, var(--accent) ${progress}%, rgba(255,255,255,0.14) ${progress}%)`,
                  }}
                />

                <span className="w-9 text-xs tabular-nums text-[#8f879c]">
                  {formatPlayerTime(playerDuration)}
                </span>
              </div>
            </div>

            {/* Mobile transport */}
            <div className="flex items-center gap-1 sm:hidden">
              <button
                type="button"
                onClick={previousTrack}
                aria-label="Previous track"
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-full text-[#b3abc0]"
              >
                <PrevIcon />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="focus-ring flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#13111a]"
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={nextTrack}
                aria-label="Next track"
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-full text-[#b3abc0]"
              >
                <NextIcon />
              </button>
            </div>

            {/* Volume */}
            <div className="hidden items-center justify-end gap-2 sm:flex">
              <VolumeIcon className="h-4 w-4 text-[#8f879c]" />
              <input
                type="range"
                aria-label="Volume"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="range w-24"
                style={{
                  background: `linear-gradient(to right, #fff ${volume * 100}%, rgba(255,255,255,0.14) ${volume * 100}%)`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


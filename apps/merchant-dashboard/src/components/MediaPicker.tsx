import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import type { MediaAsset, Product, ProductListParams } from "@store-builder/api-client";
import { IconCheck, IconClose, IconImage, IconImageMissing, IconLock, IconPlay, IconSearch, IconUpload, IconVideo, IconWarning } from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { Sheet } from "@/components/Sheet";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage, isPermissionError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { ACCEPTED_IMAGE_ACCEPT, ACCEPTED_IMAGE_MIMES, MAX_IMAGE_BYTES, compressImageIfNeeded, imageSrc, validateImageFile } from "@/lib/media";
import { useCursorList } from "@/lib/useCursorList";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

/**
 * The store's media library as a sheet to pick from: every file uploaded to
 * the store, newest first, in a grid of square thumbnails. A tap picks — the
 * tile shows a check and the sheet closes. A new file can be uploaded without
 * leaving it (the same call, shrinking and checks the image fields use); a
 * single upload is picked straight away.
 *
 * The library keeps no names for its files, so the search box looks where
 * names do exist: it finds the photos of a product by the product's name
 *.
 */

const PAGE_LIMIT = 36;
/** A page with nothing of the wanted kind fetches the next one by itself, this many times at most. */
const AUTO_PAGES = 3;
const SEARCH_DELAY_MS = 300;
const SEARCH_MIN_CHARS = 2;
const VIDEO_ACCEPT = "video/mp4,video/webm";
const VIDEO_MIMES = ["video/mp4", "video/webm"];
/** The backend's limit for a video (modules/media/mediaService.js). */
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

const STRINGS = {
  en: {
    titleImage: "Choose a picture",
    titleVideo: "Choose a video",
    description: "Everything you uploaded to this store, newest first.",
    search: "Find a product's photos by its name",
    searchVideo: "Find a product's videos by its name",
    clearSearch: "Clear the search",
    uploadImage: "Upload a picture",
    uploadVideo: "Upload a video",
    preparing: "Getting it ready…",
    uploading: "Uploading {i} of {n}…",
    uploadedMany: "{n} files uploaded — pick one.",
    pickImage: "Use the picture uploaded {when}",
    pickVideo: "Use the video uploaded {when}",
    pickProduct: "Use this picture of {name}",
    picked: "Picked",
    emptyImage: "No pictures yet",
    emptyVideo: "No videos yet",
    emptyDesc: "Upload one here and it stays in your library for next time.",
    searching: "Searching…",
    resultsFor: "Photos of products named “{q}”",
    noResults: "No product by that name has a photo.",
    noResultsHint: "Files uploaded straight to the library have no name to search by — clear the search to see them all.",
    searchFailed: "The search didn't go through.",
    loadFailed: "We couldn't load your library.",
    retry: "Try again",
    deniedTitle: "The media library isn't part of your role",
    deniedDesc: "The store owner can open it for you from Settings → Team (the “manage products” permission).",
    notImage: "“{name}” isn't a PNG, JPEG, GIF or WEBP picture.",
    notVideo: "“{name}” isn't an MP4 or WebM video.",
    tooBigImage: "“{name}” is over {mb} MB even after shrinking. Try a smaller picture.",
    tooBigVideo: "“{name}” is over {mb} MB. Try a shorter or smaller video.",
    emptyFile: "“{name}” is empty.",
    broken: "This file can't be shown",
  },
  ar: {
    titleImage: "اختيار صورة",
    titleVideo: "اختيار مقطع فيديو",
    description: "كل ما رفعته إلى هذا المتجر، الأحدث أولًا.",
    search: "ابحث عن صور منتج باسمه",
    searchVideo: "ابحث عن مقاطع فيديو منتج باسمه",
    clearSearch: "مسح البحث",
    uploadImage: "رفع صورة",
    uploadVideo: "رفع مقطع فيديو",
    preparing: "جارٍ التجهيز…",
    uploading: "جارٍ رفع {i} من {n}…",
    uploadedMany: "رُفعت {n} ملفات — اختر واحدًا.",
    pickImage: "استخدام الصورة المرفوعة {when}",
    pickVideo: "استخدام مقطع الفيديو المرفوع {when}",
    pickProduct: "استخدام هذه الصورة من {name}",
    picked: "تم الاختيار",
    emptyImage: "لا توجد صور بعد",
    emptyVideo: "لا توجد مقاطع فيديو بعد",
    emptyDesc: "ارفع ملفًا من هنا ليبقى في مكتبتك للمرات القادمة.",
    searching: "جارٍ البحث…",
    resultsFor: "صور المنتجات التي يحتوي اسمها على «{q}»",
    noResults: "لا يوجد منتج بهذا الاسم له صورة.",
    noResultsHint: "الملفات المرفوعة إلى المكتبة مباشرة ليس لها اسم يُبحث به — امسح البحث لعرضها كلها.",
    searchFailed: "لم يكتمل البحث.",
    loadFailed: "تعذّر تحميل مكتبتك.",
    retry: "إعادة المحاولة",
    deniedTitle: "مكتبة الوسائط ليست ضمن صلاحياتك",
    deniedDesc: "يستطيع مالك المتجر إتاحتها لك من الإعدادات ← الفريق (صلاحية «إدارة المنتجات»).",
    notImage: "«{name}» ليس صورة PNG أو JPEG أو GIF أو WEBP.",
    notVideo: "«{name}» ليس مقطع فيديو MP4 أو WebM.",
    tooBigImage: "«{name}» أكبر من {mb} ميجابايت حتى بعد التصغير. جرّب صورة أصغر.",
    tooBigVideo: "«{name}» أكبر من {mb} ميجابايت. جرّب مقطعًا أقصر أو أصغر.",
    emptyFile: "«{name}» فارغ.",
    broken: "تعذّر عرض هذا الملف",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];
type Accept = "image" | "video";

export interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The chosen file. `id` is its library id, missing for an old product photo that never got one. */
  onPick: (file: { url: string; id?: string }) => void;
  accept?: Accept;
  title?: string;
}

/** One thing that can be picked, from the library or from a product's own photos. */
interface Tile {
  key: string;
  url: string;
  id?: string;
  mimeType: string;
  label: string;
}

const isKind = (mimeType: string, accept: Accept) => mimeType.startsWith(accept === "video" ? "video/" : "image/");

/** Why a file can't be uploaded, in the dashboard's language; null when it can. */
function fileProblem(file: File, accept: Accept, t: Strings): string | null {
  const name = file.name;
  if (accept === "video") {
    const byType = file.type ? VIDEO_MIMES.includes(file.type) : /\.(mp4|webm)$/i.test(name);
    if (!byType) return fmt(t.notVideo, { name });
    if (file.size === 0) return fmt(t.emptyFile, { name });
    return file.size > MAX_VIDEO_BYTES ? fmt(t.tooBigVideo, { name, mb: MAX_VIDEO_BYTES / (1024 * 1024) }) : null;
  }
  // The shared check decides; this only says its reason in the merchant's language.
  if (validateImageFile(file) === null) return null;
  const byType = file.type ? ACCEPTED_IMAGE_MIMES.includes(file.type) : /\.(png|jpe?g|gif|webp)$/i.test(name);
  if (!byType) return fmt(t.notImage, { name });
  if (file.size === 0) return fmt(t.emptyFile, { name });
  return file.size > MAX_IMAGE_BYTES ? fmt(t.tooBigImage, { name, mb: MAX_IMAGE_BYTES / (1024 * 1024) }) : (validateImageFile(file) ?? null);
}

/**
 * Products whose name holds the query, asked for a moment after the typing
 * stops — the box itself answers every key at once. An answer that arrives
 * after the query moved on is dropped.
 */
function useProductSearch(workspaceId: string, query: string) {
  const q = query.trim();
  const active = q.length >= SEARCH_MIN_CHARS;
  const [state, setState] = useState<{ q: string; products: Product[] | null; error: unknown }>({ q: "", products: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    let live = true;
    const timer = window.setTimeout(() => {
      apiClient
        .listProducts(workspaceId, { q, limit: 24, status: ["active", "draft"] } as ProductListParams)
        .then(({ products }) => live && setState({ q, products, error: null }))
        .catch((error: unknown) => live && setState({ q, products: null, error }));
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [workspaceId, q, active, attempt]);

  const settled = active && state.q === q;
  return {
    active,
    loading: active && !settled,
    products: settled ? state.products : null,
    error: settled ? state.error : null,
    retry: () => {
      setState({ q: "", products: null, error: null });
      setAttempt((n) => n + 1);
    },
  };
}

function TileButton({ tile, picked, onPick, t }: { tile: Tile; picked: boolean; onPick: () => void; t: Strings }) {
  const [broken, setBroken] = useState(false);
  const video = tile.mimeType.startsWith("video/");
  const src = imageSrc(tile.url) ?? tile.url;
  return (
    <li>
      <button
        type="button"
        data-slot="media-tile"
        data-picked={picked ? "" : undefined}
        aria-label={tile.label}
        aria-pressed={picked}
        onClick={onPick}
        // The square is there before the picture is: nothing below it moves when thumbnails arrive.
        className="relative block aspect-square w-full cursor-pointer overflow-hidden rounded-[0.875rem] bg-paper-sunken ring-1 ring-line transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
      >
        {broken ? (
          <span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-[11px] leading-4 text-ink-soft">
            <IconImageMissing className="size-5" aria-hidden />
            {t.broken}
          </span>
        ) : video ? (
          <>
            <video src={`${src}#t=0.1`} preload="metadata" muted playsInline className="size-full object-cover" onError={() => setBroken(true)} />
            <span aria-hidden className="absolute start-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full bg-ink/70 text-paper">
              <IconPlay className="size-3" />
            </span>
          </>
        ) : (
          <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => setBroken(true)} />
        )}
        {picked && (
          <span className="zimos-media-picked absolute inset-0 flex items-center justify-center bg-ink/40">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-raised)]">
              <IconCheck className="size-5" aria-hidden />
            </span>
            <span className="sr-only">{t.picked}</span>
          </span>
        )}
      </button>
    </li>
  );
}

const GRID = "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5";

function GridSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <div className={GRID} aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-[0.875rem] bg-paper-sunken motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}

function Notice({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="mb-3 flex size-14 items-center justify-center rounded-[1.25rem] bg-paper-sunken text-ink-soft [&_svg]:size-7">{icon}</span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-ink-soft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function PickerBody({ accept, onPick, onDone }: { accept: Accept; onPick: MediaPickerProps["onPick"]; onDone: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; stage: "prepare" | "upload" } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [uploadDenied, setUploadDenied] = useState(false);
  const closing = useRef<number | null>(null);

  const library = useCursorList<MediaAsset>(
    async (before) => {
      const page = await apiClient.listMedia(workspaceId, { limit: PAGE_LIMIT, ...(before ? { before } : {}) });
      return { items: page.media, nextCursor: page.nextCursor };
    },
    [workspaceId]
  );
  const search = useProductSearch(workspaceId, query);

  useEffect(
    () => () => {
      if (closing.current !== null) window.clearTimeout(closing.current);
    },
    []
  );

  const wanted = library.items.filter((asset) => isKind(asset.mimeType, accept));

  // The list cannot be asked for one kind of file: a page that held none of it is followed by the next.
  const autoPages = useRef(0);
  useEffect(() => {
    if (library.loading || library.loadingMore || library.error || !library.hasMore) return;
    if (wanted.length >= 12 || autoPages.current >= AUTO_PAGES) return;
    autoPages.current += 1;
    library.loadMore();
    // Looks again after each page lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library.loading, library.loadingMore, library.hasMore, library.items.length]);

  function choose(tile: Tile) {
    if (pickedKey) return;
    setPickedKey(tile.key);
    onPick(tile.id ? { url: tile.url, id: tile.id } : { url: tile.url });
    // Long enough to see the check; at once for anyone who asked for less motion.
    const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closing.current = window.setTimeout(onDone, still ? 0 : 240);
  }

  async function upload(files: File[]) {
    if (files.length === 0 || progress) return;
    setProblems([]);
    setNote(null);
    const failed: string[] = [];
    const ready: File[] = [];

    setProgress({ done: 0, total: files.length, stage: "prepare" });
    for (const file of files) {
      let prepared = file;
      if (accept === "image") {
        try {
          prepared = await compressImageIfNeeded(file);
        } catch {
          // Could not be read here; the check below and the server have the last word.
        }
      }
      const problem = fileProblem(prepared, accept, t);
      if (problem) failed.push(problem);
      else ready.push(prepared);
    }

    const uploaded: MediaAsset[] = [];
    try {
      for (const [i, file] of ready.entries()) {
        setProgress({ done: i, total: ready.length, stage: "upload" });
        const media = await apiClient.uploadMedia(workspaceId, file);
        uploaded.push({ id: media.id, url: media.url, mimeType: media.mimeType, size: media.size, createdAt: new Date().toISOString() });
      }
    } catch (err) {
      if (isPermissionError(err)) setUploadDenied(true);
      else failed.push(getErrorMessage(err));
    }
    setProgress(null);
    setProblems(failed);

    if (uploaded.length === 0) return;
    // Newest first, as the server lists them; the paging cursor is the last row and is untouched.
    library.setItems((prev) => [...[...uploaded].reverse(), ...prev]);
    setQuery("");
    if (uploaded.length === 1 && failed.length === 0) {
      const only = uploaded[0];
      choose({ key: `m:${only.id}`, url: only.url, id: only.id, mimeType: only.mimeType, label: "" });
    } else {
      setNote(fmt(t.uploadedMany, { n: uploaded.length }));
    }
  }

  const denied = isPermissionError(library.error) || uploadDenied;
  const uploadLabel = accept === "video" ? t.uploadVideo : t.uploadImage;
  const UploadIcon = accept === "video" ? IconVideo : IconUpload;
  const busy = progress !== null;
  const uploadButton = (
    <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
      <UploadIcon aria-hidden />
      {uploadLabel}
    </Button>
  );

  const libraryTiles: Tile[] = wanted.map((asset) => ({
    key: `m:${asset.id}`,
    url: asset.url,
    id: asset.id,
    mimeType: asset.mimeType,
    label: fmt(accept === "video" ? t.pickVideo : t.pickImage, { when: formatDateTime(asset.createdAt) }),
  }));
  const productTiles: Tile[] = (search.products ?? []).flatMap((product) =>
    (product.media ?? [])
      .filter((media) => isKind(media.mimeType, accept))
      .map((media, i) => ({
        key: `p:${product.id}:${i}`,
        url: media.url,
        id: media.id,
        mimeType: media.mimeType,
        label: fmt(t.pickProduct, { name: product.name }),
      }))
  );

  const grid = (tiles: Tile[]) => (
    <ul className={GRID}>
      {tiles.map((tile) => (
        <TileButton key={tile.key} tile={tile} picked={pickedKey === tile.key} onPick={() => choose(tile)} t={t} />
      ))}
    </ul>
  );

  let content: ReactNode;
  if (denied) {
    content = <Notice icon={<IconLock aria-hidden />} title={t.deniedTitle} description={t.deniedDesc} />;
  } else if (search.active) {
    content = search.loading ? (
      <GridSkeleton label={t.searching} />
    ) : search.error ? (
      <Notice
        icon={<IconWarning aria-hidden />}
        title={t.searchFailed}
        description={getErrorMessage(search.error)}
        action={
          <Button type="button" variant="outline" onClick={search.retry}>
            {t.retry}
          </Button>
        }
      />
    ) : productTiles.length === 0 ? (
      <Notice icon={<IconSearch aria-hidden />} title={t.noResults} description={t.noResultsHint} />
    ) : (
      <>
        <p className="mb-2 text-xs font-medium text-ink-soft">{fmt(t.resultsFor, { q: query.trim() })}</p>
        {grid(productTiles)}
      </>
    );
  } else if (library.loading) {
    content = <GridSkeleton label={t.description} />;
  } else if (library.error) {
    content = (
      <Notice
        icon={<IconWarning aria-hidden />}
        title={t.loadFailed}
        description={getErrorMessage(library.error)}
        action={
          <Button type="button" variant="outline" onClick={library.reload}>
            {t.retry}
          </Button>
        }
      />
    );
  } else if (libraryTiles.length === 0 && !library.hasMore) {
    content = (
      <EmptyState
        icon={accept === "video" ? <IconVideo /> : <IconImage />}
        title={accept === "video" ? t.emptyVideo : t.emptyImage}
        description={t.emptyDesc}
        action={uploadButton}
      />
    );
  } else {
    content = (
      <>
        {grid(libraryTiles)}
        <LoadMore hasMore={library.hasMore} loading={library.loadingMore} onClick={library.loadMore} />
      </>
    );
  }

  const empty = !denied && !search.active && !library.loading && !library.error && libraryTiles.length === 0 && !library.hasMore;
  const share = progress ? (progress.stage === "prepare" ? 0.08 : Math.max(0.08, progress.done / Math.max(progress.total, 1))) : 0;

  return (
    <div data-slot="media-picker">
      {!denied && (
        <div data-slot="media-picker-bar" className="sticky top-0 z-10 -mx-5 -mt-4 mb-3 flex flex-wrap items-center gap-2 bg-paper-raised px-5 pt-4 pb-3">
          <div className="relative min-w-40 flex-1">
            <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={accept === "video" ? t.searchVideo : t.search}
              aria-label={accept === "video" ? t.searchVideo : t.search}
              className="ps-9 pe-10 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button
                type="button"
                aria-label={t.clearSearch}
                onClick={() => setQuery("")}
                className="absolute end-1 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink-soft before:absolute before:-inset-1.5 before:content-[''] hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
              >
                <IconClose className="size-4" aria-hidden />
              </button>
            )}
          </div>
          {/* An empty library offers the upload once, in its own message. */}
          {!empty && uploadButton}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept === "video" ? VIDEO_ACCEPT : ACCEPTED_IMAGE_ACCEPT}
        multiple
        className="hidden"
        aria-label={uploadLabel}
        onChange={(e) => {
          void upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {progress && (
        <div role="status" className="mb-3 space-y-1.5">
          <p className="text-xs font-medium text-ink-soft">
            {progress.stage === "prepare" ? t.preparing : fmt(t.uploading, { i: progress.done + 1, n: progress.total })}
          </p>
          <div data-slot="media-picker-progress" className="h-1.5 overflow-hidden rounded-full bg-paper-sunken">
            <div
              className={cn(
                "h-full w-full origin-[0_50%] rounded-full bg-primary transition-transform duration-[var(--dur-move)] ease-[var(--ease-out)] motion-reduce:transition-none rtl:origin-[100%_50%]",
                progress.total === 1 && "animate-pulse motion-reduce:animate-none"
              )}
              style={{ transform: `scaleX(${progress.total === 1 && progress.stage === "upload" ? 0.6 : share})` }}
            />
          </div>
        </div>
      )}
      {problems.length > 0 && (
        <Alert variant="danger" className="mb-3">
          {problems.map((problem, i) => (
            <p key={i}>{problem}</p>
          ))}
        </Alert>
      )}
      {note && (
        <p role="status" className="mb-3 text-xs font-medium text-ink-soft">
          {note}
        </p>
      )}

      {content}
    </div>
  );
}

export function MediaPicker({ open, onOpenChange, onPick, accept = "image", title }: MediaPickerProps) {
  const t = useT(STRINGS);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title ?? (accept === "video" ? t.titleVideo : t.titleImage)} description={t.description} size="lg">
      {/* Inside the sheet, so the library is read when it opens and forgotten when it closes. */}
      <PickerBody accept={accept} onPick={onPick} onDone={() => onOpenChange(false)} />
    </Sheet>
  );
}

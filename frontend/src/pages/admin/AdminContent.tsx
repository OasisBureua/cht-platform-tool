import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, RefreshCw, Search, Youtube } from 'lucide-react';
import { catalogApi, type WordPressPostItem } from '../../api/catalog';
import {
  formatWordPressCategoryLabel,
  ADMIN_WORDPRESS_CATALOG_STALE_MS,
} from '../../utils/wordpressCatalog';

const PAGE_SIZE = 24;
const FETCH_PAGE = 100;
/** Enough for 10k+ posts (ContentHub pages; page size max is 500 upstream). */
const MAX_FETCH_PAGES = 100;

/** ContentHub seed/test rows: hide probe/smoke posts from admin Content. */
function isProbeWordPressPost(post: WordPressPostItem): boolean {
  const slug = (post.slug || '').toLowerCase();
  const title = (post.title || '').toLowerCase();
  return (
    slug.includes('probe') ||
    title.includes('probe') ||
    slug.includes('smoke') ||
    title.includes('smoke')
  );
}

async function fetchAllWordPressPosts(fresh: boolean): Promise<{
  posts: WordPressPostItem[];
  upstreamTotal: number | null;
}> {
  const all: WordPressPostItem[] = [];
  let offset = 0;
  let upstreamTotal: number | null = null;
  for (let page = 0; page < MAX_FETCH_PAGES; page++) {
    const res = await catalogApi.getWordPressPosts({
      limit: FETCH_PAGE,
      offset,
      fresh,
    });
    if (typeof res.total === 'number') upstreamTotal = res.total;
    const batch = res.items ?? [];
    // Empty page ⇒ done. Do not treat a short page as EOF: the backend strips
    // probe/smoke posts per page, so the first page can be e.g. 85 of 100.
    if (batch.length === 0) break;
    all.push(...batch);
    // Advance by the requested page size (ContentHub offset), not filtered length.
    offset += FETCH_PAGE;
    if (res.total != null && offset >= res.total) break;
  }
  const seen = new Set<number>();
  const posts = withoutProbePosts(all).filter((p) => {
    if (seen.has(p.post_id)) return false;
    seen.add(p.post_id);
    return true;
  });
  return { posts, upstreamTotal };
}

function withoutProbePosts(items: WordPressPostItem[]): WordPressPostItem[] {
  return items.filter((p) => !isProbeWordPressPost(p));
}

function decodeHtmlEntities(text: string): string {
  if (typeof document === 'undefined') {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

function formatModified(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminContent() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState('');
  const [offset, setOffset] = useState(0);
  /** Bump to force ContentHub round-trip (skip CHT Redis). */
  const [freshNonce, setFreshNonce] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedQuery, category]);

  const fresh = freshNonce > 0;

  const { data: categoriesData } = useQuery({
    queryKey: ['catalog', 'wordpress', 'categories', freshNonce],
    queryFn: () => catalogApi.getWordPressCategories({ fresh }),
    staleTime: ADMIN_WORDPRESS_CATALOG_STALE_MS,
    refetchOnMount: 'always',
  });

  const { data, isLoading, isError, error, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['catalog', 'wordpress', 'posts', 'all', freshNonce],
    queryFn: () => fetchAllWordPressPosts(fresh),
    staleTime: ADMIN_WORDPRESS_CATALOG_STALE_MS,
    refetchOnMount: 'always',
  });

  const allPosts = data?.posts ?? [];
  const upstreamTotal = data?.upstreamTotal ?? null;

  const filteredPosts = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return allPosts.filter((p) => {
      if (category && !(p.categories ?? []).includes(category)) return false;
      if (!q) return true;
      const title = (p.title || '').toLowerCase();
      const slug = (p.slug || '').toLowerCase();
      return (
        title.includes(q) ||
        slug.includes(q) ||
        String(p.post_id).includes(q) ||
        (p.youtube_video_id || '').toLowerCase().includes(q)
      );
    });
  }, [allPosts, debouncedQuery, category]);

  const total = filteredPosts.length;
  const items = filteredPosts.slice(offset, offset + PAGE_SIZE);

  useEffect(() => {
    if (offset > 0 && offset >= total) {
      setOffset(Math.max(0, Math.floor(Math.max(0, total - 1) / PAGE_SIZE) * PAGE_SIZE));
    }
  }, [offset, total]);

  const categories = useMemo(
    () =>
      [...(categoriesData?.items ?? [])]
        .filter((c) => c.post_count > 0 && !c.slug.startsWith('hp-'))
        .sort((a, b) => b.post_count - a.post_count),
    [categoriesData?.items],
  );

  const canPrev = offset > 0;
  const canNext = offset + items.length < total;

  const onRefresh = () => {
    setFreshNonce((n) => n + 1);
    void queryClient.invalidateQueries({ queryKey: ['catalog', 'wordpress'] });
  };

  const updatedLabel =
    dataUpdatedAt > 0
      ? new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
            Content
          </h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Read-only view of what is currently live on WordPress. Authoring stays in WordPress Admin.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh from WordPress
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setOffset(0);
          }}
          className="min-w-[180px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {formatWordPressCategoryLabel(c.slug)} ({c.post_count})
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-gray-600 dark:text-zinc-400">
        <span>
          {isLoading
            ? 'Loading…'
            : `${total.toLocaleString()} post${total === 1 ? '' : 's'}${
                upstreamTotal != null &&
                !debouncedQuery &&
                !category &&
                upstreamTotal !== total
                  ? ` (ContentHub total ${upstreamTotal.toLocaleString()})`
                  : ''
              }`}
          {updatedLabel ? ` · updated ${updatedLabel}` : ''}
          {isFetching && !isLoading ? ' · refreshing' : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canPrev || isFetching}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium disabled:opacity-40 dark:border-zinc-700"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!canNext || isFetching}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium disabled:opacity-40 dark:border-zinc-700"
          >
            Next
          </button>
        </div>
      </div>

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {(() => {
            const status = (error as { response?: { status?: number } } | null)
              ?.response?.status;
            if (status === 429) {
              return 'Too many requests — wait a few seconds and click Refresh from WordPress.';
            }
            return 'Failed to load WordPress content. Check ContentHub connectivity and try again.';
          })()}
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-600 dark:text-zinc-400">
          No WordPress posts match these filters.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {items.map((post) => (
            <PostRow key={post.post_id} post={post} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PostRow({ post }: { post: WordPressPostItem }) {
  const title = decodeHtmlEntities(post.title || post.slug || `Post ${post.post_id}`);
  const cats = post.categories ?? [];
  const tags = post.tags ?? [];
  const thumbUrl =
    post.featured_media_url?.trim() ||
    (post.youtube_video_id
      ? `https://i.ytimg.com/vi/${post.youtube_video_id}/hqdefault.jpg`
      : null);

  return (
    <li className="flex gap-3 p-4 sm:gap-4 sm:p-5">
      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-20 sm:w-32 dark:bg-zinc-800">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-gray-400 sm:text-xs">
            No image
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
              {post.permalink ? (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:underline"
                >
                  <span className="line-clamp-2">{title}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                </a>
              ) : (
                <span className="line-clamp-2">{title}</span>
              )}
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-500">
              #{post.post_id} · {post.slug} · updated {formatModified(post.modified_gmt)}
            </p>
          </div>
          {post.youtube_video_id ? (
            <a
              href={`https://www.youtube.com/watch?v=${post.youtube_video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
            >
              <Youtube className="h-3.5 w-3.5" aria-hidden />
              {post.youtube_video_id}
            </a>
          ) : null}
        </div>
        {(cats.length > 0 || tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <span
                key={`c-${c}`}
                className="rounded-full bg-steel-50 px-2 py-0.5 text-[11px] font-medium text-steel-800 dark:bg-steel-950/40 dark:text-steel-200"
              >
                {formatWordPressCategoryLabel(c)}
              </span>
            ))}
            {tags.slice(0, 6).map((t) => (
              <span
                key={`t-${t}`}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

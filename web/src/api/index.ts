import { fetchArbeitnow } from './arbeitnow'
import { fetchJSearch, type JSearchPage } from './jsearch'
import { fetchRemotive } from './remotive'
import type { Job, JobSource, SearchQuery } from './types'
import { dedupeJobs, matchesKeywords, matchesLocation } from '../lib/filters'

export interface SearchOptions {
  apiKey: string
  country: string
}

export interface SearchResult {
  jobs: Job[]
  /** Sources that failed, with a message to show the user. */
  errors: Partial<Record<JobSource, string>>
  /** True when asking for the next page could return more jobs. */
  hasMore: boolean
}

// Responses are kept for the browser session so repeating a search does not
// spend API quota (JSearch's free plan and Remotive both have low limits).
const memory = new Map<string, unknown>()

function readCache<T>(key: string): T | undefined {
  const hit = memory.get(key) as T | undefined
  if (hit) return hit
  try {
    const raw = sessionStorage.getItem(`jt-cache:${key}`)
    if (raw) {
      const value = JSON.parse(raw) as T
      memory.set(key, value)
      return value
    }
  } catch {
    // sessionStorage unavailable or corrupt: fall through to a fresh request
  }
  return undefined
}

function writeCache<T>(key: string, value: T): void {
  memory.set(key, value)
  try {
    sessionStorage.setItem(`jt-cache:${key}`, JSON.stringify(value))
  } catch {
    // over quota: the in-memory copy is enough
  }
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = readCache<T>(key)
  if (hit) return hit
  const value = await load()
  writeCache(key, value)
  return value
}

export async function searchJobs(
  query: SearchQuery,
  page: number,
  options: SearchOptions,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const keywords = query.keywords.trim()
  const location = query.location.trim()
  const q = { keywords, location }
  const tasks: Array<{ source: JobSource; run: () => Promise<Job[]> }> = []

  // JSearch needs a key and a non-empty query. It pages with a cursor, which
  // comes from the previous page's (cached) response.
  const jsearchKey = (p: number) => `jsearch|${keywords}|${location}|${options.country}|${p}`
  const cursor = page > 1 ? (readCache<JSearchPage>(jsearchKey(page - 1))?.cursor ?? null) : null
  if (options.apiKey && keywords && (page === 1 || cursor)) {
    tasks.push({
      source: 'jsearch',
      run: async () =>
        (await cached(jsearchKey(page), () => fetchJSearch(q, cursor, options.apiKey, options.country, signal))).jobs,
    })
  }
  // Remotive returns everything in one response, so it only contributes to page 1.
  if (page === 1) {
    tasks.push({
      source: 'remotive',
      run: async () =>
        (await cached<Job[]>(`remotive|${keywords}`, () => fetchRemotive(q, signal))).filter(
          // Remotive's own search is loose, so results are checked against the keywords again.
          (j) => matchesKeywords(j, keywords) && matchesLocation(j, location),
        ),
    })
  }
  tasks.push({
    source: 'arbeitnow',
    run: async () =>
      (await cached<Job[]>(`arbeitnow|${page}`, () => fetchArbeitnow(page, signal))).filter(
        (j) => matchesKeywords(j, keywords) && matchesLocation(j, location),
      ),
  })

  const settled = await Promise.allSettled(tasks.map((t) => t.run()))
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')

  const jobs: Job[] = []
  const errors: SearchResult['errors'] = {}
  let hasMore = false
  settled.forEach((result, i) => {
    const { source } = tasks[i]
    if (result.status === 'fulfilled') {
      jobs.push(...result.value)
      // JSearch has more while it hands back a cursor; Arbeitnow until a page comes back empty.
      if (source === 'jsearch' && readCache<JSearchPage>(jsearchKey(page))?.cursor) hasMore = true
      if (source === 'arbeitnow' && readCache<Job[]>(`arbeitnow|${page}`)?.length) hasMore = true
    } else {
      const reason = result.reason as Error
      errors[source] =
        reason instanceof TypeError
          ? `Could not reach ${source}. Check your internet connection.`
          : reason.message
    }
  })

  return { jobs: dedupeJobs(jobs), errors, hasMore }
}

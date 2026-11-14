import { toJobType, unescapeIfEscaped, type Job } from './types'

export interface ArbeitnowJob {
  slug: string
  company_name: string
  title: string
  description?: string | null
  remote?: boolean | null
  url: string
  tags?: string[] | null
  job_types?: string[] | null
  location?: string | null
  /** Unix seconds */
  created_at?: number | null
}

export function normalizeArbeitnow(raw: ArbeitnowJob): Job | null {
  if (!raw.slug || !raw.title || !raw.url) return null
  return {
    id: `arbeitnow:${raw.slug}`,
    source: 'arbeitnow',
    title: raw.title.trim(),
    company: raw.company_name?.trim() || 'Unknown company',
    location: raw.location?.trim() || (raw.remote ? 'Remote' : 'Location not listed'),
    remote: Boolean(raw.remote),
    type: toJobType((raw.job_types ?? []).join(' ')),
    postedAt: raw.created_at ? new Date(raw.created_at * 1000).toISOString() : undefined,
    applyUrl: raw.url,
    descriptionHtml: unescapeIfEscaped(raw.description ?? ''),
    tags: (raw.tags ?? []).slice(0, 8),
  }
}

/** Arbeitnow has no server-side search; callers filter the page by keyword themselves. */
export async function fetchArbeitnow(page: number, signal?: AbortSignal): Promise<Job[]> {
  const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, { signal })
  if (!res.ok) throw new Error(`Arbeitnow returned an error (${res.status}).`)
  const body = (await res.json()) as { data?: ArbeitnowJob[] }
  return (body.data ?? []).map(normalizeArbeitnow).filter((j): j is Job => j !== null)
}

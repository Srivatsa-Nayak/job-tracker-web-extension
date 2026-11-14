import { toJobType, unescapeIfEscaped, type Job, type SearchQuery } from './types'

export interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name: string
  company_logo?: string | null
  category?: string | null
  tags?: string[] | null
  job_type?: string | null
  publication_date?: string | null
  candidate_required_location?: string | null
  salary?: string | null
  description?: string | null
}

export function normalizeRemotive(raw: RemotiveJob): Job | null {
  if (!raw.id || !raw.title || !raw.url) return null
  // Remotive dates come without a timezone; they are UTC.
  const posted = raw.publication_date
    ? /[zZ]|[+-]\d\d:?\d\d$/.test(raw.publication_date)
      ? raw.publication_date
      : `${raw.publication_date}Z`
    : undefined
  return {
    id: `remotive:${raw.id}`,
    source: 'remotive',
    title: raw.title.trim(),
    company: raw.company_name?.trim() || 'Unknown company',
    logo: raw.company_logo || undefined,
    location: raw.candidate_required_location?.trim() || 'Remote',
    remote: true,
    type: toJobType(raw.job_type),
    salary: raw.salary?.trim() || undefined,
    postedAt: posted,
    applyUrl: raw.url,
    descriptionHtml: unescapeIfEscaped(raw.description ?? ''),
    tags: (raw.tags ?? []).slice(0, 8),
  }
}

export async function fetchRemotive(query: SearchQuery, signal?: AbortSignal): Promise<Job[]> {
  const params = new URLSearchParams({ limit: '60' })
  if (query.keywords) params.set('search', query.keywords)
  const res = await fetch(`https://remotive.com/api/remote-jobs?${params}`, { signal })
  if (!res.ok) throw new Error(`Remotive returned an error (${res.status}).`)
  const body = (await res.json()) as { jobs?: RemotiveJob[] }
  return (body.jobs ?? []).map(normalizeRemotive).filter((j): j is Job => j !== null)
}

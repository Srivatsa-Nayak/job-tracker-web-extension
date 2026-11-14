import { stripHtml, type Filters, type Job } from '../api/types'

const DAY_MS = 24 * 60 * 60 * 1000

const ANYWHERE = /\b(worldwide|anywhere|global|remote)\b/i

/** True when every word of `keywords` appears in the job's title, company, tags or description. */
export function matchesKeywords(job: Job, keywords: string): boolean {
  const words = keywords.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = [job.title, job.company, job.tags.join(' '), stripHtml(job.descriptionHtml)]
    .join(' ')
    .toLowerCase()
  return words.every((w) => haystack.includes(w))
}

/** True when the job is in `location`, or can be done from anywhere. */
export function matchesLocation(job: Job, location: string): boolean {
  const wanted = location.trim().toLowerCase()
  if (!wanted) return true
  const loc = job.location.toLowerCase()
  if (loc.includes(wanted)) return true
  return job.remote && (ANYWHERE.test(job.location) || job.location === '')
}

export function applyFilters(jobs: Job[], filters: Filters, now: number = Date.now()): Job[] {
  const maxAge = filters.postedWithin === 'any' ? null : Number(filters.postedWithin) * DAY_MS
  return jobs.filter((job) => {
    if (filters.remoteOnly && !job.remote) return false
    if (filters.types.length > 0 && !filters.types.includes(job.type)) return false
    if (filters.sources.length > 0 && !filters.sources.includes(job.source)) return false
    if (maxAge !== null) {
      if (!job.postedAt) return false
      const posted = Date.parse(job.postedAt)
      if (Number.isNaN(posted) || now - posted > maxAge) return false
    }
    return true
  })
}

function dedupeKey(job: Job): string {
  return `${job.title}|${job.company}`.toLowerCase().replace(/[^a-z0-9|]/g, '')
}

/** Drops repeat listings (same title and company), keeping the first one seen. */
export function dedupeJobs(jobs: Job[]): Job[] {
  const seen = new Set<string>()
  const ids = new Set<string>()
  const out: Job[] = []
  for (const job of jobs) {
    const key = dedupeKey(job)
    if (seen.has(key) || ids.has(job.id)) continue
    seen.add(key)
    ids.add(job.id)
    out.push(job)
  }
  return out
}

/** Newest first; jobs without a date go last. */
export function sortNewest(jobs: Job[]): Job[] {
  const time = (j: Job) => (j.postedAt ? Date.parse(j.postedAt) || 0 : 0)
  return [...jobs].sort((a, b) => time(b) - time(a))
}

export function timeAgo(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const days = Math.floor((now - t) / DAY_MS)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} wk ago`
  if (days < 365) return `${Math.floor(days / 30)} mo ago`
  return `${Math.floor(days / 365)} yr ago`
}

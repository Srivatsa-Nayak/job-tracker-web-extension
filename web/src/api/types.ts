export type JobSource = 'jsearch' | 'remotive' | 'arbeitnow' | 'manual'

/** Sources that can be searched (`manual` jobs are typed in by the user). */
export const SEARCH_SOURCES: JobSource[] = ['jsearch', 'remotive', 'arbeitnow']

export type JobType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'other'

export interface Job {
  /** `${source}:${id at the source}` */
  id: string
  source: JobSource
  title: string
  company: string
  logo?: string
  location: string
  remote: boolean
  type: JobType
  salary?: string
  /** ISO date string */
  postedAt?: string
  applyUrl: string
  descriptionHtml: string
  tags: string[]
  /** Site the listing was originally posted on, when the source reports it (e.g. "LinkedIn"). */
  publisher?: string
}

export interface SearchQuery {
  keywords: string
  location: string
}

export type PostedWithin = 'any' | '1' | '3' | '7' | '30'

export interface Filters {
  remoteOnly: boolean
  types: JobType[]
  postedWithin: PostedWithin
  sources: JobSource[]
}

export const SOURCE_LABEL: Record<JobSource, string> = {
  jsearch: 'JSearch',
  remotive: 'Remotive',
  arbeitnow: 'Arbeitnow',
  manual: 'Added by you',
}

export const TYPE_LABEL: Record<JobType, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  other: 'Other',
}

export function toJobType(raw: string | null | undefined): JobType {
  const s = (raw ?? '').toLowerCase()
  if (!s) return 'other'
  if (s.includes('intern') || s.includes('praktik')) return 'internship'
  if (s.includes('part') || s.includes('teilzeit')) return 'part-time'
  if (s.includes('contract') || s.includes('freelance') || s.includes('temporary')) return 'contract'
  if (s.includes('full') || s.includes('vollzeit') || s.includes('permanent')) return 'full-time'
  return 'other'
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Some listings arrive with their HTML entity-escaped (`&lt;p&gt;...`), which
 * would show as raw tags. Unescape those; leave real HTML untouched.
 */
export function unescapeIfEscaped(html: string): string {
  const escaped = (html.match(/&lt;\/?[a-z]/gi) ?? []).length
  const real = (html.match(/<\/?[a-z][^>]*>/gi) ?? []).length
  // Mostly-escaped listings often still carry a few real tags (a footer link, say).
  if (escaped === 0 || escaped <= real) return html
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

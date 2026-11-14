import { escapeHtml, toJobType, type Job, type SearchQuery } from './types'

const HOST = 'jsearch.p.rapidapi.com'

/** One job in a JSearch response (only the fields this app reads). */
export interface JSearchJob {
  job_id: string
  job_title?: string | null
  employer_name?: string | null
  employer_logo?: string | null
  job_publisher?: string | null
  job_employment_type?: string | null
  job_employment_types?: string[] | null
  job_apply_link?: string | null
  apply_options?: Array<{ apply_link?: string | null; is_direct?: boolean | null; publisher?: string | null }> | null
  job_description?: string | null
  job_is_remote?: boolean | null
  job_posted_at_datetime_utc?: string | null
  job_location?: string | null
  job_city?: string | null
  job_state?: string | null
  job_country?: string | null
  job_salary_string?: string | null
  job_min_salary?: number | null
  job_max_salary?: number | null
  job_salary_period?: string | null
  job_salary_currency?: string | null
}

export interface JSearchPage {
  jobs: Job[]
  /** Passed back to get the next page; null when there are no more results. */
  cursor: string | null
}

function formatSalary(raw: JSearchJob): string | undefined {
  if (raw.job_salary_string) return raw.job_salary_string
  const { job_min_salary: min, job_max_salary: max } = raw
  if (!min && !max) return undefined
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat('en', {
        style: raw.job_salary_currency ? 'currency' : 'decimal',
        currency: raw.job_salary_currency ?? undefined,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(n)
    } catch {
      return String(n)
    }
  }
  const range = min && max && min !== max ? `${fmt(min)} to ${fmt(max)}` : fmt((max || min) as number)
  const period = raw.job_salary_period ? ` per ${raw.job_salary_period.toLowerCase()}` : ''
  return range + period
}

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function normalizeJSearch(raw: JSearchJob): Job | null {
  // A link straight to the employer's own form is preferred over a job-board
  // page: it is where the autofill can actually help.
  const direct = raw.apply_options?.find((o) => o.is_direct && o.apply_link)
  const applyUrl = direct?.apply_link || raw.job_apply_link
  if (!raw.job_id || !raw.job_title || !applyUrl) return null

  const location =
    raw.job_location ||
    [raw.job_city, raw.job_state, raw.job_country].filter(Boolean).join(', ') ||
    (raw.job_is_remote ? 'Remote' : 'Location not listed')
  return {
    id: `jsearch:${raw.job_id}`,
    source: 'jsearch',
    title: raw.job_title,
    company: raw.employer_name || 'Unknown company',
    logo: raw.employer_logo || undefined,
    location,
    remote: Boolean(raw.job_is_remote),
    type: toJobType(raw.job_employment_types?.[0] ?? raw.job_employment_type),
    salary: formatSalary(raw),
    postedAt: raw.job_posted_at_datetime_utc || undefined,
    applyUrl,
    descriptionHtml: textToHtml(raw.job_description ?? ''),
    tags: [],
    publisher: direct?.publisher || raw.job_publisher || undefined,
  }
}

/** Fetches one page of results. Pass the previous page's `cursor` to get the next one. */
export async function fetchJSearch(
  query: SearchQuery,
  cursor: string | null,
  apiKey: string,
  country: string,
  signal?: AbortSignal,
): Promise<JSearchPage> {
  const q = query.location ? `${query.keywords} in ${query.location}` : query.keywords
  const params = new URLSearchParams({ query: q, num_pages: '1', date_posted: 'all' })
  if (country) params.set('country', country.toLowerCase())
  if (cursor) params.set('cursor', cursor)

  const res = await fetch(`https://${HOST}/search-v2?${params}`, {
    headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': HOST },
    signal,
  })
  if (res.status === 401 || res.status === 403) {
    const detail = await res
      .json()
      .then((b: { message?: string }) => b.message ?? '')
      .catch(() => '')
    if (/not subscribed/i.test(detail)) {
      throw new Error(
        'Your RapidAPI key is valid, but the account is not subscribed to JSearch. Subscribe to its free Basic plan on rapidapi.com, then search again.',
      )
    }
    throw new Error('JSearch rejected the RapidAPI key. Check that the key is copied in full.')
  }
  if (res.status === 429) {
    throw new Error('JSearch request limit reached for this RapidAPI plan. Try again later.')
  }
  if (!res.ok) throw new Error(`JSearch returned an error (${res.status}).`)

  const body = (await res.json()) as { data?: { jobs?: JSearchJob[]; cursor?: string | null } }
  return {
    jobs: (body.data?.jobs ?? []).map(normalizeJSearch).filter((j): j is Job => j !== null),
    cursor: body.data?.cursor || null,
  }
}

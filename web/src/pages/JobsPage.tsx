import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MapPin, Search, Wifi } from 'lucide-react'
import {
  SEARCH_SOURCES,
  SOURCE_LABEL,
  TYPE_LABEL,
  type Filters,
  type JobSource,
  type JobType,
  type PostedWithin,
} from '../api/types'
import { Modal, Notice, Spinner, useMediaQuery } from '../components/bits'
import { JobDetail } from '../components/JobDetail'
import { JobRow } from '../components/JobRow'
import { applyFilters } from '../lib/filters'
import { navigate } from '../lib/router'
import { useJobs } from '../store/jobs'
import { DEFAULT_FILTERS, effectiveApiKey, useSettings } from '../store/settings'

const TYPES: JobType[] = ['full-time', 'part-time', 'contract', 'internship']

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const active =
    filters.remoteOnly || filters.types.length > 0 || filters.sources.length > 0 || filters.postedWithin !== 'any'
  return (
    <div className="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 py-1 md:-mx-6 md:px-6">
      <button
        type="button"
        className="chip"
        aria-pressed={filters.remoteOnly}
        onClick={() => onChange({ ...filters, remoteOnly: !filters.remoteOnly })}
      >
        <Wifi size={14} /> Remote only
      </button>

      <span className="bg-line mx-1 h-5 w-px shrink-0" aria-hidden="true" />

      {TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className="chip"
          aria-pressed={filters.types.includes(type)}
          onClick={() => onChange({ ...filters, types: toggle(filters.types, type) })}
        >
          {TYPE_LABEL[type]}
        </button>
      ))}

      <span className="bg-line mx-1 h-5 w-px shrink-0" aria-hidden="true" />

      <select
        aria-label="Date posted"
        className="chip pr-2"
        value={filters.postedWithin}
        onChange={(e) => onChange({ ...filters, postedWithin: e.target.value as PostedWithin })}
      >
        <option value="any">Posted any time</option>
        <option value="1">Last 24 hours</option>
        <option value="3">Last 3 days</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
      </select>

      <span className="bg-line mx-1 h-5 w-px shrink-0" aria-hidden="true" />

      {SEARCH_SOURCES.map((source: JobSource) => (
        <button
          key={source}
          type="button"
          className="chip"
          aria-pressed={filters.sources.includes(source)}
          onClick={() => onChange({ ...filters, sources: toggle(filters.sources, source) })}
        >
          {SOURCE_LABEL[source]}
        </button>
      ))}

      {active && (
        <button type="button" className="btn btn-quiet btn-sm shrink-0" onClick={() => onChange(DEFAULT_FILTERS)}>
          Clear filters
        </button>
      )}
    </div>
  )
}

export default function JobsPage() {
  const { jobs, query, status, errors, hasMore, selectedId, search, loadMore, select } = useJobs()
  const filters = useSettings((s) => s.filters)
  const lastQuery = useSettings((s) => s.lastQuery)
  const hasKey = useSettings((s) => effectiveApiKey(s.rapidApiKey) !== '')
  const setSettings = useSettings((s) => s.set)
  const isWide = useMediaQuery('(min-width: 1024px)')

  const [keywords, setKeywords] = useState(lastQuery.keywords)
  const [location, setLocation] = useState(lastQuery.location)

  // First visit in this session: show the latest jobs for the last search.
  useEffect(() => {
    if (useJobs.getState().status === 'idle') void search(useSettings.getState().lastQuery)
  }, [search])

  const visible = useMemo(() => applyFilters(jobs, filters), [jobs, filters])
  const selected = visible.find((j) => j.id === selectedId) ?? (isWide ? visible[0] : undefined)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void search({ keywords: keywords.trim(), location: location.trim() })
  }

  const loading = status === 'loading' || status === 'idle'
  const errorList = Object.values(errors)

  return (
    <div className="flex h-full flex-col">
      <header className="border-line bg-surface border-b px-4 pt-4 pb-2 md:px-6">
        <form onSubmit={onSubmit} className="flex flex-wrap gap-2 sm:flex-nowrap">
          <label className="relative min-w-0 flex-[2] basis-full sm:basis-0">
            <span className="sr-only">Job title, skill or company</span>
            <Search size={17} className="text-ink-soft pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              className="field pl-9"
              placeholder="Job title, skill or company"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </label>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">City or country</span>
            <MapPin size={17} className="text-ink-soft pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              className="field pl-9"
              placeholder="City or country"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={status === 'loading'}>
            Search
          </button>
        </form>
        <FilterBar filters={filters} onChange={(f) => setSettings({ filters: f })} />
      </header>

      <div className="flex min-h-0 flex-1">
        <section
          aria-label="Search results"
          className="border-line w-full overflow-y-auto lg:w-[27rem] lg:shrink-0 lg:border-r"
        >
          <div className="space-y-2 px-4 pt-3 pb-2">
            <p className="text-ink-soft text-sm" aria-live="polite">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size={14} /> Searching
                </span>
              ) : (
                <>
                  <span className="text-ink font-semibold">
                    {visible.length} {visible.length === 1 ? 'job' : 'jobs'}
                  </span>
                  {visible.length !== jobs.length && ` of ${jobs.length} match your filters`}
                </>
              )}
            </p>
            {!hasKey && (
              <Notice>
                Showing Remotive and Arbeitnow only.{' '}
                <button
                  type="button"
                  className="text-action font-semibold underline"
                  onClick={() => navigate('settings')}
                >
                  Add a RapidAPI key
                </button>{' '}
                to include LinkedIn, Indeed and Glassdoor listings.
              </Notice>
            )}
            {hasKey && !loading && !query.keywords && (
              <Notice>Type a job title or skill to include LinkedIn, Indeed and Glassdoor listings.</Notice>
            )}
            {errorList.map((message) => (
              <Notice key={message} tone="error">
                {message}
              </Notice>
            ))}
          </div>

          {!loading && visible.length === 0 && (
            <div className="px-4 py-10 text-center">
              <h2 className="text-lg">No jobs match</h2>
              <p className="text-ink-soft mx-auto mt-1 max-w-xs text-sm">
                {jobs.length > 0
                  ? 'Your filters hide every result. Loosen them to see more.'
                  : 'Try fewer or different words, or leave the location empty.'}
              </p>
              {jobs.length > 0 && (
                <button type="button" className="btn mt-4" onClick={() => setSettings({ filters: DEFAULT_FILTERS })}>
                  Clear filters
                </button>
              )}
            </div>
          )}

          {!loading && (
            <ul className="border-line border-t">
              {visible.map((job) => (
                <JobRow key={job.id} job={job} selected={selected?.id === job.id} onSelect={() => select(job.id)} />
              ))}
            </ul>
          )}

          {!loading && hasMore && (
            <div className="p-4">
              <button
                type="button"
                className="btn w-full"
                onClick={() => void loadMore()}
                disabled={status === 'loadingMore'}
              >
                {status === 'loadingMore' ? (
                  <>
                    <Spinner size={14} /> Loading
                  </>
                ) : (
                  'Load more jobs'
                )}
              </button>
            </div>
          )}
        </section>

        {isWide && (
          <section aria-label="Job details" className="bg-surface min-w-0 flex-1 overflow-y-auto">
            {selected ? (
              <JobDetail key={selected.id} job={selected} />
            ) : (
              !loading && (
                <p className="text-ink-soft px-8 py-16 text-center">Pick a job on the left to read it here.</p>
              )
            )}
          </section>
        )}
      </div>

      {!isWide && selected && (
        <Modal title={selected.company} onClose={() => select(null)} wide>
          <JobDetail key={selected.id} job={selected} />
        </Modal>
      )}
    </div>
  )
}

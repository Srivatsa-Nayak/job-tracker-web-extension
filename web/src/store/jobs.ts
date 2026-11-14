import { create } from 'zustand'
import { searchJobs } from '../api'
import type { Job, JobSource, SearchQuery } from '../api/types'
import { dedupeJobs, sortNewest } from '../lib/filters'
import { effectiveApiKey, useSettings } from './settings'

interface JobsState {
  query: SearchQuery
  status: 'idle' | 'loading' | 'loadingMore' | 'done'
  jobs: Job[]
  errors: Partial<Record<JobSource, string>>
  page: number
  hasMore: boolean
  selectedId: string | null
  search: (query: SearchQuery) => Promise<void>
  loadMore: () => Promise<void>
  select: (id: string | null) => void
}

let controller: AbortController | null = null

function options() {
  const { rapidApiKey, country } = useSettings.getState()
  return { apiKey: effectiveApiKey(rapidApiKey), country }
}

export const useJobs = create<JobsState>((set, get) => ({
  query: { keywords: '', location: '' },
  status: 'idle',
  jobs: [],
  errors: {},
  page: 1,
  hasMore: false,
  selectedId: null,

  search: async (query) => {
    controller?.abort()
    controller = new AbortController()
    const { signal } = controller
    set({ query, status: 'loading', errors: {}, page: 1 })
    useSettings.getState().set({ lastQuery: query })
    try {
      const result = await searchJobs(query, 1, options(), signal)
      const jobs = sortNewest(result.jobs)
      set({ jobs, errors: result.errors, hasMore: result.hasMore, status: 'done', selectedId: null })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      set({ status: 'done', jobs: [], errors: { remotive: (err as Error).message } })
    }
  },

  loadMore: async () => {
    const { status, hasMore, page, query, jobs } = get()
    if (status !== 'done' || !hasMore) return
    controller = new AbortController()
    const { signal } = controller
    set({ status: 'loadingMore' })
    try {
      const result = await searchJobs(query, page + 1, options(), signal)
      const merged = dedupeJobs([...jobs, ...sortNewest(result.jobs)])
      set({
        jobs: merged,
        errors: result.errors,
        // Stop offering more once a page adds nothing new.
        hasMore: result.hasMore && merged.length > jobs.length,
        page: page + 1,
        status: 'done',
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      set({ status: 'done' })
    }
  },

  select: (id) => set({ selectedId: id }),
}))

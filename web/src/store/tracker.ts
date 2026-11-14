import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Job } from '../api/types'

export type Status = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected'

export const STATUSES: Status[] = ['saved', 'applied', 'interviewing', 'offer', 'rejected']

export const STATUS_LABEL: Record<Status, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
}

export interface TrackedJob {
  job: Job
  status: Status
  addedAt: string
  appliedAt?: string
  updatedAt: string
  notes: string
}

interface TrackerState {
  entries: Record<string, TrackedJob>
  save: (job: Job) => void
  /** Sets the job to Applied (adding it if needed). Returns the entry as it was before, for undo. */
  markApplied: (job: Job) => TrackedJob | undefined
  setStatus: (id: string, status: Status) => void
  setNotes: (id: string, notes: string) => void
  remove: (id: string) => void
  /** Puts an entry back exactly as given, or removes it when `entry` is undefined. */
  restore: (id: string, entry: TrackedJob | undefined) => void
  replaceAll: (entries: Record<string, TrackedJob>) => void
}

const now = () => new Date().toISOString()

export const useTracker = create<TrackerState>()(
  persist(
    (set, get) => ({
      entries: {},
      save: (job) =>
        set((s) => {
          if (s.entries[job.id]) return s
          const t = now()
          return {
            entries: { ...s.entries, [job.id]: { job, status: 'saved', addedAt: t, updatedAt: t, notes: '' } },
          }
        }),
      markApplied: (job) => {
        const before = get().entries[job.id]
        const t = now()
        set((s) => ({
          entries: {
            ...s.entries,
            [job.id]: {
              job: before?.job ?? job,
              notes: before?.notes ?? '',
              addedAt: before?.addedAt ?? t,
              status: 'applied',
              appliedAt: t,
              updatedAt: t,
            },
          },
        }))
        return before
      },
      setStatus: (id, status) =>
        set((s) => {
          const entry = s.entries[id]
          if (!entry || entry.status === status) return s
          const t = now()
          return {
            entries: {
              ...s.entries,
              [id]: {
                ...entry,
                status,
                updatedAt: t,
                // First move out of Saved counts as the application date.
                appliedAt: status === 'saved' ? undefined : (entry.appliedAt ?? t),
              },
            },
          }
        }),
      setNotes: (id, notes) =>
        set((s) => {
          const entry = s.entries[id]
          if (!entry) return s
          return { entries: { ...s.entries, [id]: { ...entry, notes } } }
        }),
      remove: (id) =>
        set((s) => {
          const next = { ...s.entries }
          delete next[id]
          return { entries: next }
        }),
      restore: (id, entry) =>
        set((s) => {
          const next = { ...s.entries }
          if (entry) next[id] = entry
          else delete next[id]
          return { entries: next }
        }),
      replaceAll: (entries) => set({ entries }),
    }),
    { name: 'jt-tracker' },
  ),
)

export function makeManualJob(input: { title: string; company: string; url: string; location: string }): Job {
  return {
    id: `manual:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    source: 'manual',
    title: input.title.trim(),
    company: input.company.trim() || 'Unknown company',
    location: input.location.trim() || 'Location not listed',
    remote: /remote/i.test(input.location),
    type: 'other',
    applyUrl: input.url.trim(),
    descriptionHtml: '',
    tags: [],
  }
}

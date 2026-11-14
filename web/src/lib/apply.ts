import type { Job } from '../api/types'
import { toast } from '../store/toasts'
import { useTracker } from '../store/tracker'

/**
 * Opens the application page in a new tab and records the job as applied.
 * Form filling happens on that page, in the extension.
 */
export function applyToJob(job: Job): void {
  window.open(job.applyUrl, '_blank', 'noopener,noreferrer')

  const tracker = useTracker.getState()
  const existing = tracker.entries[job.id]
  // Already applied or further along: reopening the page should not reset progress.
  if (existing && existing.status !== 'saved') return

  const before = tracker.markApplied(job)
  toast('Application page opened. Marked as applied.', {
    action: { label: 'Undo', run: () => useTracker.getState().restore(job.id, before) },
  })
}

export function toggleSaved(job: Job): void {
  const tracker = useTracker.getState()
  const existing = tracker.entries[job.id]
  if (!existing) {
    tracker.save(job)
    toast('Saved to your tracker.')
  } else if (existing.status === 'saved') {
    tracker.remove(job.id)
    toast('Removed from your tracker.', {
      action: { label: 'Undo', run: () => useTracker.getState().restore(job.id, existing) },
    })
  }
}

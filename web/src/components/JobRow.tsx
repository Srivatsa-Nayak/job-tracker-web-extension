import { Bookmark, BookmarkCheck, MapPin } from 'lucide-react'
import { TYPE_LABEL, type Job } from '../api/types'
import { toggleSaved } from '../lib/apply'
import { timeAgo } from '../lib/filters'
import { STATUS_LABEL, useTracker } from '../store/tracker'
import { CompanyLogo, Stamp } from './bits'

export function JobRow({ job, selected, onSelect }: { job: Job; selected: boolean; onSelect: () => void }) {
  const entry = useTracker((s) => s.entries[job.id])
  const status = entry?.status
  const canToggleSave = !status || status === 'saved'

  return (
    <li
      className={`border-line relative flex items-start gap-1 border-b border-l-[3px] ${
        selected ? 'border-l-action bg-raised' : 'hover:bg-surface border-l-transparent'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-start gap-3 py-3.5 pr-1 pl-4 text-left focus-visible:outline-offset-[-2px]"
      >
        <CompanyLogo name={job.company} src={job.logo} />
        <span className="min-w-0 flex-1">
          <span className="font-display block text-[1.02rem] leading-snug font-semibold [overflow-wrap:anywhere]">{job.title}</span>
          <span className="text-ink-soft block truncate text-sm">{job.company}</span>
          <span className="text-ink-soft mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.82rem]">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin size={13} className="shrink-0" />
              <span className="max-w-[14rem] truncate">{job.location}</span>
            </span>
            {job.type !== 'other' && <span>{TYPE_LABEL[job.type]}</span>}
            {job.salary && <span className="text-ink font-semibold">{job.salary}</span>}
            {job.postedAt && <span>{timeAgo(job.postedAt)}</span>}
          </span>
          {status === 'applied' && (
            <span className="mt-2 block">
              <Stamp appliedAt={entry?.appliedAt} />
            </span>
          )}
          {status && status !== 'applied' && status !== 'saved' && (
            <span className="text-ink mt-2 block text-[0.82rem] font-semibold">{STATUS_LABEL[status]}</span>
          )}
        </span>
      </button>
      {canToggleSave && (
        <button
          type="button"
          onClick={() => toggleSaved(job)}
          aria-pressed={status === 'saved'}
          aria-label={status === 'saved' ? `Remove ${job.title} from saved` : `Save ${job.title}`}
          className={`btn btn-quiet btn-icon btn-sm mt-3 mr-2 shrink-0 ${status === 'saved' ? 'text-action' : 'text-ink-soft'}`}
        >
          {status === 'saved' ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
      )}
    </li>
  )
}

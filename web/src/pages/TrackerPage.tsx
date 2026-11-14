import { useMemo, useState, type FormEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ExternalLink, Plus, StickyNote, Trash } from 'lucide-react'
import { CompanyLogo, Modal, formatShortDate } from '../components/bits'
import { applyToJob } from '../lib/apply'
import { navigate } from '../lib/router'
import { toast } from '../store/toasts'
import { STATUSES, STATUS_LABEL, makeManualJob, useTracker, type Status, type TrackedJob } from '../store/tracker'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const COLUMN_ACCENT: Record<Status, string> = {
  saved: 'var(--ink-soft)',
  applied: 'var(--marigold)',
  interviewing: 'var(--action)',
  offer: 'var(--good)',
  rejected: 'var(--bad)',
}

function CardBody({ entry }: { entry: TrackedJob }) {
  const { job } = entry
  const date = entry.status === 'saved' ? entry.addedAt : (entry.appliedAt ?? entry.updatedAt)
  return (
    <>
      <div className="flex items-start gap-2.5">
        <CompanyLogo name={job.company} src={job.logo} size={32} />
        <div className="min-w-0 flex-1">
          <p className="font-display leading-snug font-semibold [overflow-wrap:anywhere]">{job.title}</p>
          <p className="text-ink-soft truncate text-sm">{job.company}</p>
        </div>
      </div>
      <p className="text-ink-soft mt-2.5 flex items-center justify-between gap-2 text-[0.8rem]">
        <span>
          {entry.status === 'saved' ? 'Saved' : 'Applied'} {formatShortDate(date)}
        </span>
        {entry.notes.trim() && (
          <span className="inline-flex items-center gap-1" title="Has notes">
            <StickyNote size={13} /> Notes
          </span>
        )}
      </p>
    </>
  )
}

function Card({ entry, onOpen }: { entry: TrackedJob; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.job.id })
  return (
    <li>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={onOpen}
        onKeyDown={(e) => {
          listeners?.onKeyDown?.(e)
          if (e.key === 'Enter' && !e.defaultPrevented) onOpen()
        }}
        aria-label={`${entry.job.title} at ${entry.job.company}, ${STATUS_LABEL[entry.status]}. Press Enter for details, Space to move.`}
        className={`border-line bg-raised block w-full cursor-grab touch-manipulation rounded-xl border p-3 text-left select-none ${
          isDragging ? 'opacity-30' : 'hover:border-ink-soft'
        }`}
      >
        <CardBody entry={entry} />
      </div>
    </li>
  )
}

function Column({
  status,
  entries,
  onOpen,
}: {
  status: Status
  entries: TrackedJob[]
  onOpen: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      aria-label={STATUS_LABEL[status]}
      className={`flex w-[17rem] shrink-0 flex-col rounded-2xl border p-2.5 transition-colors xl:w-auto xl:min-w-0 xl:flex-1 ${
        isOver ? 'border-action bg-action-tint' : 'border-line bg-surface'
      }`}
    >
      <h2 className="flex items-center gap-2 px-1.5 pt-1 pb-3 text-[0.98rem]">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLUMN_ACCENT[status] }} aria-hidden="true" />
        {STATUS_LABEL[status]}
        <span className="text-ink-soft font-sans text-sm font-medium">{entries.length}</span>
      </h2>
      <ul className="flex min-h-24 flex-1 flex-col gap-2">
        {entries.map((entry) => (
          <Card key={entry.job.id} entry={entry} onOpen={() => onOpen(entry.job.id)} />
        ))}
        {entries.length === 0 && (
          <li className="text-ink-soft border-line rounded-xl border border-dashed px-3 py-5 text-center text-sm">
            Drop a job here
          </li>
        )}
      </ul>
    </section>
  )
}

function EntryDialog({ entry, onClose }: { entry: TrackedJob; onClose: () => void }) {
  const { setStatus, setNotes, remove, restore } = useTracker()
  const { job } = entry
  return (
    <Modal title={job.title} onClose={onClose}>
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <CompanyLogo name={job.company} src={job.logo} />
          <div className="min-w-0">
            <p className="font-semibold">{job.company}</p>
            <p className="text-ink-soft text-sm">{job.location}</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="entry-status">
            Stage
          </label>
          <select
            id="entry-status"
            className="field"
            value={entry.status}
            onChange={(e) => setStatus(job.id, e.target.value as Status)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {entry.appliedAt && <p className="hint mt-1">Applied {formatShortDate(entry.appliedAt)}</p>}
        </div>

        <div>
          <label className="label" htmlFor="entry-notes">
            Notes
          </label>
          <textarea
            id="entry-notes"
            className="field"
            rows={5}
            placeholder="Recruiter name, interview dates, salary discussed"
            value={entry.notes}
            onChange={(e) => setNotes(job.id, e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              remove(job.id)
              onClose()
              toast('Removed from your tracker.', {
                action: { label: 'Undo', run: () => restore(job.id, entry) },
              })
            }}
          >
            <Trash size={16} /> Remove
          </button>
          {job.applyUrl && (
            <button type="button" className="btn btn-primary" onClick={() => applyToJob(job)}>
              <ExternalLink size={16} /> {entry.status === 'saved' ? 'Apply' : 'Open application page'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function AddJobDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ title: '', company: '', url: '', location: '' })
  const [status, setStatus] = useState<Status>('applied')
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const job = makeManualJob(form)
    const tracker = useTracker.getState()
    tracker.save(job)
    if (status !== 'saved') tracker.setStatus(job.id, status)
    toast(`Added to ${STATUS_LABEL[status]}.`)
    onClose()
  }

  return (
    <Modal title="Add a job" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4 p-5">
        <div>
          <label className="label" htmlFor="add-title">
            Job title
          </label>
          <input id="add-title" className="field" required autoFocus value={form.title} onChange={set('title')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="add-company">
              Company
            </label>
            <input id="add-company" className="field" required value={form.company} onChange={set('company')} />
          </div>
          <div>
            <label className="label" htmlFor="add-location">
              Location
            </label>
            <input id="add-location" className="field" value={form.location} onChange={set('location')} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="add-url">
            Link to the posting
          </label>
          <input
            id="add-url"
            className="field"
            type="url"
            placeholder="https://"
            value={form.url}
            onChange={set('url')}
          />
        </div>
        <div>
          <label className="label" htmlFor="add-status">
            Stage
          </label>
          <select id="add-status" className="field" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Add job
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function TrackerPage() {
  const entries = useTracker((s) => s.entries)
  const setStatus = useTracker((s) => s.setStatus)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const columns = useMemo(() => {
    const by: Record<Status, TrackedJob[]> = { saved: [], applied: [], interviewing: [], offer: [], rejected: [] }
    for (const entry of Object.values(entries)) by[entry.status]?.push(entry)
    for (const list of Object.values(by)) list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return by
  }, [entries])

  const all = Object.values(entries)
  const [now] = useState(() => Date.now())
  const appliedThisWeek = all.filter((e) => e.appliedAt && now - Date.parse(e.appliedAt) < WEEK_MS).length

  function onDragEnd(event: DragEndEvent) {
    setDragId(null)
    const target = event.over?.id as Status | undefined
    if (target && STATUSES.includes(target)) setStatus(String(event.active.id), target)
  }

  const openEntry = openId ? entries[openId] : undefined
  const dragEntry = dragId ? entries[dragId] : undefined

  return (
    <div className="flex h-full flex-col px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Tracker</h1>
          <p className="text-ink-soft mt-1.5">
            {all.length === 0
              ? 'Every job you save or apply to lands here.'
              : `${all.length} tracked, ${appliedThisWeek} applied in the last 7 days, ${columns.interviewing.length} interviewing, ${columns.offer.length} ${columns.offer.length === 1 ? 'offer' : 'offers'}.`}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add a job
        </button>
      </header>

      {all.length === 0 ? (
        <div className="panel mt-8 px-6 py-14 text-center">
          <h2 className="text-xl">Nothing tracked yet</h2>
          <p className="text-ink-soft mx-auto mt-2 max-w-sm">
            Apply to a job from the search and it is stamped and filed here. Jobs you applied to elsewhere can be added
            by hand.
          </p>
          <button type="button" className="btn btn-primary mt-5" onClick={() => navigate('jobs')}>
            Find jobs
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={(e) => setDragId(String(e.active.id))}
          onDragCancel={() => setDragId(null)}
          onDragEnd={onDragEnd}
        >
          <div className="-mx-4 mt-6 flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
            {STATUSES.map((status) => (
              <Column key={status} status={status} entries={columns[status]} onOpen={setOpenId} />
            ))}
          </div>
          <DragOverlay>
            {dragEntry && (
              <div className="border-action bg-raised shadow-lift w-[16rem] rotate-2 cursor-grabbing rounded-xl border p-3">
                <CardBody entry={dragEntry} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenId(null)} />}
      {adding && <AddJobDialog onClose={() => setAdding(false)} />}
    </div>
  )
}

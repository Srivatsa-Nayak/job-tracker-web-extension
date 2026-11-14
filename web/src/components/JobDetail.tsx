import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { Bookmark, BookmarkCheck, Clock, ExternalLink, MapPin, Send, Banknote, Briefcase } from 'lucide-react'
import { SOURCE_LABEL, TYPE_LABEL, type Job } from '../api/types'
import { applyToJob, toggleSaved } from '../lib/apply'
import { fillsAutomatically, hostOf, isLinkedIn } from '../lib/ats'
import { useExtension } from '../lib/extensionBridge'
import { timeAgo } from '../lib/filters'
import { navigate } from '../lib/router'
import { STATUS_LABEL, useTracker } from '../store/tracker'
import { CompanyLogo, Stamp } from './bits'

// Links inside third-party job descriptions always open in a new tab.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof HTMLAnchorElement) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'video', 'audio'],
    FORBID_ATTR: ['style', 'class', 'id'],
  })
}

function AutofillHint({ url }: { url: string }) {
  const connected = useExtension((s) => s.connected)
  if (isLinkedIn(url)) {
    return <>This one is on LinkedIn, where autofill stays off. You fill in this application yourself.</>
  }
  if (!connected) {
    return (
      <>
        Autofill is off.{' '}
        <button type="button" className="text-action font-semibold underline" onClick={() => navigate('settings')}>
          Set up the extension
        </button>{' '}
        to have forms filled in for you.
      </>
    )
  }
  if (fillsAutomatically(url)) {
    return <>The form on {hostOf(url)} fills in by itself. Check it, then submit.</>
  }
  return (
    <>
      On the application page, press <kbd className="border-line rounded border px-1 font-semibold">Alt</kbd>{' '}
      <kbd className="border-line rounded border px-1 font-semibold">Shift</kbd>{' '}
      <kbd className="border-line rounded border px-1 font-semibold">F</kbd> to fill the form.
    </>
  )
}

export function JobDetail({ job }: { job: Job }) {
  const entry = useTracker((s) => s.entries[job.id])
  const status = entry?.status
  const html = useMemo(() => sanitize(job.descriptionHtml), [job.descriptionHtml])
  const pastApplying = status !== undefined && status !== 'saved'

  return (
    <article className="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-8">
      <header>
        <div className="flex items-start gap-4">
          <CompanyLogo name={job.company} src={job.logo} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.7rem] text-balance md:text-[2rem]">{job.title}</h1>
            <p className="text-ink-soft mt-1 text-base">{job.company}</p>
          </div>
        </div>

        <ul className="text-ink-soft mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <li className="inline-flex items-center gap-1.5">
            <MapPin size={15} /> {job.location}
            {job.remote && !/remote/i.test(job.location) && ' (remote)'}
          </li>
          {job.type !== 'other' && (
            <li className="inline-flex items-center gap-1.5">
              <Briefcase size={15} /> {TYPE_LABEL[job.type]}
            </li>
          )}
          {job.salary && (
            <li className="text-ink inline-flex items-center gap-1.5 font-semibold">
              <Banknote size={15} /> {job.salary}
            </li>
          )}
          {job.postedAt && (
            <li className="inline-flex items-center gap-1.5">
              <Clock size={15} /> Posted {timeAgo(job.postedAt).toLowerCase()}
            </li>
          )}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary px-6" onClick={() => applyToJob(job)}>
            {pastApplying ? (
              <>
                <ExternalLink size={16} /> Open application page
              </>
            ) : (
              <>
                <Send size={16} /> Apply
              </>
            )}
          </button>
          {!pastApplying && (
            <button type="button" className="btn" aria-pressed={status === 'saved'} onClick={() => toggleSaved(job)}>
              {status === 'saved' ? (
                <>
                  <BookmarkCheck size={16} className="text-action" /> Saved
                </>
              ) : (
                <>
                  <Bookmark size={16} /> Save
                </>
              )}
            </button>
          )}
          {status === 'applied' && <Stamp key={entry?.appliedAt} appliedAt={entry?.appliedAt} />}
          {pastApplying && status !== 'applied' && (
            <span className="text-sm font-semibold">{STATUS_LABEL[status]}</span>
          )}
        </div>

        <p className="text-ink-soft mt-3 text-sm">
          <AutofillHint url={job.applyUrl} />
        </p>
      </header>

      <hr className="border-line my-7" />

      {html ? (
        <div className="job-copy" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-ink-soft">No description was provided for this job. Open the application page to read it.</p>
      )}

      {job.tags.length > 0 && (
        <ul className="mt-7 flex flex-wrap gap-2">
          {job.tags.map((tag) => (
            <li key={tag} className="border-line text-ink-soft rounded-md border px-2 py-0.5 text-[0.82rem]">
              {tag}
            </li>
          ))}
        </ul>
      )}

      <p className="text-ink-soft mt-7 text-[0.82rem]">
        {job.publisher ? `Posted on ${job.publisher}, found through ` : 'Found through '}
        {SOURCE_LABEL[job.source]}. Applications go to {hostOf(job.applyUrl) || 'the employer’s site'}.
      </p>
    </article>
  )
}

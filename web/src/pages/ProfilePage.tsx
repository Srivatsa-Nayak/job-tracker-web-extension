import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { FileText, Trash, Upload } from 'lucide-react'
import { Notice } from '../components/bits'
import { useExtension } from '../lib/extensionBridge'
import { navigate } from '../lib/router'
import { profileCompleteness, useProfile, type Profile } from '../store/profile'
import { useResume } from '../store/resume'
import { toast } from '../store/toasts'

type TextKey = Exclude<keyof Profile, 'requiresSponsorship'>

function Section({ title, blurb, children }: { title: string; blurb?: string; children: ReactNode }) {
  return (
    <section className="border-line grid gap-x-10 gap-y-4 border-t py-7 lg:grid-cols-[15rem_1fr]">
      <div>
        <h2 className="text-lg">{title}</h2>
        {blurb && <p className="hint mt-1">{blurb}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function TextField({
  field,
  label,
  type = 'text',
  autoComplete,
  placeholder,
  wide = false,
}: {
  field: TextKey
  label: string
  type?: string
  autoComplete?: string
  placeholder?: string
  wide?: boolean
}) {
  const value = useProfile((s) => s.profile[field])
  const update = useProfile((s) => s.update)
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="label" htmlFor={`pf-${field}`}>
        {label}
      </label>
      <input
        id={`pf-${field}`}
        className="field"
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => update({ [field]: e.target.value })}
      />
    </div>
  )
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function ResumeField() {
  const { resume, setFile, clear } = useResume()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  async function take(file: File | undefined) {
    if (!file) return
    try {
      await setFile(file)
      toast('Resume saved.')
    } catch (err) {
      toast((err as Error).message, { tone: 'error' })
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    void take(e.dataTransfer.files[0])
  }

  return (
    <div className="sm:col-span-2">
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept=".pdf,.doc,.docx,.rtf,.txt"
        aria-label="Resume file"
        onChange={(e) => {
          void take(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {resume ? (
        <div className="border-line bg-raised flex flex-wrap items-center gap-3 rounded-xl border p-3">
          <span className="bg-action-tint text-action grid h-10 w-10 shrink-0 place-items-center rounded-lg">
            <FileText size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{resume.name}</p>
            <p className="hint">
              {formatSize(resume.size)}, added {new Date(resume.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => input.current?.click()}>
            Replace
          </button>
          <button
            type="button"
            className="btn btn-sm btn-icon btn-danger"
            aria-label="Remove resume"
            onClick={() => void clear().then(() => toast('Resume removed.'))}
          >
            <Trash size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            over ? 'border-action bg-action-tint' : 'border-line hover:border-ink-soft'
          }`}
        >
          <Upload size={22} className="text-ink-soft" />
          <span className="font-semibold">Choose your resume, or drop it here</span>
          <span className="hint">PDF or Word, up to 5 MB</span>
        </button>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const profile = useProfile((s) => s.profile)
  const update = useProfile((s) => s.update)
  const { connected, lastSyncedAt } = useExtension()
  const { filled, total } = profileCompleteness(profile)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-3xl">Profile</h1>
        <p className="text-ink-soft mt-1.5 max-w-[60ch]">
          These answers are typed into application forms for you. They are saved as you type and stay in this browser.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <span className="bg-line relative h-1.5 w-28 overflow-hidden rounded-full" aria-hidden="true">
              <span
                className="bg-action absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(filled / total) * 100}%` }}
              />
            </span>
            {filled} of {total} common fields filled
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-good' : 'bg-ink-soft'}`}
              aria-hidden="true"
            />
            {connected
              ? lastSyncedAt
                ? 'Sent to the autofill extension'
                : 'Autofill extension connected'
              : 'Autofill extension not connected'}
          </span>
        </div>
      </header>

      {!connected && (
        <div className="mt-5">
          <Notice>
            Without the extension, nothing here can be typed into forms.{' '}
            <button type="button" className="text-action font-semibold underline" onClick={() => navigate('settings')}>
              Set up the extension
            </button>
          </Notice>
        </div>
      )}

      <div className="mt-7">
        <Section title="Resume" blurb="Attached to the resume upload on each application.">
          <ResumeField />
        </Section>

        <Section title="About you">
          <TextField field="firstName" label="First name" autoComplete="given-name" />
          <TextField field="lastName" label="Last name" autoComplete="family-name" />
          <TextField field="email" label="Email" type="email" autoComplete="email" />
          <TextField field="phone" label="Phone" type="tel" autoComplete="tel" placeholder="With country code" />
          <TextField field="city" label="City" autoComplete="address-level2" />
          <TextField field="country" label="Country" autoComplete="country-name" />
        </Section>

        <Section title="Links">
          <TextField field="linkedin" label="LinkedIn profile" type="url" placeholder="https://linkedin.com/in/" wide />
          <TextField field="github" label="GitHub" type="url" placeholder="https://github.com/" />
          <TextField field="portfolio" label="Website or portfolio" type="url" placeholder="https://" />
        </Section>

        <Section title="Work" blurb="Common screening questions.">
          <TextField field="currentTitle" label="Current job title" autoComplete="organization-title" />
          <TextField field="currentCompany" label="Current company" autoComplete="organization" />
          <TextField field="yearsExperience" label="Years of experience" placeholder="5" />
          <TextField field="noticePeriod" label="Notice period" placeholder="30 days" />
          <TextField
            field="workAuthorization"
            label="Work authorisation"
            placeholder="Citizen, permanent resident, H-1B"
          />
          <div>
            <label className="label" htmlFor="pf-sponsorship">
              Need visa sponsorship?
            </label>
            <select
              id="pf-sponsorship"
              className="field"
              value={profile.requiresSponsorship}
              onChange={(e) => update({ requiresSponsorship: e.target.value as Profile['requiresSponsorship'] })}
            >
              <option value="">Leave unanswered</option>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <TextField field="expectedSalary" label="Expected salary" placeholder="Amount and currency" wide />
        </Section>

        <Section title="Cover letter" blurb="Pasted into cover letter boxes. Keep it general enough to reuse.">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pf-cover">
              Cover letter
            </label>
            <textarea
              id="pf-cover"
              className="field"
              rows={9}
              value={profile.coverLetter}
              onChange={(e) => update({ coverLetter: e.target.value })}
            />
          </div>
        </Section>
      </div>
    </div>
  )
}

import { useRef, useState, type ReactNode } from 'react'
import { Download, Eye, EyeOff, Monitor, Moon, RotateCcw, Sun, Trash, Upload } from 'lucide-react'
import { INSIDE_EXTENSION, useExtension } from '../lib/extensionBridge'
import { EMPTY_PROFILE, useProfile, type Profile } from '../store/profile'
import { useResume, type StoredResume } from '../store/resume'
import { ENV_API_KEY, useSettings, type ThemeSetting } from '../store/settings'
import { toast } from '../store/toasts'
import { useTracker, type TrackedJob } from '../store/tracker'

function Section({ title, blurb, children }: { title: string; blurb?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-line grid gap-x-10 gap-y-4 border-t py-7 lg:grid-cols-[15rem_1fr]">
      <div>
        <h2 className="text-lg">{title}</h2>
        {blurb && <p className="hint mt-1">{blurb}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  )
}

const COUNTRIES: Array<[string, string]> = [
  ['us', 'United States'],
  ['in', 'India'],
  ['gb', 'United Kingdom'],
  ['ca', 'Canada'],
  ['au', 'Australia'],
  ['de', 'Germany'],
  ['fr', 'France'],
  ['nl', 'Netherlands'],
  ['ie', 'Ireland'],
  ['sg', 'Singapore'],
  ['ae', 'United Arab Emirates'],
  ['es', 'Spain'],
  ['it', 'Italy'],
  ['br', 'Brazil'],
  ['mx', 'Mexico'],
  ['jp', 'Japan'],
]

const THEMES: Array<{ value: ThemeSetting; label: string; icon: ReactNode }> = [
  { value: 'system', label: 'Match device', icon: <Monitor size={15} /> },
  { value: 'light', label: 'Light', icon: <Sun size={15} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={15} /> },
]

interface Backup {
  app: 'job-tracker'
  version: 1
  exportedAt: string
  profile: Profile
  tracker: Record<string, TrackedJob>
  resume: StoredResume | null
}

function JobSources() {
  const { rapidApiKey, country, set } = useSettings()
  const [show, setShow] = useState(false)
  const knownCountry = COUNTRIES.some(([code]) => code === country)
  return (
    <Section
      title="Job listings"
      blurb="Remotive and Arbeitnow work with no setup. A free JSearch key adds listings from LinkedIn, Indeed and Glassdoor."
    >
      <div>
        <label className="label" htmlFor="set-key">
          RapidAPI key for JSearch
        </label>
        <div className="flex gap-2">
          <input
            id="set-key"
            className="field"
            type={show ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder={ENV_API_KEY ? 'Using the key from web/.env.local' : 'Paste your key'}
            value={rapidApiKey}
            onChange={(e) => set({ rapidApiKey: e.target.value.trim() })}
          />
          <button
            type="button"
            className="btn btn-icon shrink-0"
            aria-label={show ? 'Hide key' : 'Show key'}
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <p className="hint mt-1.5">
          {ENV_API_KEY && !rapidApiKey
            ? 'A key is already set in web/.env.local, so this can stay empty. A key typed here is used instead. '
            : 'Kept in this browser only and sent to nobody except RapidAPI. '}
          The free plan allows a limited number of searches per month.
        </p>
      </div>

      <ol className="text-ink-soft list-decimal space-y-1 pl-5 text-sm">
        <li>
          Create a free account at{' '}
          <a
            className="text-action font-semibold underline"
            href="https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch"
            target="_blank"
            rel="noreferrer"
          >
            rapidapi.com and open JSearch
          </a>
          .
        </li>
        <li>Subscribe to the free Basic plan.</li>
        <li>Copy the value shown as X-RapidAPI-Key and paste it above.</li>
      </ol>

      <div className="max-w-xs">
        <label className="label" htmlFor="set-country">
          Country to search in
        </label>
        <select id="set-country" className="field" value={country} onChange={(e) => set({ country: e.target.value })}>
          {!knownCountry && <option value={country}>{country.toUpperCase()}</option>}
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <p className="hint mt-1.5">Used for JSearch results only.</p>
      </div>
    </Section>
  )
}

function ExtensionSetup() {
  const { connected, version, lastSyncedAt, check, sync } = useExtension()
  const [busy, setBusy] = useState(false)

  async function recheck() {
    setBusy(true)
    const found = await check()
    if (found) {
      await sync(useProfile.getState().profile, useResume.getState().resume)
      toast('Extension connected. Profile and resume sent.')
    } else {
      toast('Extension not found on this page. Reload after installing it.', { tone: 'error' })
    }
    setBusy(false)
  }

  const sampleForm = `${import.meta.env.BASE_URL}test-form.html`

  return (
    <Section
      title="Autofill"
      blurb="Your profile is typed into application forms and your resume attached. You always press Submit yourself."
    >
      <div className="border-line bg-raised flex flex-wrap items-center gap-3 rounded-xl border p-3">
        <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-good' : 'bg-ink-soft'}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {connected ? `Autofill is on${version ? ` (version ${version})` : ''}` : 'Extension not found'}
          </p>
          <p className="hint">
            {connected
              ? lastSyncedAt
                ? `Profile and resume last updated for autofill at ${new Date(lastSyncedAt).toLocaleTimeString()}.`
                : 'Profile changes reach autofill automatically.'
              : 'This page is running outside the extension. Install the extension with the steps below, then check again.'}
          </p>
        </div>
        {!INSIDE_EXTENSION && (
          <button type="button" className="btn btn-sm" onClick={() => void recheck()} disabled={busy}>
            <RotateCcw size={14} /> {connected ? 'Send profile now' : 'Check again'}
          </button>
        )}
      </div>

      {!connected && (
        <ol className="text-ink-soft list-decimal space-y-1 pl-5 text-sm">
          <li>
            In Chrome, open <code className="text-ink font-semibold">chrome://extensions</code> and turn on Developer
            mode.
          </li>
          <li>
            Choose Load unpacked and pick the <code className="text-ink font-semibold">extension</code> folder of this
            project.
          </li>
          <li>Reload this page, then choose Check again.</li>
        </ol>
      )}

      <p className="hint max-w-[62ch]">
        Forms on Greenhouse, Lever, Ashby, Workday, SmartRecruiters and Workable fill in by themselves. On any other
        site, press Alt Shift F or click the extension’s icon and choose Fill this page. It never runs on LinkedIn.
      </p>
      <p>
        <a className="text-action text-sm font-semibold underline" href={sampleForm} target="_blank" rel="noreferrer">
          Try it on a sample form
        </a>
      </p>
    </Section>
  )
}

function Appearance() {
  const { theme, set } = useSettings()
  return (
    <Section title="Appearance">
      <div role="group" aria-label="Theme" className="flex flex-wrap gap-2">
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            className="chip"
            aria-pressed={theme === t.value}
            onClick={() => set({ theme: t.value })}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
    </Section>
  )
}

function YourData() {
  const input = useRef<HTMLInputElement>(null)
  const count = useTracker((s) => Object.keys(s.entries).length)

  function exportData() {
    const backup: Backup = {
      app: 'job-tracker',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: useProfile.getState().profile,
      tracker: useTracker.getState().entries,
      resume: useResume.getState().resume,
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `job-tracker-backup-${backup.exportedAt.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('Backup downloaded.')
  }

  async function importData(file: File | undefined) {
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as Partial<Backup>
      if (data.app !== 'job-tracker' || typeof data.tracker !== 'object' || data.tracker === null) {
        throw new Error('not a backup')
      }
      const jobs = Object.keys(data.tracker).length
      if (!window.confirm(`Replace your profile, resume and tracker with this backup (${jobs} tracked jobs)?`)) return
      useProfile.getState().replace({ ...EMPTY_PROFILE, ...(data.profile ?? {}) })
      useTracker.getState().replaceAll(data.tracker)
      await useResume.getState().replace(data.resume ?? null)
      toast('Backup restored.')
    } catch {
      toast('That file is not a Job Tracker backup.', { tone: 'error' })
    }
  }

  async function deleteAll() {
    if (!window.confirm(`Delete your profile, resume and all ${count} tracked jobs from this browser? This cannot be undone.`)) {
      return
    }
    useProfile.getState().replace(EMPTY_PROFILE)
    useTracker.getState().replaceAll({})
    await useResume.getState().clear()
    toast('Everything deleted from this browser.')
  }

  return (
    <Section
      title="Your data"
      blurb="Everything lives in this browser. Download a backup before clearing browser data or switching computers."
    >
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Backup file"
        onChange={(e) => {
          void importData(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={exportData}>
          <Download size={16} /> Download backup
        </button>
        <button type="button" className="btn" onClick={() => input.current?.click()}>
          <Upload size={16} /> Restore from backup
        </button>
        <button type="button" className="btn btn-danger" onClick={() => void deleteAll()}>
          <Trash size={16} /> Delete everything
        </button>
      </div>
      <p className="hint">The backup holds your profile, resume and tracked jobs. Your RapidAPI key is not included.</p>
    </Section>
  )
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-3xl">Settings</h1>
      <div className="mt-7">
        <JobSources />
        <ExtensionSetup />
        <Appearance />
        <YourData />
      </div>
    </div>
  )
}

import { useEffect, type ReactNode } from 'react'
import { Briefcase, Settings, SquareKanban, UserRound } from 'lucide-react'
import { Toasts } from './components/bits'
import { useExtension } from './lib/extensionBridge'
import { navigate, useRoute, type Route } from './lib/router'
import JobsPage from './pages/JobsPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import TrackerPage from './pages/TrackerPage'
import { useProfile } from './store/profile'
import { useResume } from './store/resume'
import { useSettings } from './store/settings'
import { useTracker } from './store/tracker'

const NAV: Array<{ route: Route; label: string; icon: ReactNode }> = [
  { route: 'jobs', label: 'Jobs', icon: <Briefcase size={19} /> },
  { route: 'tracker', label: 'Tracker', icon: <SquareKanban size={19} /> },
  { route: 'profile', label: 'Profile', icon: <UserRound size={19} /> },
  { route: 'settings', label: 'Settings', icon: <Settings size={19} /> },
]

/** Applies the chosen theme to <html>, following the device when set to "system". */
function useTheme() {
  const theme = useSettings((s) => s.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

/** Finds the extension and keeps it supplied with the latest profile and resume. */
function useExtensionSync() {
  const profile = useProfile((s) => s.profile)
  const resume = useResume((s) => s.resume)
  const resumeLoaded = useResume((s) => s.loaded)
  const connected = useExtension((s) => s.connected)

  useEffect(() => {
    void useResume.getState().load()
    const check = () => void useExtension.getState().check()
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])

  useEffect(() => {
    if (!connected || !resumeLoaded) return
    const timer = setTimeout(() => void useExtension.getState().sync(profile, resume), 800)
    return () => clearTimeout(timer)
  }, [connected, resumeLoaded, profile, resume])
}

function Mark() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#2540D9" />
      <path
        d="M9 16.5l4.5 4.5L23 11.5"
        fill="none"
        stroke="#F2B01E"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function App() {
  useTheme()
  useExtensionSync()
  const route = useRoute()
  const tracked = useTracker((s) => Object.keys(s.entries).length)
  const connected = useExtension((s) => s.connected)

  return (
    <div className="flex h-dvh">
      <aside className="bg-rail text-on-rail hidden w-56 shrink-0 flex-col p-3 md:flex">
        <a href="#/jobs" className="flex items-center gap-2.5 px-2 py-3">
          <Mark />
          <span className="font-display text-[1.15rem] font-bold tracking-tight">Job Tracker</span>
        </a>
        <nav aria-label="Main" className="mt-4 flex flex-col gap-1">
          {NAV.map((item) => (
            <a
              key={item.route}
              href={`#/${item.route}`}
              aria-current={route === item.route ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-semibold transition-colors ${
                route === item.route
                  ? 'bg-rail-active text-white'
                  : 'text-on-rail-soft hover:bg-rail-active/60 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.route === 'tracker' && tracked > 0 && (
                <span className="bg-marigold text-on-marigold rounded-md px-1.5 text-xs leading-5 font-bold">
                  {tracked}
                </span>
              )}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => navigate('settings')}
          className="hover:bg-rail-active mt-auto flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-[#5fc79b]' : 'bg-on-rail-soft'}`}
            aria-hidden="true"
          />
          <span>
            <span className="block font-semibold">{connected ? 'Autofill is on' : 'Autofill is off'}</span>
            <span className="text-on-rail-soft block text-xs">
              {connected ? 'Forms are filled as you apply' : 'Set up the extension'}
            </span>
          </span>
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto pb-16 md:pb-0">
        {route === 'jobs' && <JobsPage />}
        {route === 'tracker' && <TrackerPage />}
        {route === 'profile' && <ProfilePage />}
        {route === 'settings' && <SettingsPage />}
      </main>

      <nav
        aria-label="Main"
        className="bg-rail text-on-rail-soft fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 md:hidden"
      >
        {NAV.map((item) => (
          <a
            key={item.route}
            href={`#/${item.route}`}
            aria-current={route === item.route ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
              route === item.route ? 'text-white' : ''
            }`}
          >
            {item.icon}
            {item.label}
          </a>
        ))}
      </nav>
      <Toasts />
    </div>
  )
}

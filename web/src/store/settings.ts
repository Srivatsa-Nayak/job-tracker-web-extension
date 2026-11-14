import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Filters, SearchQuery } from '../api/types'

export type ThemeSetting = 'system' | 'light' | 'dark'

export const DEFAULT_FILTERS: Filters = {
  remoteOnly: false,
  types: [],
  postedWithin: 'any',
  sources: [],
}

function guessCountry(): string {
  try {
    const region = new Intl.Locale(navigator.language).region
    if (region) return region.toLowerCase()
  } catch {
    // fall through
  }
  return 'us'
}

/** Key from web/.env.local, used when no key has been typed in Settings. */
export const ENV_API_KEY: string = (import.meta.env.VITE_RAPIDAPI_KEY ?? '').trim()

/** The RapidAPI key in effect: the one typed in Settings, else the one from .env.local. */
export function effectiveApiKey(typed: string): string {
  return typed.trim() || ENV_API_KEY
}

interface SettingsState {
  rapidApiKey: string
  /** Two-letter country code sent to JSearch. */
  country: string
  theme: ThemeSetting
  lastQuery: SearchQuery
  filters: Filters
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      rapidApiKey: '',
      country: guessCountry(),
      theme: 'system',
      lastQuery: { keywords: '', location: '' },
      filters: DEFAULT_FILTERS,
      set: (patch) => set(patch),
    }),
    { name: 'jt-settings' },
  ),
)

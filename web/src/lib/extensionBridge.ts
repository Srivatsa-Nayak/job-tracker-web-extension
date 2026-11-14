import { create } from 'zustand'
import type { Profile } from '../store/profile'
import type { StoredResume } from '../store/resume'

/**
 * Hands the profile and resume to the autofill scripts.
 *
 * Normally this app runs as a page inside the extension, where it writes
 * straight to the extension's storage. During development it runs on
 * localhost instead; there the extension injects extension/content/bridge.js
 * into the page and the two sides exchange window messages.
 */
const CHANNEL = 'job-tracker'

interface ExtensionApi {
  runtime?: { id?: string; getManifest?: () => { version: string } }
  storage?: { local: { set: (items: Record<string, unknown>) => Promise<void> } }
}

const api = (globalThis as { chrome?: ExtensionApi }).chrome

/** True when this page is part of the extension itself rather than a website. */
export const INSIDE_EXTENSION =
  window.location.protocol === 'chrome-extension:' && Boolean(api?.runtime?.id && api.storage)

interface ExtensionReply {
  channel: typeof CHANNEL
  from: 'extension'
  type: 'PONG' | 'SYNCED'
  version?: string
}

function request(type: 'PING' | 'SYNC', payload: unknown, expect: ExtensionReply['type'], timeoutMs: number) {
  return new Promise<ExtensionReply | null>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return
      const data = event.data as ExtensionReply | undefined
      if (data?.channel !== CHANNEL || data.from !== 'extension' || data.type !== expect) return
      done(data)
    }
    const timer = setTimeout(() => done(null), timeoutMs)
    function done(reply: ExtensionReply | null) {
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      resolve(reply)
    }
    window.addEventListener('message', onMessage)
    window.postMessage({ channel: CHANNEL, from: 'app', type, payload }, window.location.origin)
  })
}

interface ExtensionState {
  connected: boolean
  version: string | null
  lastSyncedAt: string | null
  /** Looks for the extension. Safe to call often. */
  check: () => Promise<boolean>
  /** Sends the profile and resume to the autofill scripts. Returns false when that is not possible. */
  sync: (profile: Profile, resume: StoredResume | null) => Promise<boolean>
}

export const useExtension = create<ExtensionState>((set) => ({
  connected: INSIDE_EXTENSION,
  version: INSIDE_EXTENSION ? (api?.runtime?.getManifest?.().version ?? null) : null,
  lastSyncedAt: null,
  check: async () => {
    if (INSIDE_EXTENSION) return true
    const reply = await request('PING', null, 'PONG', 700)
    set({ connected: reply !== null, version: reply?.version ?? null })
    return reply !== null
  },
  sync: async (profile, resume) => {
    if (INSIDE_EXTENSION) {
      try {
        await api!.storage!.local.set({
          profile,
          resume: resume
            ? { name: resume.name, type: resume.type, size: resume.size, dataUrl: resume.dataUrl }
            : null,
          syncedAt: new Date().toISOString(),
        })
        set({ lastSyncedAt: new Date().toISOString() })
        return true
      } catch {
        return false
      }
    }
    const reply = await request('SYNC', { profile, resume }, 'SYNCED', 3000)
    if (reply) set({ connected: true, lastSyncedAt: new Date().toISOString() })
    else set({ connected: false })
    return reply !== null
  },
}))

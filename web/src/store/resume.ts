import { create } from 'zustand'
import { del, get, set as idbSet } from 'idb-keyval'

export interface StoredResume {
  name: string
  type: string
  size: number
  /** The file as a base64 data URL, which is how it is handed to the extension. */
  dataUrl: string
  updatedAt: string
}

export const MAX_RESUME_BYTES = 5 * 1024 * 1024
const KEY = 'jt-resume'

interface ResumeState {
  resume: StoredResume | null
  loaded: boolean
  load: () => Promise<void>
  setFile: (file: File) => Promise<void>
  replace: (resume: StoredResume | null) => Promise<void>
  clear: () => Promise<void>
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}

export const useResume = create<ResumeState>((set) => ({
  resume: null,
  loaded: false,
  load: async () => {
    try {
      set({ resume: (await get<StoredResume>(KEY)) ?? null, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  setFile: async (file) => {
    if (file.size > MAX_RESUME_BYTES) throw new Error('That file is over 5 MB. Choose a smaller resume.')
    const resume: StoredResume = {
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl: await readAsDataUrl(file),
      updatedAt: new Date().toISOString(),
    }
    await idbSet(KEY, resume)
    set({ resume })
  },
  replace: async (resume) => {
    if (resume) await idbSet(KEY, resume)
    else await del(KEY)
    set({ resume })
  },
  clear: async () => {
    await del(KEY)
    set({ resume: null })
  },
}))

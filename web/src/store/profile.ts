import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Everything the extension can type into an application form. Keys match extension/content/fieldMap.js. */
export interface Profile {
  firstName: string
  lastName: string
  email: string
  phone: string
  city: string
  country: string
  linkedin: string
  github: string
  portfolio: string
  currentTitle: string
  currentCompany: string
  yearsExperience: string
  workAuthorization: string
  requiresSponsorship: '' | 'yes' | 'no'
  noticePeriod: string
  expectedSalary: string
  coverLetter: string
}

export const EMPTY_PROFILE: Profile = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  linkedin: '',
  github: '',
  portfolio: '',
  currentTitle: '',
  currentCompany: '',
  yearsExperience: '',
  workAuthorization: '',
  requiresSponsorship: '',
  noticePeriod: '',
  expectedSalary: '',
  coverLetter: '',
}

interface ProfileState {
  profile: Profile
  update: (patch: Partial<Profile>) => void
  replace: (profile: Profile) => void
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      profile: EMPTY_PROFILE,
      update: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      replace: (profile) => set({ profile: { ...EMPTY_PROFILE, ...profile } }),
    }),
    { name: 'jt-profile' },
  ),
)

/** How many of the fields that most forms ask for are filled in. */
export function profileCompleteness(p: Profile): { filled: number; total: number } {
  const core: Array<keyof Profile> = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'city',
    'country',
    'linkedin',
    'currentTitle',
    'yearsExperience',
    'workAuthorization',
  ]
  return { filled: core.filter((k) => p[k].trim() !== '').length, total: core.length }
}

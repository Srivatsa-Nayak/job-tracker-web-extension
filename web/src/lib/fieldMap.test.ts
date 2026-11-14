// Tests the extension's field-matching rules (extension/content/fieldMap.js).
// The file is a plain content script that publishes itself on globalThis.
import { describe, expect, it } from 'vitest'
import '../../../extension/content/fieldMap.js'

interface FieldMap {
  humanize: (text: string) => string
  matchField: (field: { autocomplete?: string; type?: string; text: string }) => string | null
  valueFor: (key: string, profile: Record<string, string>, text: string) => string
}

const { humanize, matchField, valueFor } = (globalThis as unknown as { __jtFieldMap: FieldMap }).__jtFieldMap

const match = (label: string, extra: { autocomplete?: string; type?: string } = {}) =>
  matchField({ text: humanize(label), ...extra })

describe('humanize', () => {
  it('splits camelCase, snake_case and bracketed names into words', () => {
    expect(humanize('firstName')).toBe('first name')
    expect(humanize('applicant[last_name]')).toBe('applicant last name')
    expect(humanize('job-application.phoneNumber')).toBe('job application phone number')
  })
})

describe('matchField', () => {
  it.each([
    ['First Name *', 'firstName'],
    ['first_name', 'firstName'],
    ['Preferred name', 'firstName'],
    ['Last name', 'lastName'],
    ['Surname', 'lastName'],
    ['Full name', 'fullName'],
    ['Name', 'fullName'],
    ['Email address', 'email'],
    ['applicantPhoneNumber', 'phone'],
    ['Mobile number', 'phone'],
    ['LinkedIn Profile URL', 'linkedin'],
    ['GitHub URL', 'github'],
    ['Website', 'portfolio'],
    ['Portfolio link', 'portfolio'],
    ['Location (City)', 'city'],
    ['Current location', 'city'],
    ['Country', 'country'],
    ['Current company', 'currentCompany'],
    ['Company name', 'currentCompany'],
    ['Current job title', 'currentTitle'],
    ['How many years of relevant experience do you have?', 'yearsExperience'],
    ['Years of experience', 'yearsExperience'],
    ['Notice period', 'noticePeriod'],
    ['Salary expectations', 'expectedSalary'],
    ['Will you now or in the future require visa sponsorship?', 'requiresSponsorship'],
    ['Are you legally authorized to work in the United States?', 'workAuthorization'],
    ['Cover letter', 'coverLetter'],
  ])('"%s" -> %s', (label, key) => {
    expect(match(label)).toBe(key)
  })

  it.each([
    'How did you hear about this job?',
    'Name of the person who referred you',
    'Middle name',
    'Emergency contact name',
    'School name',
    'Gender',
    'Date of birth',
    'Password',
    'Phone country code',
    'Current salary',
    'Are you willing to relocate?',
    'Username',
  ])('leaves "%s" alone', (label) => {
    expect(match(label)).toBeNull()
  })

  it('trusts the autocomplete attribute over vague wording', () => {
    expect(match('Field 7', { autocomplete: 'given-name' })).toBe('firstName')
    expect(match('q_12', { autocomplete: 'section-a email' })).toBe('email')
  })

  it('uses the input type only when the wording says nothing', () => {
    expect(match('q_3', { type: 'tel' })).toBe('phone')
    expect(match('LinkedIn', { type: 'url' })).toBe('linkedin')
  })
})

describe('valueFor', () => {
  const profile = {
    firstName: 'Asha',
    lastName: 'Rao',
    city: 'Pune',
    country: 'India',
    requiresSponsorship: 'no',
    email: ' asha@example.com ',
  }

  it('joins first and last name for a full-name box', () => {
    expect(valueFor('fullName', profile, 'full name')).toBe('Asha Rao')
  })
  it('gives city alone for a city box and "City, Country" for a location box', () => {
    expect(valueFor('city', profile, 'location city')).toBe('Pune')
    expect(valueFor('city', profile, 'current location')).toBe('Pune, India')
  })
  it('turns the sponsorship answer into Yes or No, and nothing when unanswered', () => {
    expect(valueFor('requiresSponsorship', profile, '')).toBe('No')
    expect(valueFor('requiresSponsorship', { ...profile, requiresSponsorship: '' }, '')).toBe('')
  })
  it('trims values and returns an empty string for missing ones', () => {
    expect(valueFor('email', profile, '')).toBe('asha@example.com')
    expect(valueFor('phone', profile, '')).toBe('')
  })
})

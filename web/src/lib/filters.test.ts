import { describe, expect, it } from 'vitest'
import type { Filters, Job } from '../api/types'
import { applyFilters, dedupeJobs, matchesKeywords, matchesLocation, sortNewest, timeAgo } from './filters'

const NOW = Date.parse('2026-11-14T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

function job(patch: Partial<Job>): Job {
  return {
    id: 'remotive:1',
    source: 'remotive',
    title: 'React Developer',
    company: 'Acme',
    location: 'Worldwide',
    remote: true,
    type: 'full-time',
    applyUrl: 'https://example.com/apply',
    descriptionHtml: '<p>We use <b>TypeScript</b> daily.</p>',
    tags: ['frontend'],
    ...patch,
  }
}

const NO_FILTERS: Filters = { remoteOnly: false, types: [], postedWithin: 'any', sources: [] }

describe('matchesKeywords', () => {
  it('needs every word, searching title, company, tags and description text', () => {
    expect(matchesKeywords(job({}), 'react typescript')).toBe(true)
    expect(matchesKeywords(job({}), 'ACME frontend')).toBe(true)
    expect(matchesKeywords(job({}), 'react python')).toBe(false)
  })
  it('matches everything for an empty query', () => {
    expect(matchesKeywords(job({}), '  ')).toBe(true)
  })
  it('does not match words that only appear inside HTML tags', () => {
    expect(matchesKeywords(job({ descriptionHtml: '<p class="banana">Hi</p>' }), 'banana')).toBe(false)
  })
})

describe('matchesLocation', () => {
  it('matches part of the location, ignoring case', () => {
    expect(matchesLocation(job({ location: 'Berlin, Germany', remote: false }), 'berlin')).toBe(true)
    expect(matchesLocation(job({ location: 'Berlin, Germany', remote: false }), 'Pune')).toBe(false)
  })
  it('keeps work-from-anywhere jobs for any location', () => {
    expect(matchesLocation(job({ location: 'Worldwide', remote: true }), 'Pune')).toBe(true)
  })
  it('drops remote jobs limited to another region', () => {
    expect(matchesLocation(job({ location: 'USA only', remote: true }), 'Pune')).toBe(false)
  })
})

describe('applyFilters', () => {
  const jobs = [
    job({ id: 'a', remote: true, type: 'full-time', source: 'remotive', postedAt: new Date(NOW - 2 * DAY).toISOString() }),
    job({ id: 'b', remote: false, type: 'contract', source: 'arbeitnow', postedAt: new Date(NOW - 10 * DAY).toISOString() }),
    job({ id: 'c', remote: false, type: 'internship', source: 'jsearch', postedAt: undefined }),
  ]
  const ids = (f: Partial<Filters>) => applyFilters(jobs, { ...NO_FILTERS, ...f }, NOW).map((j) => j.id)

  it('returns everything with no filters', () => expect(ids({})).toEqual(['a', 'b', 'c']))
  it('filters to remote jobs', () => expect(ids({ remoteOnly: true })).toEqual(['a']))
  it('filters by any of the chosen job types', () => expect(ids({ types: ['contract', 'internship'] })).toEqual(['b', 'c']))
  it('filters by source', () => expect(ids({ sources: ['jsearch'] })).toEqual(['c']))
  it('filters by age and hides undated jobs when an age is set', () => {
    expect(ids({ postedWithin: '3' })).toEqual(['a'])
    expect(ids({ postedWithin: '30' })).toEqual(['a', 'b'])
  })
  it('combines filters', () => expect(ids({ remoteOnly: true, types: ['contract'] })).toEqual([]))
})

describe('dedupeJobs', () => {
  it('keeps the first of listings with the same title and company', () => {
    const out = dedupeJobs([
      job({ id: 'jsearch:1', title: 'React Developer', company: 'Acme' }),
      job({ id: 'remotive:9', title: 'React  developer ', company: 'ACME' }),
      job({ id: 'remotive:10', title: 'React Developer', company: 'Globex' }),
    ])
    expect(out.map((j) => j.id)).toEqual(['jsearch:1', 'remotive:10'])
  })
})

describe('sortNewest', () => {
  it('puts newest first and undated last', () => {
    const out = sortNewest([
      job({ id: 'old', postedAt: '2026-01-01T00:00:00Z' }),
      job({ id: 'none', postedAt: undefined }),
      job({ id: 'new', postedAt: '2026-11-01T00:00:00Z' }),
    ])
    expect(out.map((j) => j.id)).toEqual(['new', 'old', 'none'])
  })
})

describe('timeAgo', () => {
  it.each([
    [0, 'Today'],
    [1, 'Yesterday'],
    [3, '3 days ago'],
    [14, '2 wk ago'],
    [65, '2 mo ago'],
  ])('%i days -> %s', (days, expected) => {
    expect(timeAgo(new Date(NOW - days * DAY - 1000).toISOString(), NOW)).toBe(expected)
  })
  it('is empty for missing or bad dates', () => {
    expect(timeAgo(undefined, NOW)).toBe('')
    expect(timeAgo('not a date', NOW)).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import { normalizeArbeitnow } from './arbeitnow'
import { normalizeJSearch } from './jsearch'
import { normalizeRemotive } from './remotive'
import { toJobType, unescapeIfEscaped } from './types'

describe('normalizeJSearch', () => {
  it('maps a full listing', () => {
    const job = normalizeJSearch({
      job_id: 'abc==',
      job_title: 'Frontend Engineer',
      employer_name: 'Acme',
      employer_logo: 'https://img/acme.png',
      job_publisher: 'LinkedIn',
      job_employment_type: 'FULLTIME',
      job_apply_link: 'https://www.linkedin.com/jobs/view/1',
      job_description: 'Build things.\n\nShip <fast> & often.',
      job_is_remote: true,
      job_posted_at_datetime_utc: '2026-11-10T00:00:00.000Z',
      job_city: 'Pune',
      job_state: 'MH',
      job_country: 'IN',
      job_min_salary: 100000,
      job_max_salary: 150000,
      job_salary_period: 'YEAR',
    })
    expect(job).toMatchObject({
      id: 'jsearch:abc==',
      source: 'jsearch',
      title: 'Frontend Engineer',
      company: 'Acme',
      publisher: 'LinkedIn',
      type: 'full-time',
      remote: true,
      location: 'Pune, MH, IN',
      applyUrl: 'https://www.linkedin.com/jobs/view/1',
    })
    expect(job?.salary).toBe('100K to 150K per year')
    // Plain-text descriptions become escaped paragraphs.
    expect(job?.descriptionHtml).toBe('<p>Build things.</p><p>Ship &lt;fast&gt; &amp; often.</p>')
  })

  it('reads the newer fields: type list, ready-made salary text', () => {
    const job = normalizeJSearch({
      job_id: '2',
      job_title: 'SDE I',
      job_apply_link: 'https://in.linkedin.com/jobs/view/2',
      job_employment_type: 'Full–time',
      job_employment_types: ['CONTRACTOR'],
      job_salary_string: '₹12L–₹18L a year',
      job_min_salary: 1,
    })
    expect(job).toMatchObject({ type: 'contract', salary: '₹12L–₹18L a year' })
  })

  it('prefers a direct employer link over a job-board link', () => {
    const job = normalizeJSearch({
      job_id: '3',
      job_title: 'SDE II',
      job_publisher: 'LinkedIn',
      job_apply_link: 'https://in.linkedin.com/jobs/view/3',
      apply_options: [
        { publisher: 'LinkedIn', apply_link: 'https://in.linkedin.com/jobs/view/3', is_direct: false },
        { publisher: 'Acme Careers', apply_link: 'https://boards.greenhouse.io/acme/jobs/3', is_direct: true },
      ],
    })
    expect(job).toMatchObject({ applyUrl: 'https://boards.greenhouse.io/acme/jobs/3', publisher: 'Acme Careers' })
  })

  it('drops listings with no apply link', () => {
    expect(normalizeJSearch({ job_id: '1', job_title: 'X', job_apply_link: null })).toBeNull()
  })

  it('falls back when company and location are missing', () => {
    const job = normalizeJSearch({ job_id: '1', job_title: 'X', job_apply_link: 'https://a.b' })
    expect(job).toMatchObject({ company: 'Unknown company', location: 'Location not listed', type: 'other' })
    expect(job?.salary).toBeUndefined()
  })
})

describe('normalizeRemotive', () => {
  it('maps a listing and treats its date as UTC', () => {
    const job = normalizeRemotive({
      id: 42,
      url: 'https://remotive.com/remote-jobs/x-42',
      title: ' Senior React Developer ',
      company_name: 'Globex',
      job_type: 'contract',
      publication_date: '2026-11-01T08:00:00',
      candidate_required_location: 'Worldwide',
      salary: '$90k',
      description: '<p>Hello</p>',
      tags: ['react', 'typescript'],
    })
    expect(job).toMatchObject({
      id: 'remotive:42',
      title: 'Senior React Developer',
      remote: true,
      type: 'contract',
      location: 'Worldwide',
      salary: '$90k',
      postedAt: '2026-11-01T08:00:00Z',
      tags: ['react', 'typescript'],
    })
  })
})

describe('normalizeArbeitnow', () => {
  it('maps a listing, converting the unix date and German job types', () => {
    const job = normalizeArbeitnow({
      slug: 'dev-berlin-1',
      company_name: 'Initech',
      title: 'Developer',
      description: '&lt;p&gt;Hallo &amp;amp; willkommen&lt;/p&gt;',
      remote: false,
      url: 'https://www.arbeitnow.com/jobs/dev-berlin-1',
      tags: ['it'],
      job_types: ['Vollzeit'],
      location: 'Berlin',
      created_at: 1794528000,
    })
    expect(job).toMatchObject({
      id: 'arbeitnow:dev-berlin-1',
      type: 'full-time',
      remote: false,
      location: 'Berlin',
      postedAt: new Date(1794528000 * 1000).toISOString(),
    })
    expect(job?.descriptionHtml).toBe('<p>Hallo &amp; willkommen</p>')
  })
})

describe('toJobType', () => {
  it.each([
    ['FULLTIME', 'full-time'],
    ['full_time', 'full-time'],
    ['Part Time', 'part-time'],
    ['CONTRACTOR', 'contract'],
    ['freelance', 'contract'],
    ['INTERN', 'internship'],
    ['Praktikum', 'internship'],
    ['', 'other'],
    [null, 'other'],
    ['berufserfahren', 'other'],
  ] as const)('%s -> %s', (raw, expected) => {
    expect(toJobType(raw)).toBe(expected)
  })
})

describe('unescapeIfEscaped', () => {
  it('leaves real HTML alone, even when it contains escaped text', () => {
    const html = '<p>Use &lt;div&gt; tags</p>'
    expect(unescapeIfEscaped(html)).toBe(html)
  })
  it('unescapes a mostly-escaped listing that carries a real footer link', () => {
    const html =
      '&lt;div&gt;&lt;p&gt;Hello&lt;/p&gt;&lt;ul&gt;&lt;li&gt;One&lt;/li&gt;&lt;/ul&gt;&lt;/div&gt;<a href="https://x.y">Find more</a>'
    expect(unescapeIfEscaped(html)).toBe(
      '<div><p>Hello</p><ul><li>One</li></ul></div><a href="https://x.y">Find more</a>',
    )
  })
  it('leaves plain text alone', () => {
    expect(unescapeIfEscaped('Salary &amp; benefits')).toBe('Salary &amp; benefits')
  })
})

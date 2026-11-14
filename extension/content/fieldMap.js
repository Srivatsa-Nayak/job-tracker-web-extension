// Decides which profile field, if any, belongs in a form control.
// Pure logic with no DOM or chrome.* access, so it can be tested on its own.
(() => {
  if (globalThis.__jtFieldMap) return

  // Controls whose description matches this are never filled.
  const NEVER =
    /middle name|maiden|emergency|\breferr|\breference|school|universit|college|degree|institution|password|captcha|\bsearch|coupon|promo|recruiter|hiring manager|pronoun|gender|\brace\b|ethnic|veteran|disab|date of birth|birthday|\bssn\b|social security|passport|national id/

  // First matching rule wins, so specific rules come before general ones.
  // `autocomplete` values are the HTML autofill tokens; `patterns` run against
  // the control's label, aria-label, placeholder, name and id, lower-cased.
  const RULES = [
    { key: 'email', autocomplete: ['email'], types: ['email'], patterns: [/e-?mail/] },
    {
      key: 'phone',
      autocomplete: ['tel', 'tel-national'],
      types: ['tel'],
      patterns: [/phone|mobile|telephone|contact number|cell/],
      exclude: /country code|dial code|extension|phone type|device type/,
    },
    { key: 'linkedin', patterns: [/linked ?in/] },
    { key: 'github', patterns: [/git ?hub/] },
    {
      key: 'firstName',
      autocomplete: ['given-name'],
      patterns: [/first name|given name|fname|forename|preferred name|nickname/],
    },
    { key: 'lastName', autocomplete: ['family-name'], patterns: [/last name|family name|surname|lname/] },
    {
      key: 'requiresSponsorship',
      patterns: [/sponsor/, /require.{0,40}visa/, /visa.{0,40}require/],
    },
    {
      key: 'workAuthorization',
      patterns: [
        /work authori[sz]ation/,
        /authori[sz]ed to work/,
        /legally (authori[sz]ed|eligible|permitted)/,
        /right to work/,
        /eligible to work/,
        /visa status|work permit/,
      ],
    },
    {
      key: 'yearsExperience',
      patterns: [
        /years? of .{0,30}experience/,
        /experience.{0,12}years/,
        /total experience|how many years/,
        /years experience/,
      ],
    },
    {
      key: 'expectedSalary',
      patterns: [/salary|compensation|expected ctc|desired pay|pay expectation|remuneration/],
      exclude: /current salary|current ctc|current compensation|present salary/,
    },
    {
      key: 'noticePeriod',
      patterns: [/notice period|when can you start|earliest start|start date|available to start|availability/],
    },
    { key: 'coverLetter', patterns: [/cover letter|covering letter|letter of motivation|motivation letter/] },
    {
      key: 'currentTitle',
      autocomplete: ['organization-title'],
      patterns: [/current (job )?(title|role|position)|job title|current designation|\bdesignation\b|\btitle\b/],
      exclude: /salutation|\bmr\b|\bms\b|honorific|courtesy/,
    },
    {
      key: 'currentCompany',
      autocomplete: ['organization'],
      patterns: [/current (company|employer|organi[sz]ation)|company name|\bemployer\b|\bcompany\b|\borgani[sz]ation\b/],
      exclude: /how did you hear|company website|worked (at|for) (this|our)/,
    },
    {
      key: 'country',
      autocomplete: ['country', 'country-name'],
      patterns: [/country/],
      exclude: /country code|dial code|phone/,
    },
    {
      key: 'city',
      autocomplete: ['address-level2'],
      patterns: [/\bcity\b|\btown\b|current location|\blocation\b|where are you (based|located)/],
      exclude: /relocat|preferred location|job location|office location|location preference/,
    },
    {
      key: 'portfolio',
      autocomplete: ['url'],
      types: ['url'],
      patterns: [/portfolio|website|personal site|personal url|\bblog\b|\burl\b|other link/],
      exclude: /twitter|facebook|instagram|company website/,
    },
    {
      key: 'fullName',
      autocomplete: ['name'],
      patterns: [/full name|legal name|your name|\bname\b/],
      exclude: /company|employer|user ?name|file ?name|manager|contact name/,
    },
  ]

  /** Turns "firstName", "first_name" or "applicant[first-name]" into "first name". */
  function humanize(text) {
    return String(text || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_\-.[\]:/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  /**
   * @param {{ autocomplete?: string, type?: string, text: string }} field
   *   `text` is everything known about the control, already humanized.
   * @returns {string | null} a profile key, or null when the control should be left alone
   */
  function matchField(field) {
    const text = field.text || ''
    if (NEVER.test(text)) return null

    const tokens = String(field.autocomplete || '')
      .toLowerCase()
      .split(/\s+/)
    for (const rule of RULES) {
      if (rule.autocomplete && rule.autocomplete.some((token) => tokens.includes(token))) return rule.key
    }
    for (const rule of RULES) {
      if (rule.exclude && rule.exclude.test(text)) continue
      if (rule.patterns.some((pattern) => pattern.test(text))) return rule.key
    }
    // The input type alone is the weakest signal, used only when the wording matched nothing.
    for (const rule of RULES) {
      if (rule.types && rule.types.includes(field.type) && !(rule.exclude && rule.exclude.test(text))) return rule.key
    }
    return null
  }

  /** The text to type for a matched key. Empty string means "nothing to fill". */
  function valueFor(key, profile, text) {
    const get = (k) => String(profile[k] || '').trim()
    switch (key) {
      case 'fullName':
        return [get('firstName'), get('lastName')].filter(Boolean).join(' ')
      case 'city':
        // A bare "Location" box wants "City, Country"; a "City" box wants just the city.
        return /\bcity\b|\btown\b/.test(text || '')
          ? get('city')
          : [get('city'), get('country')].filter(Boolean).join(', ')
      case 'requiresSponsorship':
        return get(key) === 'yes' ? 'Yes' : get(key) === 'no' ? 'No' : ''
      default:
        return get(key)
    }
  }

  globalThis.__jtFieldMap = { RULES, humanize, matchField, valueFor }
})()

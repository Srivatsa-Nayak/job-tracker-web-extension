/**
 * Application sites where the extension fills the form by itself.
 * Keep in sync with the `matches` list in extension/manifest.json.
 */
const AUTO_FILL_HOSTS = [
  /(^|\.)greenhouse\.io$/,
  /(^|\.)lever\.co$/,
  /(^|\.)ashbyhq\.com$/,
  /(^|\.)myworkdayjobs\.com$/,
  /(^|\.)smartrecruiters\.com$/,
  /(^|\.)workable\.com$/,
]

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function fillsAutomatically(url: string): boolean {
  const host = hostOf(url)
  return AUTO_FILL_HOSTS.some((re) => re.test(host))
}

/** The extension never touches LinkedIn: automating it breaks LinkedIn's terms. */
export function isLinkedIn(url: string): boolean {
  return /(^|\.)linkedin\.com$/.test(hostOf(url))
}

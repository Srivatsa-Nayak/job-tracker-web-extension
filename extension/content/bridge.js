// Runs on the Job Tracker web app's own pages. Receives the profile and resume
// from the app over window messages and keeps them in the extension's storage,
// where the autofill script reads them on application sites.
(() => {
  const CHANNEL = 'job-tracker'

  function reply(type) {
    window.postMessage(
      { channel: CHANNEL, from: 'extension', type, version: chrome.runtime.getManifest().version },
      window.location.origin,
    )
  }

  function cleanProfile(input) {
    if (!input || typeof input !== 'object') return null
    const profile = {}
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') profile[key] = value.slice(0, 20000)
    }
    return profile
  }

  function cleanResume(input) {
    if (!input || typeof input !== 'object') return null
    const { name, type, size, dataUrl } = input
    if (typeof name !== 'string' || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null
    return { name, type: typeof type === 'string' ? type : '', size: Number(size) || 0, dataUrl }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return
    const message = event.data
    if (!message || message.channel !== CHANNEL || message.from !== 'app') return

    try {
      if (message.type === 'PING') {
        reply('PONG')
      } else if (message.type === 'SYNC') {
        const profile = cleanProfile(message.payload && message.payload.profile)
        if (!profile) return
        chrome.storage.local
          .set({
            profile,
            resume: cleanResume(message.payload.resume),
            syncedAt: new Date().toISOString(),
          })
          .then(() => reply('SYNCED'))
      }
    } catch {
      // The extension was reloaded or removed while this page stayed open.
      // Staying silent lets the app show "not connected" until the page reloads.
    }
  })
})()

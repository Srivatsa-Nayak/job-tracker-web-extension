// Opens the Job Tracker app (a page packaged inside this extension) and fills
// the form on the active tab when asked from the popup or the keyboard shortcut.

const APP_URL = chrome.runtime.getURL('app/index.html')

/** Shows the app, reusing its tab when one is already open. */
async function openApp(hash = '') {
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find((tab) => tab.url && tab.url.startsWith(APP_URL))
  if (existing && existing.id !== undefined) {
    await chrome.tabs.update(existing.id, hash ? { active: true, url: APP_URL + hash } : { active: true })
    if (existing.windowId !== undefined) await chrome.windows.update(existing.windowId, { focused: true })
  } else {
    await chrome.tabs.create({ url: APP_URL + hash })
  }
}

// Both the popup button and the shortcut count as a user gesture, which is
// what lets the extension touch that one tab without holding permission for
// every website.
async function fillActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab || tab.id === undefined) return { ok: false, message: 'No active tab.' }

  let host = ''
  try {
    host = new URL(tab.url || '').hostname
  } catch {
    // tab.url is missing on pages the extension cannot see; handled below
  }
  if (/(^|\.)linkedin\.com$/i.test(host)) {
    return { ok: false, message: 'Autofill is turned off on LinkedIn.' }
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/fieldMap.js', 'content/autofill.js'],
    })
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.__jtAutofill.run({ manual: true }),
    })
    return { ok: true, result: injection && injection.result }
  } catch {
    return {
      ok: false,
      message: 'This page cannot be filled. Browser pages, the Chrome Web Store and Job Tracker itself are off limits.',
    }
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') void openApp('#/profile')
})

chrome.commands.onCommand.addListener((command) => {
  if (command === 'fill-page') void fillActiveTab()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'FILL_ACTIVE_TAB') {
    fillActiveTab().then(sendResponse)
    return true // keep the channel open for the async reply
  }
  if (message && message.type === 'OPEN_APP') {
    openApp(typeof message.hash === 'string' ? message.hash : '').then(() => sendResponse({ ok: true }))
    return true
  }
  return false
})

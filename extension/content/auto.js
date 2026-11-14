// Loaded only on the application sites listed in manifest.json: fills the form
// without being asked, unless that has been turned off in the extension popup.
chrome.storage.local.get({ autoFill: true }).then(({ autoFill }) => {
  if (autoFill) void globalThis.__jtAutofill.run({ manual: false })
})

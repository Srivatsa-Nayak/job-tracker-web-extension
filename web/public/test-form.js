// Script for test-form.html (kept in its own file because pages inside an
// extension may not contain inline scripts).
const form = document.getElementById('application')
form.addEventListener('submit', (event) => {
  event.preventDefault()
  document.getElementById('sent').hidden = false
})

// Chrome does not let an extension inject scripts into its own pages, so the
// shortcut and the "Fill this page" button do nothing here when this form is
// opened from inside the extension. In that case the page loads the same fill
// script itself and offers a button for it.
if (window.location.protocol === 'chrome-extension:') {
  const load = (src) =>
    new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })

  load('../content/fieldMap.js')
    .then(() => load('../content/autofill.js'))
    .then(() => {
      const button = document.getElementById('fill-here')
      button.hidden = false
      button.addEventListener('click', () => void globalThis.__jtAutofill.run({ manual: true }))
    })
}

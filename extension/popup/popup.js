const profileLine = document.getElementById('profile-line')
const resumeLine = document.getElementById('resume-line')
const fillButton = document.getElementById('fill')
const result = document.getElementById('result')
const autoToggle = document.getElementById('auto')

document.getElementById('open-app').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'OPEN_APP' })
  window.close()
})

async function showStatus() {
  const { profile, resume, autoFill } = await chrome.storage.local.get({
    profile: null,
    resume: null,
    autoFill: true,
  })
  autoToggle.checked = autoFill

  const name = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') : ''
  if (name || (profile && profile.email)) {
    profileLine.textContent = `Filling as ${name || profile.email}`
  } else {
    profileLine.textContent = 'No profile yet'
    resumeLine.textContent = 'Open Job Tracker and fill in Profile so forms can be filled for you.'
    return
  }
  resumeLine.textContent = resume ? `Resume: ${resume.name}` : 'No resume added yet.'
}

fillButton.addEventListener('click', async () => {
  fillButton.disabled = true
  result.textContent = 'Filling'
  const response = await chrome.runtime.sendMessage({ type: 'FILL_ACTIVE_TAB' })
  fillButton.disabled = false

  if (!response || !response.ok) {
    result.textContent = (response && response.message) || 'Could not fill this page.'
    return
  }
  const r = response.result || {}
  if (r.skipped === 'no-profile') result.textContent = 'Add your details in Job Tracker’s Profile first.'
  else if (!r.filled && !r.resume) result.textContent = 'No matching empty fields on this page.'
  else {
    const fields = `${r.filled} ${r.filled === 1 ? 'field' : 'fields'} filled`
    result.textContent = r.resume ? `${fields}, resume attached.` : `${fields}.`
  }
})

autoToggle.addEventListener('change', () => {
  void chrome.storage.local.set({ autoFill: autoToggle.checked })
})

void showStatus()

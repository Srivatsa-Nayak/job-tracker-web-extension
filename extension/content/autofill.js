// Fills the application form on the current page from the saved profile and
// attaches the resume. It never presses Submit and never runs on LinkedIn.
(() => {
  if (globalThis.__jtAutofill) return
  const { humanize, matchField, valueFor } = globalThis.__jtFieldMap

  const FILLED_RING = '0 0 0 2px #f2b01e'
  const NEEDS_YOU_RING = '0 0 0 2px #b8362c'
  const RESUME_WORDS = /resume|résumé|\bcv\b|curriculum/
  const NOT_RESUME_WORDS = /cover|letter|photo|picture|avatar|transcript|portfolio|certificate|headshot/

  /** Controls this script has already handled, so a field the person clears is not refilled. */
  const handled = new WeakSet()

  function onLinkedIn() {
    return /(^|\.)linkedin\.com$/i.test(window.location.hostname)
  }

  function isVisible(el) {
    if (!el.isConnected) return false
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function textOf(node) {
    return node ? (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim() : ''
  }

  /** The question a control answers: its label, or failing that the nearest heading-like text. */
  function labelText(el) {
    const parts = []
    if (el.labels) for (const label of el.labels) parts.push(textOf(label))
    const labelledBy = el.getAttribute('aria-labelledby')
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) parts.push(textOf(document.getElementById(id)))
    }
    parts.push(el.getAttribute('aria-label') || '')
    if (parts.join('').trim() === '') {
      // No proper label: look for one in the surrounding field wrapper.
      let node = el.parentElement
      for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
        const label = node.querySelector('label, legend, [class*="label" i]')
        if (label && !label.contains(el)) {
          parts.push(textOf(label))
          break
        }
      }
    }
    return parts.join(' ')
  }

  function describe(el) {
    return humanize(
      [labelText(el), el.getAttribute('placeholder'), el.getAttribute('name'), el.id, el.getAttribute('data-qa')]
        .filter(Boolean)
        .join(' '),
    ).slice(0, 400)
  }

  /** The question a group of radio buttons answers. */
  function groupQuestion(radio) {
    const fieldset = radio.closest('fieldset, [role="radiogroup"], [role="group"]')
    if (fieldset) {
      const legend = fieldset.querySelector('legend')
      const labelledBy = fieldset.getAttribute('aria-labelledby')
      const text =
        textOf(legend) ||
        (labelledBy && textOf(document.getElementById(labelledBy.split(/\s+/)[0]))) ||
        fieldset.getAttribute('aria-label')
      if (text) return humanize(text)
    }
    return humanize(radio.getAttribute('name'))
  }

  // Frameworks such as React track input values themselves, so the value has to
  // go through the element's native setter and be announced with real events.
  function setNativeValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }

  function mark(el, ring) {
    const previous = el.style.boxShadow
    el.style.boxShadow = ring
    const clear = () => {
      el.style.boxShadow = previous
      el.removeEventListener('focus', clear)
      el.removeEventListener('input', clear)
    }
    el.addEventListener('focus', clear)
    el.addEventListener('input', clear)
  }

  function pickOption(select, value) {
    const wanted = value.trim().toLowerCase()
    if (!wanted) return null
    const options = Array.from(select.options).filter((o) => o.value !== '' && !o.disabled)
    const text = (o) => o.text.trim().toLowerCase()
    return (
      options.find((o) => text(o) === wanted || o.value.toLowerCase() === wanted) ||
      options.find((o) => text(o).startsWith(wanted)) ||
      // "No" must not match "Not sure", so short answers only match whole words.
      options.find((o) => new RegExp(`(^|\\W)${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`).test(text(o))) ||
      null
    )
  }

  function fillTextLike(el, profile) {
    const text = describe(el)
    const key = matchField({ autocomplete: el.getAttribute('autocomplete'), type: el.type, text })
    if (!key) return false
    // A long generic letter does not belong in a one-line box.
    if (key === 'coverLetter' && !(el instanceof HTMLTextAreaElement)) return false
    const value = valueFor(key, profile, text)
    if (!value) return false

    if (el instanceof HTMLSelectElement) {
      const option = pickOption(el, value)
      if (!option) return false
      setNativeValue(el, option.value)
    } else {
      if (el.type === 'number' && Number.isNaN(Number(value))) return false
      const max = el.maxLength > 0 ? el.maxLength : Infinity
      setNativeValue(el, value.slice(0, max))
    }
    mark(el, FILLED_RING)
    return true
  }

  function fillRadioGroups(root, profile, result) {
    const answer = valueFor('requiresSponsorship', profile, '')
    if (!answer) return
    const groups = new Map()
    for (const radio of root.querySelectorAll('input[type="radio"]')) {
      if (radio.disabled || !radio.name) continue
      if (!groups.has(radio.name)) groups.set(radio.name, [])
      groups.get(radio.name).push(radio)
    }
    for (const radios of groups.values()) {
      if (radios.some((r) => r.checked || handled.has(r))) continue
      const question = groupQuestion(radios[0])
      if (matchField({ text: question }) !== 'requiresSponsorship') continue
      const choice = radios.find((r) => {
        const label = (textOf(r.labels && r.labels[0]) || r.value).trim().toLowerCase()
        return label === answer.toLowerCase() || label.startsWith(`${answer.toLowerCase()},`)
      })
      radios.forEach((r) => handled.add(r))
      if (choice) {
        choice.click()
        result.filled++
      }
    }
  }

  function resumeToFile(resume) {
    const [header, base64] = resume.dataUrl.split(',')
    const mime = (/data:([^;]+)/.exec(header) || [])[1] || resume.type || 'application/octet-stream'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new File([bytes], resume.name, { type: mime })
  }

  function attachResume(root, resume) {
    if (!resume || !resume.dataUrl) return false
    const inputs = Array.from(root.querySelectorAll('input[type="file"]')).filter((i) => !i.disabled)
    if (inputs.length === 0) return false
    const described = inputs.map((input) => ({ input, text: describe(input) }))
    let target = described.find((d) => RESUME_WORDS.test(d.text) && !/cover/.test(d.text))
    if (!target) {
      // An unlabelled upload is taken to be the resume only when it is the sole candidate.
      const others = described.filter((d) => !NOT_RESUME_WORDS.test(d.text))
      if (others.length === 1) target = others[0]
    }
    if (!target || handled.has(target.input) || target.input.files.length > 0) return false

    const transfer = new DataTransfer()
    transfer.items.add(resumeToFile(resume))
    target.input.files = transfer.files
    target.input.dispatchEvent(new Event('input', { bubbles: true }))
    target.input.dispatchEvent(new Event('change', { bubbles: true }))
    handled.add(target.input)
    return true
  }

  /** One pass over the page. Returns counts for the badge. */
  function fillOnce(profile, resume) {
    const result = { filled: 0, resume: false, needsYou: 0 }
    const controls = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="file"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="password"]), textarea, select',
    )
    for (const el of controls) {
      if (handled.has(el) || el.disabled || el.readOnly || !isVisible(el)) continue
      if (el.value && el.value.trim() !== '') continue
      handled.add(el)
      if (fillTextLike(el, profile)) {
        result.filled++
      } else if (el.required || el.getAttribute('aria-required') === 'true') {
        mark(el, NEEDS_YOU_RING)
        result.needsYou++
      }
    }
    fillRadioGroups(document, profile, result)
    result.resume = attachResume(document, resume)
    return result
  }

  // ---------- Badge ----------
  let badgeHost = null

  function showBadge(message, tone) {
    if (window.top !== window && document.documentElement.clientHeight < 200) return
    if (badgeHost) badgeHost.remove()
    badgeHost = document.createElement('div')
    badgeHost.setAttribute('data-job-tracker-badge', '')
    const shadow = badgeHost.attachShadow({ mode: 'open' })
    const accent = tone === 'problem' ? '#f1887f' : '#f2b01e'
    shadow.innerHTML = `
      <style>
        .badge {
          position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
          display: flex; align-items: flex-start; gap: 10px; max-width: 340px;
          padding: 12px 14px; border-radius: 12px; border-left: 4px solid ${accent};
          background: #14213d; color: #e8ecf6;
          font: 500 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
          box-shadow: 0 12px 32px -8px rgba(9, 14, 26, 0.5);
        }
        strong { display: block; font-weight: 700; color: #fff; }
        button {
          all: unset; cursor: pointer; padding: 2px 6px; border-radius: 6px;
          font: 700 16px/1 system-ui, sans-serif; color: #a3aecb;
        }
        button:hover, button:focus-visible { background: #24345c; color: #fff; }
      </style>
      <div class="badge" role="status">
        <div><strong>Job Tracker</strong><span class="message"></span></div>
        <button type="button" aria-label="Dismiss">×</button>
      </div>`
    shadow.querySelector('.message').textContent = message
    shadow.querySelector('button').addEventListener('click', () => badgeHost.remove())
    document.documentElement.appendChild(badgeHost)
  }

  function summarize(total) {
    const parts = []
    if (total.filled > 0) parts.push(`Filled ${total.filled} ${total.filled === 1 ? 'field' : 'fields'}`)
    if (total.resume) parts.push(parts.length ? 'attached your resume' : 'Attached your resume')
    let message = `${parts.join(' and ')}.`
    if (total.needsYou > 0) {
      message += ` ${total.needsYou} required ${total.needsYou === 1 ? 'field still needs' : 'fields still need'} you (outlined in red).`
    }
    return `${message} Check everything, then submit.`
  }

  // ---------- Entry point ----------
  let watching = false
  const total = { filled: 0, resume: false, needsYou: 0 }

  function pass(profile, resume) {
    const result = fillOnce(profile, resume)
    total.filled += result.filled
    total.needsYou += result.needsYou
    total.resume = total.resume || result.resume
    return result.filled > 0 || result.resume
  }

  /**
   * @param {{ manual?: boolean, profile?: object, resume?: object | null }} options
   *   `manual` is true when the person asked for a fill (button or shortcut), which
   *   always reports back. `profile` and `resume` are read from extension storage
   *   unless passed in (tests pass them in).
   */
  async function run(options = {}) {
    const manual = Boolean(options.manual)
    if (onLinkedIn()) {
      if (manual) showBadge('Autofill is turned off on LinkedIn. Fill in this application yourself.', 'problem')
      return { ...total, skipped: 'linkedin' }
    }

    let { profile, resume } = options
    if (!profile) {
      const stored = await chrome.storage.local.get(['profile', 'resume'])
      profile = stored.profile
      resume = stored.resume
    }
    const hasProfile = profile && Object.values(profile).some((v) => String(v || '').trim() !== '')
    if (!hasProfile && !resume) {
      if (manual) showBadge('No profile yet. Open Job Tracker, fill in Profile, then try again.', 'problem')
      return { ...total, skipped: 'no-profile' }
    }
    profile = profile || {}

    const changed = pass(profile, resume)
    if (changed) showBadge(summarize(total))
    else if (manual) showBadge('No matching empty fields found on this page.', 'problem')

    // Application forms often appear after a click or load in steps. Keep
    // filling newly added fields for a while, then stop watching.
    if (!watching) {
      watching = true
      let timer = null
      const observer = new MutationObserver(() => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          if (pass(profile, resume)) showBadge(summarize(total))
        }, 400)
      })
      observer.observe(document.documentElement, { childList: true, subtree: true })
      setTimeout(
        () => {
          observer.disconnect()
          watching = false
        },
        manual ? 20000 : 60000,
      )
    }
    return { ...total }
  }

  globalThis.__jtAutofill = { run }
})()

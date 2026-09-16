/**
 * @name Client Theme
 * @description Applies a user-created CSS theme to the League Client.
 * @author L9Lenny
 */

var STYLE_ID = 'lpt-client-theme'
var started = false
var activeCSS = null
var roots = new Map()

function discoverRoots(node) {
  if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return
  if (node.shadowRoot) installRoot(node.shadowRoot)
  node.querySelectorAll('*').forEach(function(element) {
    if (element.shadowRoot) installRoot(element.shadowRoot)
  })
}

function installRoot(root) {
  if (roots.has(root)) return
  var style = document.createElement('style')
  style.setAttribute('data-lpt-theme-style', '')
  style.textContent = activeCSS
  var observer = new MutationObserver(function(records) {
    records.forEach(function(record) { record.addedNodes.forEach(discoverRoots) })
  })
  roots.set(root, { style: style, observer: observer })
  ;(root === document ? document.head : root).appendChild(style)
  observer.observe(root, { childList: true, subtree: true })
  discoverRoots(root)
}

function log(message) {
  console.log('[ClientTheme] ' + message)
}

async function loadTheme() {
  try {
    var response = await fetch('//plugins/client-theme/theme.json?t=' + Date.now(), { cache: 'no-store' })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    var theme = await response.json()
    if (!theme || theme.enabled !== true) return null

    if (typeof theme.css !== 'string') throw new Error('Invalid theme CSS')
    return { name: theme.name || 'Custom theme', css: theme.css }
  } catch (error) {
    log('Theme load failed: ' + error)
    return undefined // Keep the last working theme on temporary read failures.
  }
}

function applyTheme(theme) {
  if (theme === undefined) return
  if (!theme) {
    activeCSS = null
    roots.forEach(function(entry) { entry.observer.disconnect(); entry.style.remove() })
    roots.clear()
    return
  }
  var changed = activeCSS !== theme.css
  activeCSS = theme.css
  installRoot(document)
  roots.get(document).style.id = STYLE_ID
  roots.forEach(function(entry, root) {
    if (root !== document && !root.host.isConnected) {
      entry.observer.disconnect(); entry.style.remove(); roots.delete(root)
      return
    }
    if (entry.style.textContent !== activeCSS) entry.style.textContent = activeCSS
    if (!entry.style.isConnected) (root === document ? document.head : root).appendChild(entry.style)
  })
  // Also discover roots attached to existing hosts since the last refresh.
  discoverRoots(document)
  if (changed) log('Applied theme: ' + theme.name)
}

function refreshTheme() {
  loadTheme().then(applyTheme)
}

export function init() {
  if (started) return
  started = true
  refreshTheme()
  var timer = setInterval(refreshTheme, 5000)
  window.addEventListener('unload', function() { clearInterval(timer); applyTheme(null) }, { once: true })
  log('Plugin started')
}

export default function() {
  init()
}

export { applyTheme, loadTheme }

import { afterEach, expect, it, vi } from 'vitest'
import { applyTheme, loadTheme } from './index.js'

afterEach(() => { applyTheme(null); document.body.innerHTML = ''; vi.unstubAllGlobals() })

it('updates one stylesheet, preserves it on read errors, and removes it when disabled', async () => {
  applyTheme({ css: 'body { color: red }' })
  const original = document.getElementById('lpt-client-theme')
  applyTheme({ css: 'body { color: blue }' })
  expect(document.getElementById('lpt-client-theme')).toBe(original)
  expect(original.textContent).toContain('blue')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  applyTheme(await loadTheme())
  expect(document.getElementById('lpt-client-theme')).toBe(original)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: false }) }))
  applyTheme(await loadTheme())
  expect(document.getElementById('lpt-client-theme')).toBeNull()
})

it('themes existing and newly mounted shadow roots and cleans them on disable', async () => {
  const host = document.createElement('div')
  const shadow = host.attachShadow({ mode: 'open' })
  document.body.appendChild(host)
  applyTheme({ css: '.panel { color: pink }' })
  expect(shadow.querySelector('style').textContent).toContain('pink')
  const nested = document.createElement('div')
  const inner = nested.attachShadow({ mode: 'open' })
  shadow.appendChild(nested)
  await vi.waitFor(() => expect(inner.querySelector('style')).not.toBeNull())
  applyTheme({ css: '.panel { color: cyan }' })
  expect(inner.querySelector('style').textContent).toContain('cyan')
  applyTheme(null)
  expect(shadow.querySelector('style')).toBeNull()
  expect(inner.querySelector('style')).toBeNull()
})

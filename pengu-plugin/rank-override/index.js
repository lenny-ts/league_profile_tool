/**
 * @name Rank Override
 * @description Overrides rank display in League client profile overview
 * @author L9Lenny
 */

var overrideRank = null
var observer = null
var cssInjected = false
var overviewEnabled = true
var touchedElements = []
var hoverApplyTimer = null
var clashCatalogs = null
var clashCatalogPromise = null
var pluginStarted = false
var xhrInstalled = false
var socketHookInstalled = false
var dataBindingListeners = []
var overviewPayloadCache = {}
var championSummary = null
var championSummaryPromise = null
var customBackground = null
var customBackgroundTouched = []

function log(msg) { console.log('[RankOverride] ' + msg) }

function rememberAttribute(element, name) {
  if (!element._rankOverrideOriginal) {
    element._rankOverrideOriginal = {}
    touchedElements.push(element)
  }
  if (!(name in element._rankOverrideOriginal)) element._rankOverrideOriginal[name] = element.getAttribute(name)
}

function rememberText(element) {
  if (!element || element._rankOverrideOriginalText !== undefined) return
  element._rankOverrideOriginalText = element.textContent
  touchedElements.push(element)
}

function restoreOverrides() {
  for (var i = 0; i < touchedElements.length; i++) {
    var element = touchedElements[i]
    var attrs = element._rankOverrideOriginal
    if (attrs) {
      for (var name in attrs) {
        if (attrs[name] === null) element.removeAttribute(name)
        else element.setAttribute(name, attrs[name])
      }
      delete element._rankOverrideOriginal
    }
    if (element._rankOverrideOriginalText !== undefined) {
      element.textContent = element._rankOverrideOriginalText
      delete element._rankOverrideOriginalText
    }
    // Regalia web components cache emblem art internally; reconnect them so
    // removing the override attributes also refreshes the rendered icon.
    if (element.isConnected && (element.tagName === 'LOL-REGALIA-CREST-V2-ELEMENT' || element.tagName === 'LOL-REGALIA-EMBLEM-ELEMENT')) {
      element.replaceWith(element.cloneNode(true))
    }
  }
  touchedElements = []
}

async function fetchDesiredRank() {
  try {
    var configRes = await fetch('//plugins/rank-override/rank-config.json?t=' + Date.now(), { cache: 'no-store' })
    if (configRes.ok) {
      var config = await configRes.json()
      // The settings reset writes NONE. Treat it as an explicit clear instead
      // of falling back to stale LCU data from a previous queue.
      if (config.tier === 'NONE' || !config.tier) return null
      return {
        tier: config.tier,
        division: config.division || 'I',
        queue: config.queue || 'RANKED_SOLO_5x5',
        leaguePoints: Math.max(0, parseInt(config.leaguePoints, 10) || 0),
        lastSeasonTier: config.lastSeasonTier || 'UNRANKED',
        borderTier: config.borderTier || 'AUTO',
        bannerTier: config.bannerTier || 'AUTO',
        honorLevel: config.honorLevel || 'AUTO',
        masteryScore: config.masteryScore === undefined ? '' : String(config.masteryScore),
        masteryLevel: config.masteryLevel || 'AUTO',
        masteryLevel2: config.masteryLevel2 || 'AUTO',
        masteryLevel3: config.masteryLevel3 || 'AUTO',
        masteryChampionId: config.masteryChampionId || 'AUTO',
        masteryChampionId2: config.masteryChampionId2 || 'AUTO',
        masteryChampionId3: config.masteryChampionId3 || 'AUTO',
        trophyTheme: config.trophyTheme || 'AUTO',
        trophyBracket: parseInt(config.trophyBracket, 10) || 4,
        trophyTier: parseInt(config.trophyTier, 10) || 4,
        clashBannerTheme: config.clashBannerTheme || 'AUTO',
        clashBannerLevel: parseInt(config.clashBannerLevel, 10) || 1
      }
    }
  } catch (e) {}

  try {
    var res = await fetch('/lol-chat/v1/me', { credentials: 'include' })
    if (!res.ok) return null
    var data = await res.json()
    if (!data || !data.lol) return null
    var lol = typeof data.lol === 'string' ? JSON.parse(data.lol) : data.lol
    if (lol.rankedLeagueTier && lol.rankedLeagueTier !== 'NONE') {
      return {
        tier: lol.rankedLeagueTier,
        division: lol.rankedLeagueDivision || 'I',
        queue: lol.rankedLeagueQueue || 'RANKED_SOLO_5x5',
        leaguePoints: 0,
        lastSeasonTier: 'UNRANKED',
        borderTier: 'AUTO',
        bannerTier: 'AUTO',
        honorLevel: 'AUTO',
        masteryScore: '',
        masteryLevel: 'AUTO',
        masteryLevel2: 'AUTO',
        masteryLevel3: 'AUTO',
        masteryChampionId: 'AUTO',
        masteryChampionId2: 'AUTO',
        masteryChampionId3: 'AUTO',
        trophyTheme: 'AUTO',
        trophyBracket: 4,
        trophyTier: 4,
        clashBannerTheme: 'AUTO',
        clashBannerLevel: 1
      }
    }
    return null
  } catch (e) { return null }
}

function injectCSS() {
  if (cssInjected || document.getElementById('rank-override-css')) return
  cssInjected = true
  var style = document.createElement('style')
  style.id = 'rank-override-css'
  style.textContent = '.style-profile-emblem-header-subtitle, .style-profile-emblem-subheader-ranked { color: #ffffff !important; }'
  document.head.appendChild(style)
}

function removeCSS() {
  var style = document.getElementById('rank-override-css')
  if (style) style.remove()
  cssInjected = false
}

function clearRankBorderStyles() {
  var styles = queryAllDeep(document, '#rank-override-border-css')
  for (var i = 0; i < styles.length; i++) styles[i].remove()
}

function applyRankBorder(rank) {
  if (!rank) return
  var tier = (rank.borderTier === 'AUTO' ? rank.tier : rank.borderTier).toLowerCase()
  var wings = '/fe/lol-static-assets/images/ranked-emblem/wings/wings_' + tier + '.png'
  var profiles = queryAllDeep(document, 'lol-regalia-profile-v2-element')

  for (var i = 0; i < profiles.length; i++) {
    if (!profiles[i].shadowRoot) continue
    var crests = queryAllDeep(profiles[i].shadowRoot, 'lol-regalia-crest-v2-element.regalia-profile-crest-element')
    for (var c = 0; c < crests.length; c++) {
      if (!crests[c].shadowRoot) continue
      var style = crests[c].shadowRoot.querySelector('#rank-override-border-css')
      if (!style) {
        style = document.createElement('style')
        style.id = 'rank-override-border-css'
        crests[c].shadowRoot.appendChild(style)
      }
      style.textContent =
        '.lol-regalia-ranked-border-container {' +
        'display: block !important;' +
        'background-image: url("' + wings + '") !important;' +
        'background-size: contain !important;' +
        'background-position: center !important;' +
        'background-repeat: no-repeat !important;' +
        '}' +
        '.regalia-crest-wing, .regalia-crest-idle {' +
        'display: none !important;' +
        '}' +
        '.lol-regalia-none-border-container, .lol-regalia-themed-level-ring {' +
        'display: none !important;' +
        '}'
    }
  }
}

function clearRankBannerStyles() {
  var styles = queryAllDeep(document, '#rank-override-banner-css')
  for (var i = 0; i < styles.length; i++) styles[i].remove()
}

function applyRankBanner(rank) {
  if (!rank) return
  var selected = rank.bannerTier === 'AUTO' ? rank.lastSeasonTier : rank.bannerTier
  var assetName = selected === 'DEFAULT' || selected === 'UNRANKED' ? 'default' : selected.toLowerCase()
  var asset = '/lol-game-data/assets/ASSETS/Regalia/BannerSkins/' + assetName + '.png'
  var profiles = queryAllDeep(document, 'lol-regalia-profile-v2-element')

  for (var i = 0; i < profiles.length; i++) {
    if (!profiles[i].shadowRoot) continue
    var banners = queryAllDeep(profiles[i].shadowRoot, 'lol-regalia-banner-v2-element.regalia-profile-banner-backdrop')
    for (var b = 0; b < banners.length; b++) {
      if (!banners[b].shadowRoot) continue
      var style = banners[b].shadowRoot.querySelector('#rank-override-banner-css')
      if (!style) {
        style = document.createElement('style')
        style.id = 'rank-override-banner-css'
        banners[b].shadowRoot.appendChild(style)
      }
      style.textContent =
        '.regalia-banner-asset-static-image {' +
        'content: url("' + asset + '") !important;' +
        '}'
    }
  }
}

function isTargetWrapper(wrapper, rank) {
  var title = wrapper.querySelector('.style-profile-emblem-header-title')
  if (!title) return false
  var titleText = title.textContent.toLowerCase()
  return (rank.queue === 'RANKED_SOLO_5x5' && (titleText.indexOf('solo') >= 0 || titleText.indexOf('duo') >= 0)) ||
         (rank.queue === 'RANKED_FLEX_SR' && titleText.indexOf('flex') >= 0) ||
         (rank.queue === 'RANKED_PREMADE_5x5' && titleText.indexOf('5v5') >= 0 && titleText.indexOf('flex') < 0) ||
         (rank.queue === 'RANKED_TFT' && titleText.indexOf('tft') >= 0 && titleText.indexOf('double') < 0) ||
         (rank.queue === 'RANKED_TFT_DOUBLE_UP' &&
           (titleText.indexOf('double') >= 0 || titleText.indexOf('2v2') >= 0 ||
             (titleText.indexOf('tft') >= 0 && titleText.indexOf('duo') >= 0)))
}

async function fetchOverviewSetting() {
  try {
    var res = await fetch('//plugins/rank-override/rank-config.json?t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return true
    var config = await res.json()
    return config.overviewEnabled !== false
  } catch (e) { return true }
}

async function fetchCustomBackground() {
  try {
    var res = await fetch('//plugins/rank-override/custom-background.json?t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    var config = await res.json()
    if (!config.enabled || !/^assets\/custom-background\.(png|jpe?g|webp|gif)$/i.test(config.asset || '')) return null
    return {
      asset: config.asset,
      fit: config.fit === 'contain' ? 'contain' : 'cover',
      position: /^(center|top|bottom|left|right)$/.test(config.position || '') ? config.position : 'center',
      dim: Math.min(80, Math.max(0, parseInt(config.dim, 10) || 0)),
      version: String(config.version || '')
    }
  } catch (e) { return null }
}

function queryAllDeep(root, selector) {
  var results = Array.prototype.slice.call(root.querySelectorAll(selector))
  var elements = root.querySelectorAll('*')
  for (var i = 0; i < elements.length; i++) {
    if (elements[i].shadowRoot) {
      results = results.concat(queryAllDeep(elements[i].shadowRoot, selector))
    }
  }
  return results
}

function rememberCustomBackgroundElement(element) {
  if (!element || element._customBackgroundOriginal) return
  element._customBackgroundOriginal = {
    src: element.getAttribute('src'),
    srcset: element.getAttribute('srcset'),
    backgroundImage: element.style.backgroundImage,
    backgroundSize: element.style.backgroundSize,
    backgroundPosition: element.style.backgroundPosition,
    backgroundRepeat: element.style.backgroundRepeat,
    width: element.style.width,
    height: element.style.height,
    maxWidth: element.style.maxWidth,
    maxHeight: element.style.maxHeight,
    display: element.style.display,
    objectFit: element.style.objectFit,
    objectPosition: element.style.objectPosition,
    imageRendering: element.style.imageRendering,
    filter: element.style.filter,
    opacity: element.style.opacity
  }
  customBackgroundTouched.push(element)
}

function clearCustomBackgroundElements() {
  for (var i = 0; i < customBackgroundTouched.length; i++) {
    var element = customBackgroundTouched[i]
    var original = element._customBackgroundOriginal
    if (!original) continue
    if (original.src === null) element.removeAttribute('src'); else element.setAttribute('src', original.src)
    if (original.srcset === null) element.removeAttribute('srcset'); else element.setAttribute('srcset', original.srcset)
    element.style.backgroundImage = original.backgroundImage
    element.style.backgroundSize = original.backgroundSize
    element.style.backgroundPosition = original.backgroundPosition
    element.style.backgroundRepeat = original.backgroundRepeat
    element.style.width = original.width
    element.style.height = original.height
    element.style.maxWidth = original.maxWidth
    element.style.maxHeight = original.maxHeight
    element.style.display = original.display
    element.style.objectFit = original.objectFit
    element.style.objectPosition = original.objectPosition
    element.style.imageRendering = original.imageRendering
    element.style.filter = original.filter
    element.style.opacity = original.opacity
    delete element._customBackgroundOriginal
  }
  customBackgroundTouched = []
}

function applyCustomBackground() {
  if (!customBackground) {
    if (customBackgroundTouched.length) clearCustomBackgroundElements()
    return
  }
  var url = '//plugins/rank-override/' + customBackground.asset + '?v=' + customBackground.version
  var brightness = Math.max(0.2, 1 - customBackground.dim / 100)
  var backgrounds = queryAllDeep(document,
    '.style-profile-background-image img, .style-profile-masked-image img, ' +
    '.style-profile-skin-background-image, .profile-skin-background-image, ' +
    '.style-profile-skin-background-component img, .profile-skin-background-component img, ' +
    '[class*="profile-skin-background"] img, lol-uikit-parallax-background img')
  for (var i = 0; i < backgrounds.length; i++) {
    var image = backgrounds[i]
    rememberCustomBackgroundElement(image)
    if (image.getAttribute('src') !== url) image.setAttribute('src', url)
    image.removeAttribute('srcset')
    image.style.width = '100%'
    image.style.height = '100%'
    image.style.maxWidth = 'none'
    image.style.maxHeight = 'none'
    image.style.display = 'block'
    image.style.objectFit = customBackground.fit
    image.style.objectPosition = customBackground.position
    image.style.imageRendering = 'auto'
    image.style.filter = 'brightness(' + brightness + ')'
  }
  // Some profile components expose both an image and its parent as background
  // surfaces. Painting both makes animated assets visibly render twice.
  if (!backgrounds.length) {
    var containers = queryAllDeep(document,
      '.style-profile-background-image, .style-profile-masked-image, ' +
      '.style-profile-skin-background-component, .profile-skin-background-component, [class*="profile-skin-background-component"]')
    for (var c = 0; c < containers.length; c++) {
      var container = containers[c]
      rememberCustomBackgroundElement(container)
      container.style.backgroundImage = 'linear-gradient(rgba(0,0,0,' + customBackground.dim / 100 + '), rgba(0,0,0,' + customBackground.dim / 100 + ')), url("' + url + '")'
      container.style.backgroundSize = customBackground.fit
      container.style.backgroundPosition = customBackground.position
      container.style.backgroundRepeat = 'no-repeat'
    }
  }
  var videos = queryAllDeep(document,
    '.style-profile-skin-background-component video, .profile-skin-background-component video, [class*="profile-skin-background"] video')
  for (var v = 0; v < videos.length; v++) {
    rememberCustomBackgroundElement(videos[v])
    videos[v].style.opacity = '0'
  }
}

function setCustomBackground(config) {
  if (JSON.stringify(customBackground) === JSON.stringify(config)) {
    applyCustomBackground()
    return
  }
  clearCustomBackgroundElements()
  customBackground = config
  applyCustomBackground()
}

function patchRankedQueues(queues, rank) {
  if (!queues || !rank) return
  for (var i = 0; i < queues.length; i++) {
    var q = queues[i]
    var qt = q.queueType || (q.get && q.get('queueType'))
    if (qt === rank.queue) {
      if (q.set) {
        q.set('tier', rank.tier)
        q.set('division', rank.division)
        q.set('leaguePoints', rank.leaguePoints)
        q.set('previousSeasonEndTier', rank.lastSeasonTier)
      } else {
        q.tier = rank.tier
        q.division = rank.division
        q.leaguePoints = rank.leaguePoints
        q.previousSeasonEndTier = rank.lastSeasonTier
      }
    }
  }
}

function interceptRankedData(data, rank) {
  if (!data || !rank) return data
  if (data.queues) patchRankedQueues(data.queues, rank)
  if (data.queueMap && data.queueMap[rank.queue]) patchRankedQueues([data.queueMap[rank.queue]], rank)
  if (data.highestRankedEntry && data.highestRankedEntry.queueType === rank.queue) patchRankedQueues([data.highestRankedEntry], rank)
  if (data.highestRankedEntrySR && data.highestRankedEntrySR.queueType === rank.queue) patchRankedQueues([data.highestRankedEntrySR], rank)
  data.highestPreviousSeasonEndTier = rank.lastSeasonTier
  data.highestPreviousSeasonEndDivision = 'I'
  if (data.rankedLeagueTier !== undefined) data.rankedLeagueTier = rank.tier
  if (data.rankedLeagueDivision !== undefined) data.rankedLeagueDivision = rank.division
  if (data.highestAchievedSeasonTier !== undefined) data.highestAchievedSeasonTier = rank.tier
  if (data.lol) {
    try {
      var lol = typeof data.lol === 'string' ? JSON.parse(data.lol) : data.lol
      if (lol.rankedLeagueTier) lol.rankedLeagueTier = rank.tier
      if (lol.rankedLeagueDivision) lol.rankedLeagueDivision = rank.division
      if (lol.rankedLeagueQueue) lol.rankedLeagueQueue = rank.queue
      data.lol = typeof data.lol === 'string' ? JSON.stringify(lol) : lol
    } catch (e) {}
  }
  return data
}

function isRankedUrl(url) {
  return url.indexOf('/lol-ranked/') >= 0 || url.indexOf('/lol-summoner/v1/current-summoner') >= 0
}

function isOverviewCardUrl(url) {
  return url.indexOf('/lol-honor-v2/v1/profile') >= 0 ||
    url.indexOf('/lol-champion-mastery/') >= 0 ||
    url.indexOf('/lol-trophies/v1/current-summoner/trophies/profile') >= 0 ||
    url.indexOf('/lol-banners/v1/current-summoner/flags') >= 0
}

function interceptOverviewCards(data, url, rank) {
  if (!rank) return data
  if (url.indexOf('/lol-trophies/v1/current-summoner/trophies/profile') >= 0 && rank.trophyTheme !== 'AUTO') {
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {}
    data.theme = rank.trophyTheme
    data.bracket = rank.trophyBracket
    data.tier = rank.trophyTier
    if (data.seasonId === undefined) data.seasonId = 0
  }
  if (data === null || data === undefined) return data
  if (url.indexOf('/lol-honor-v2/v1/profile') >= 0 && rank.honorLevel !== 'AUTO') {
    data.honorLevel = parseInt(rank.honorLevel, 10)
  }
  if (url.indexOf('/lol-champion-mastery/') >= 0) {
    var masteryScore = Math.max(0, parseInt(rank.masteryScore, 10) || 0)
    if (url.indexOf('/champion-mastery-score') >= 0 && rank.masteryScore !== '') return masteryScore
    if (rank.masteryScore !== '' && typeof data === 'object') {
      if (data.score !== undefined) data.score = masteryScore
      if (data.totalScore !== undefined) data.totalScore = masteryScore
    }
    var selectedMasteryLevels = [rank.masteryLevel || 'AUTO', rank.masteryLevel2 || 'AUTO', rank.masteryLevel3 || 'AUTO']
    var masteries = Array.isArray(data) ? data : (data.masteries || data.championMasteries)
    if (Array.isArray(masteries)) {
      for (var m = 0; m < selectedMasteryLevels.length; m++) {
        if (selectedMasteryLevels[m] !== 'AUTO' && masteries[m]) masteries[m].championLevel = Math.max(1, parseInt(selectedMasteryLevels[m], 10) || 1)
      }
    }
    var selectedChampionIds = [rank.masteryChampionId || 'AUTO', rank.masteryChampionId2 || 'AUTO', rank.masteryChampionId3 || 'AUTO']
    var championMasteries = Array.isArray(data) ? data : (data.masteries || data.championMasteries)
    if (Array.isArray(championMasteries)) {
      for (var championIndex = 0; championIndex < selectedChampionIds.length; championIndex++) {
        if (selectedChampionIds[championIndex] !== 'AUTO' && championMasteries[championIndex]) {
          championMasteries[championIndex].championId = parseInt(selectedChampionIds[championIndex], 10)
        }
      }
    }
  }
  if (url.indexOf('/lol-banners/v1/current-summoner/flags/equipped') >= 0 && rank.clashBannerTheme !== 'AUTO') {
    data.theme = rank.clashBannerTheme
    data.level = rank.clashBannerLevel
  }
  return data
}

function shouldForceTrophyResponse(url) {
  return overviewEnabled && overrideRank && overrideRank.trophyTheme !== 'AUTO' &&
    url.indexOf('/lol-trophies/v1/current-summoner/trophies/profile') >= 0
}

function cloneJson(value) {
  if (value === undefined) return value
  return JSON.parse(JSON.stringify(value))
}

function patchOverviewPayload(data, url) {
  if (isOverviewCardUrl(url)) overviewPayloadCache[url] = cloneJson(data)
  if (!overviewEnabled || !overrideRank || !isOverviewCardUrl(url)) return data
  return interceptOverviewCards(cloneJson(data), url, overrideRank)
}

function refreshDataBindings() {
  for (var url in overviewPayloadCache) {
    var event = { uri: url, eventType: 'Update', data: patchOverviewPayload(overviewPayloadCache[url], url) }
    for (var i = 0; i < dataBindingListeners.length; i++) {
      try { dataBindingListeners[i].listener.call(dataBindingListeners[i].context, event) }
      catch (e) {}
    }
  }
}

function installFetchInterceptor() {
  var origFetch = window.fetch
  window.fetch = function() {
    var input = arguments[0]
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '')
    if (!isRankedUrl(url) && !isOverviewCardUrl(url)) return origFetch.apply(this, arguments)
    log('Intercepted fetch: ' + url)
    return origFetch.apply(this, arguments).then(function(res) {
      var cloned = res.clone()
      return cloned.text().then(function(text) {
        var data = null
        try { data = JSON.parse(text) } catch (e) {}
        if (overviewEnabled && overrideRank && isRankedUrl(url)) data = interceptRankedData(data, overrideRank)
        if (overviewEnabled && overrideRank && isOverviewCardUrl(url)) data = interceptOverviewCards(data, url, overrideRank)
        if (data === null) return res
        return new Response(JSON.stringify(data), {
          status: shouldForceTrophyResponse(url) ? 200 : res.status,
          statusText: shouldForceTrophyResponse(url) ? 'OK' : res.statusText,
          headers: res.headers
        })
      })['catch'](function() { return res })
    })
  }
  log('Fetch interceptor installed')
}

function installXHRInterceptor() {
  if (xhrInstalled) return
  xhrInstalled = true
  var proto = XMLHttpRequest.prototype
  var origOpen = proto.open
  var origSend = XMLHttpRequest.prototype.send
  var responseTextDescriptor = Object.getOwnPropertyDescriptor(proto, 'responseText')
  var statusDescriptor = Object.getOwnPropertyDescriptor(proto, 'status')
  proto.open = function(method, url) {
    this._rankUrl = String(url || '')
    return origOpen.apply(this, arguments)
  }

  if (responseTextDescriptor && responseTextDescriptor.get) {
    try {
      Object.defineProperty(proto, 'responseText', {
        configurable: responseTextDescriptor.configurable,
        enumerable: responseTextDescriptor.enumerable,
        get: function() {
          var text = responseTextDescriptor.get.call(this)
          var url = this._rankUrl || ''
          if (this.readyState !== 4 || !isOverviewCardUrl(url)) return text
          try { return JSON.stringify(patchOverviewPayload(text ? JSON.parse(text) : null, url)) }
          catch (e) {
            if (shouldForceTrophyResponse(url)) return JSON.stringify(interceptOverviewCards(null, url, overrideRank))
            return text
          }
        }
      })
    } catch (e) { log('Could not install DataBinding XHR getter') }
  }

  if (statusDescriptor && statusDescriptor.get) {
    try {
      Object.defineProperty(proto, 'status', {
        configurable: statusDescriptor.configurable,
        enumerable: statusDescriptor.enumerable,
        get: function() {
          var status = statusDescriptor.get.call(this)
          return this.readyState === 4 && shouldForceTrophyResponse(this._rankUrl || '') ? 200 : status
        }
      })
    } catch (e) { log('Could not install trophy status override') }
  }

  XMLHttpRequest.prototype.send = function() {
    var self = this
    var url = self._rankUrl || ''
    if (isRankedUrl(url)) {
      log('Intercepted XHR: ' + url)
      self.addEventListener('readystatechange', function() {
        if (self.readyState === 4 && self.status === 200) {
          try {
            if (self.responseType && self.responseType !== 'json' && self.responseType !== 'text') return
            var expectsJson = self.responseType === 'json'
            var data = expectsJson ? self.response : JSON.parse(self.responseText)
            if (overviewEnabled && overrideRank && isRankedUrl(url)) data = interceptRankedData(data, overrideRank)
            var body = JSON.stringify(data)
            if (!expectsJson) Object.defineProperty(self, 'responseText', { value: body, configurable: true })
            Object.defineProperty(self, 'response', { value: expectsJson ? data : body, configurable: true })
          } catch (e) {}
        }
      })
    }
    return origSend.apply(this, arguments)
  }
  log('XHR interceptor installed')
}

function installDataBindingSocketHook(context) {
  var rcp = context && context.rcp ? context.rcp : context
  if (socketHookInstalled || !rcp || typeof rcp.preInit !== 'function') return
  socketHookInstalled = true
  rcp.preInit('rcp-fe-common-libs', function(provider) {
    var riotSocket = provider && provider.getSocket ? provider.getSocket() : null
    if (!riotSocket) return

    if (riotSocket.client && typeof riotSocket.client.on === 'function') {
      var originalOn = riotSocket.client.on
      riotSocket.client.on = function(type, listener) {
        if (type !== 'jsonApiEvent') return originalOn.apply(this, arguments)
        var listenerRecord = { listener: listener, context: this }
        dataBindingListeners.push(listenerRecord)
        return originalOn.call(this, type, function(event) {
          if (!event || !isOverviewCardUrl(event.uri || '')) return listener.apply(this, arguments)
          var patchedEvent = Object.assign({}, event, { data: patchOverviewPayload(event.data, event.uri) })
          return listener.call(this, patchedEvent)
        })
      }
      return
    }

    if (typeof riotSocket.subscribe === 'function') {
      var originalSubscribe = riotSocket.subscribe
      riotSocket.subscribe = function(basePath, listener) {
        dataBindingListeners.push({
          context: this,
          listener: function(event) {
            if (event.uri.indexOf(basePath) === 0) return listener.call(this, event.uri, event.data)
          }
        })
        return originalSubscribe.call(this, basePath, function(uri, data) {
          return listener.call(this, uri, patchOverviewPayload(data, uri))
        })
      }
    }
  })
}

function overrideText(rank) {
  if (!rank) return
  var tier = rank.tier
  var div = rank.division
  var noDiv = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].indexOf(tier) >= 0
  var text = noDiv ? tier : tier + ' ' + div

  var wrappers = document.querySelectorAll('.style-profile-emblem-wrapper')
  for (var i = 0; i < wrappers.length; i++) {
    if (!isTargetWrapper(wrappers[i], rank)) continue
    var sub = wrappers[i].querySelector('.style-profile-emblem-header-subtitle')
    if (sub && sub.innerText !== text) {
      rememberText(sub)
      sub.innerText = text
    }
    var ranked = wrappers[i].querySelector('.style-profile-emblem-subheader-ranked')
    if (ranked && ranked.innerText !== text) {
      rememberText(ranked)
      ranked.innerText = text
    }
  }

  var tooltipQueues = queryAllDeep(document, '.ranked-tooltip-queue')
  for (var q = 0; q < tooltipQueues.length; q++) {
    var queueLabel = tooltipQueues[q].querySelector('.ranked-tooltip-queue-name')
    if (!queueLabel) continue
    var labelText = queueLabel.textContent.toLowerCase()
    var isTargetQueue =
      (rank.queue === 'RANKED_SOLO_5x5' && (labelText.indexOf('solo') >= 0 || labelText.indexOf('duo') >= 0)) ||
      (rank.queue === 'RANKED_FLEX_SR' && labelText.indexOf('flex') >= 0) ||
      (rank.queue === 'RANKED_PREMADE_5x5' && labelText.indexOf('5v5') >= 0 && labelText.indexOf('flex') < 0) ||
      (rank.queue === 'RANKED_TFT' && labelText.indexOf('tft') >= 0 && labelText.indexOf('double') < 0) ||
      (rank.queue === 'RANKED_TFT_DOUBLE_UP' &&
        (labelText.indexOf('double') >= 0 || labelText.indexOf('2v2') >= 0 ||
          (labelText.indexOf('tft') >= 0 && labelText.indexOf('duo') >= 0)))
    if (!isTargetQueue) continue

    var emblem = tooltipQueues[q].querySelector('lol-regalia-emblem-element')
    var emblemDivision = noDiv ? 'O' : div
    if (emblem) {
      rememberAttribute(emblem, 'ranked-tier')
      rememberAttribute(emblem, 'ranked-division')
      emblem.setAttribute('ranked-tier', tier.toLowerCase())
      emblem.setAttribute('ranked-division', emblemDivision)
      if (emblem.shadowRoot) {
        var innerEmblem = emblem.shadowRoot.querySelector('div > div')
        if (innerEmblem) {
          rememberAttribute(innerEmblem, 'ranked-tier')
          rememberAttribute(innerEmblem, 'ranked-division')
          innerEmblem.setAttribute('ranked-tier', tier.toLowerCase())
          innerEmblem.setAttribute('ranked-division', emblemDivision)
        }
      }
    }

    var tooltipTier = tooltipQueues[q].querySelector('.ranked-tooltip-queue-tier')
    if (tooltipTier && tooltipTier.textContent !== text) {
      rememberText(tooltipTier)
      tooltipTier.textContent = text
    }
    var lpContainer = tooltipQueues[q].querySelector('.style-profile-ranked-crest-tooltip-lp')
    var lpSpans = lpContainer ? lpContainer.querySelectorAll('span') : []
    if (lpSpans[1] && lpSpans[1].textContent !== String(rank.leaguePoints)) {
      rememberText(lpSpans[1])
      lpSpans[1].textContent = String(rank.leaguePoints)
    }
  }
}

function setImageSource(element, source) {
  if (!element || !source || element.getAttribute('src') === source) return
  rememberAttribute(element, 'src')
  element.setAttribute('src', source)
}

function getMasteryArtLevel(level) {
  return Math.min(10, Math.max(1, parseInt(level, 10) || 1))
}

function loadChampionSummary() {
  if (championSummaryPromise) return
  championSummaryPromise = fetch('/lol-game-data/assets/v1/champion-summary.json', { credentials: 'include' })
    .then(function(res) { if (!res.ok) throw new Error('Champion catalog unavailable'); return res.json() })
    .then(function(data) {
      championSummary = Array.isArray(data) ? data : []
      applyMasteryChampions(overrideRank)
    })['catch'](function() {
      championSummaryPromise = null
      log('Could not load champion catalog')
    })
}

function findChampion(championId) {
  if (championId === 'AUTO') return null
  for (var i = 0; i < championSummary.length; i++) {
    if (Number(championSummary[i].id) === Number(championId)) return championSummary[i]
  }
  return null
}

function applyMasteryChampions(rank) {
  if (!rank) return
  var selectedIds = [rank.masteryChampionId || 'AUTO', rank.masteryChampionId2 || 'AUTO', rank.masteryChampionId3 || 'AUTO']
  if (selectedIds[0] === 'AUTO' && selectedIds[1] === 'AUTO' && selectedIds[2] === 'AUTO') return
  if (!championSummary) { loadChampionSummary(); return }

  var selected = [findChampion(selectedIds[0]), findChampion(selectedIds[1]), findChampion(selectedIds[2])]
  if (selected[0] && selected[0].squarePortraitPath) {
    var mainPortraits = queryAllDeep(document, '.profile-legendary-champion-mastery-component .style-profile-champion-icon.primary .style-profile-champion-icon-masked > img')
    for (var p = 0; p < mainPortraits.length; p++) setImageSource(mainPortraits[p], selected[0].squarePortraitPath)
  }

  var tooltipSlots = queryAllDeep(document, '.style-profile-legendary-champion-mastery-triple-tooltip > .profile-legendary-champion-mastery-tooltip-component')
  var visualToApiIndex = [1, 0, 2]
  for (var slotIndex = 0; slotIndex < tooltipSlots.length && slotIndex < 3; slotIndex++) {
    var champion = selected[visualToApiIndex[slotIndex]]
    if (!champion) continue
    var portrait = tooltipSlots[slotIndex].querySelector('.style-profile-champion-icon-masked > img')
    var name = tooltipSlots[slotIndex].querySelector('.profile-lcm-tooltip-contents-title')
    setImageSource(portrait, champion.squarePortraitPath)
    if (name && name.textContent !== champion.name) {
      rememberText(name)
      name.textContent = champion.name
    }
  }
}

function applyMasteryLevelToRoot(root, level) {
  if (!root || level === 'AUTO') return
  var rawLevel = Math.max(1, parseInt(level, 10) || 1)
  var artLevel = getMasteryArtLevel(rawLevel)
  var labels = queryAllDeep(root, '.profile-lcm-tooltip-contents-level-text')
  for (var l = 0; l < labels.length; l++) {
    var label = 'Mastery Level ' + rawLevel
    if (labels[l].textContent !== label) {
      rememberText(labels[l])
      labels[l].textContent = label
    }
  }
  var art = queryAllDeep(root, '.mastery-crest-image, .style-profile-accent-image')
  for (var a = 0; a < art.length; a++) {
    rememberAttribute(art[a], 'class')
    rememberAttribute(art[a], 'data-mastery-level')
    var className = (art[a].getAttribute('class') || '').replace(/\blevel-\d+\b/g, '').trim()
    art[a].setAttribute('class', (className + ' level-' + artLevel).trim())
    art[a].setAttribute('data-mastery-level', String(artLevel))
    setImageSource(art[a], '/fe/lol-shared-components/mastery-' + artLevel + '.png')
  }
  var bannerLevel = artLevel <= 4 ? 1 : (artLevel <= 9 ? 2 : 3)
  var banners = queryAllDeep(root, '.style-profile-banner-image')
  for (var b = 0; b < banners.length; b++) setImageSource(banners[b], '/fe/lol-shared-components/mastery-banner-' + bannerLevel + '.svg')
}

function loadClashCatalogs() {
  if (clashCatalogPromise) return
  clashCatalogPromise = Promise.all([
    fetch('/lol-game-data/assets/v1/summoner-trophies.json', { credentials: 'include' }).then(function(res) { if (!res.ok) throw new Error('Trophy catalog unavailable'); return res.json() }),
    fetch('/lol-game-data/assets/v1/summoner-banners.json', { credentials: 'include' }).then(function(res) { if (!res.ok) throw new Error('Banner catalog unavailable'); return res.json() })
  ]).then(function(catalogs) {
    clashCatalogs = { trophy: catalogs[0], banner: catalogs[1] }
    applyClashArt(overrideRank)
  })['catch'](function() {
    clashCatalogPromise = null
    log('Could not load Clash artwork catalogs')
  })
}

function matchesCatalogValue(value, expected) {
  return String(value || '').toLowerCase() === String(expected || '').toLowerCase()
}

function findCatalogEntry(entries, theme, levelOrBracket, key) {
  if (!Array.isArray(entries)) return null
  for (var i = 0; i < entries.length; i++) {
    if (theme && !matchesCatalogValue(entries[i].theme, theme)) continue
    if (levelOrBracket !== undefined && Number(entries[i][key]) !== Number(levelOrBracket)) continue
    return entries[i]
  }
  return null
}

function applyClashArt(rank) {
  if (!rank || (rank.trophyTheme === 'AUTO' && rank.clashBannerTheme === 'AUTO')) return
  if (!clashCatalogs) { loadClashCatalogs(); return }

  if (rank.trophyTheme !== 'AUTO') {
    var trophy = findCatalogEntry(clashCatalogs.trophy.Trophies, rank.trophyTheme, rank.trophyBracket, 'bracket')
    var pedestal = findCatalogEntry(clashCatalogs.trophy.TrophyPedestals, null, rank.trophyTier, 'tier')
    var trophyCups = queryAllDeep(document, '.style-profile-trophy-component .style-profile-trophy-cupgem')
    var trophyPedestals = queryAllDeep(document, '.style-profile-trophy-component .style-profile-trophy-pedestal')
    for (var c = 0; c < trophyCups.length; c++) setImageSource(trophyCups[c], trophy && trophy.profileIcon)
    for (var p = 0; p < trophyPedestals.length; p++) setImageSource(trophyPedestals[p], pedestal && pedestal.profileIcon)
  }

  if (rank.clashBannerTheme !== 'AUTO') {
    var flag = findCatalogEntry(clashCatalogs.banner.BannerFlags, rank.clashBannerTheme, rank.clashBannerLevel, 'level')
    var frame = findCatalogEntry(clashCatalogs.banner.BannerFrames, null, 1, 'level')
    var flags = queryAllDeep(document, '.style-profile-clash-banner-component .style-profile-clash-banner-image')
    var frames = queryAllDeep(document, '.style-profile-clash-banner-component .style-profile-clash-banner-frame')
    for (var f = 0; f < flags.length; f++) setImageSource(flags[f], flag && flag.inventoryIcon)
    for (var r = 0; r < frames.length; r++) setImageSource(frames[r], frame && frame.inventoryIcon)
  }
}

function applyOverviewCards(rank) {
  if (!rank) return

  if (rank.masteryScore !== '') {
    var masteryScores = queryAllDeep(document, '.style-profile-champion-mastery-score')
    for (var i = 0; i < masteryScores.length; i++) {
      if (masteryScores[i].textContent !== String(rank.masteryScore)) {
        rememberText(masteryScores[i])
        masteryScores[i].textContent = String(rank.masteryScore)
      }
    }
  }

  var primaryIcons = queryAllDeep(document, '.profile-legendary-champion-mastery-component .style-profile-champion-icon.primary')
  for (var p = 0; p < primaryIcons.length; p++) {
    var primaryRoot = primaryIcons[p].closest('.style-profile-emblem-content') || primaryIcons[p].parentElement
    applyMasteryLevelToRoot(primaryRoot, rank.masteryLevel || 'AUTO')
  }
  var tooltipSlots = queryAllDeep(document, '.style-profile-legendary-champion-mastery-triple-tooltip > .profile-legendary-champion-mastery-tooltip-component')
  var visualLevels = [rank.masteryLevel2 || 'AUTO', rank.masteryLevel || 'AUTO', rank.masteryLevel3 || 'AUTO']
  for (var s = 0; s < tooltipSlots.length && s < visualLevels.length; s++) applyMasteryLevelToRoot(tooltipSlots[s], visualLevels[s])

  if (rank.honorLevel !== 'AUTO') {
    var honorLabels = queryAllDeep(document, '.style-profile-honor-component .style-profile-emblem-header-subtitle')
    for (var h = 0; h < honorLabels.length; h++) {
      var honorLabel = 'Honor Level ' + rank.honorLevel
      if (honorLabels[h].textContent !== honorLabel) {
        rememberText(honorLabels[h])
        honorLabels[h].textContent = honorLabel
      }
    }
    var honorV3 = queryAllDeep(document, '.style-profile-honor-component .style-profile-honor-icon-v3')
    var honorLegacy = queryAllDeep(document, '.style-profile-honor-component .style-profile-honor-icon:not(.style-profile-honor-icon-v3)')
    var honorAsset = '/fe/lol-static-assets/images/honor/profile/Emblem_Level_' + rank.honorLevel + '.png'
    var legacyAsset = '/fe/lol-static-assets/images/honor/profile/Emblem_' + rank.honorLevel + (Number(rank.honorLevel) >= 2 && Number(rank.honorLevel) <= 4 ? '-0' : '') + '.png'
    for (var v = 0; v < honorV3.length; v++) setImageSource(honorV3[v], honorAsset)
    for (var o = 0; o < honorLegacy.length; o++) setImageSource(honorLegacy[o], legacyAsset)
  }

  applyMasteryChampions(rank)

  applyClashArt(rank)
}

function patchEmblemAttributes(rank) {
  if (!rank) return
  var tierLower = rank.tier.toLowerCase()

  var wrappers = document.querySelectorAll('.style-profile-emblem-wrapper')
  for (var i = 0; i < wrappers.length; i++) {
    if (!isTargetWrapper(wrappers[i], rank)) continue

    var crests = wrappers[i].querySelectorAll('lol-regalia-crest-v2-element')
    for (var c = 0; c < crests.length; c++) {
      var crest = crests[c]
      rememberAttribute(crest, 'ranked-tier')
      rememberAttribute(crest, 'ranked-division')
      rememberAttribute(crest, 'crest-type')
      crest.setAttribute('ranked-tier', tierLower)
      crest.setAttribute('ranked-division', rank.division)
      crest.setAttribute('crest-type', 'ranked')
      if (crest.shadowRoot) {
        var divEl = crest.shadowRoot.querySelector('.lol-regalia-rank-division-text')
        if (divEl && divEl.textContent !== rank.division) {
          rememberText(divEl)
          divEl.textContent = rank.division
        }
      }
    }

    var emblems = wrappers[i].querySelectorAll('lol-regalia-emblem-element')
    for (var e = 0; e < emblems.length; e++) {
        rememberAttribute(emblems[e], 'ranked-tier')
        rememberAttribute(emblems[e], 'queue-type')
        emblems[e].setAttribute('ranked-tier', rank.tier)
        emblems[e].setAttribute('queue-type', rank.queue)
    }
  }
}

function applyRank(rank) {
  if (!overviewEnabled || !rank) {
    restoreOverrides()
    clearRankBorderStyles()
    clearRankBannerStyles()
    removeCSS()
    applyCustomBackground()
    return
  }

  var lastSeasonText = rank.lastSeasonTier.charAt(0) + rank.lastSeasonTier.slice(1).toLowerCase()
  var lastSeasonSections = queryAllDeep(document, '.ranked-tooltip-last-season')
  for (var s = 0; s < lastSeasonSections.length; s++) {
    var lastEmblem = lastSeasonSections[s].querySelector('lol-regalia-emblem-element')
    if (lastEmblem) {
      rememberAttribute(lastEmblem, 'ranked-tier')
      rememberAttribute(lastEmblem, 'ranked-division')
      lastEmblem.setAttribute('ranked-tier', rank.lastSeasonTier.toLowerCase())
      lastEmblem.setAttribute('ranked-division', 'I')
      if (lastEmblem.shadowRoot) {
        var lastInnerEmblem = lastEmblem.shadowRoot.querySelector('div > div')
        if (lastInnerEmblem) {
          rememberAttribute(lastInnerEmblem, 'ranked-tier')
          rememberAttribute(lastInnerEmblem, 'ranked-division')
          lastInnerEmblem.setAttribute('ranked-tier', rank.lastSeasonTier.toLowerCase())
          lastInnerEmblem.setAttribute('ranked-division', 'I')
        }
      }
    }
    var lastTier = lastSeasonSections[s].querySelector('.ranked-tooltip-queue-tier')
    if (lastTier && lastTier.textContent !== lastSeasonText) {
      rememberText(lastTier)
      lastTier.textContent = lastSeasonText
    }
  }
  injectCSS()
  overrideText(rank)
  patchEmblemAttributes(rank)
  applyRankBorder(rank)
  applyRankBanner(rank)
  applyOverviewCards(rank)
  applyCustomBackground()
}

function startPolling() {
  setTimeout(function() { applyRank(overrideRank) }, 2000)
  setTimeout(function() { applyRank(overrideRank) }, 5000)
  setInterval(function() {
    Promise.all([fetchDesiredRank(), fetchOverviewSetting(), fetchCustomBackground()]).then(function(values) {
      var newRank = values[0]
      var newOverviewEnabled = values[1]
      var newCustomBackground = values[2]
      if (newRank !== null || overrideRank !== null) {
        if (!newRank || !overrideRank ||
            newRank.tier !== overrideRank.tier || newRank.division !== overrideRank.division ||
            newRank.queue !== overrideRank.queue || newRank.leaguePoints !== overrideRank.leaguePoints ||
            newRank.lastSeasonTier !== overrideRank.lastSeasonTier || newRank.borderTier !== overrideRank.borderTier ||
            newRank.bannerTier !== overrideRank.bannerTier || newRank.honorLevel !== overrideRank.honorLevel ||
            newRank.masteryScore !== overrideRank.masteryScore || newRank.masteryLevel !== overrideRank.masteryLevel ||
            newRank.masteryLevel2 !== overrideRank.masteryLevel2 || newRank.masteryLevel3 !== overrideRank.masteryLevel3 ||
            newRank.masteryChampionId !== overrideRank.masteryChampionId ||
            newRank.masteryChampionId2 !== overrideRank.masteryChampionId2 ||
            newRank.masteryChampionId3 !== overrideRank.masteryChampionId3 ||
            newRank.trophyTheme !== overrideRank.trophyTheme || newRank.trophyBracket !== overrideRank.trophyBracket ||
            newRank.trophyTier !== overrideRank.trophyTier || newRank.clashBannerTheme !== overrideRank.clashBannerTheme ||
            newRank.clashBannerLevel !== overrideRank.clashBannerLevel) {
          log('Rank changed -> reapplying')
          restoreOverrides()
          overrideRank = newRank
          refreshDataBindings()
        }
      }
      var overviewSettingChanged = overviewEnabled !== newOverviewEnabled
      overviewEnabled = newOverviewEnabled
      if (overviewSettingChanged) refreshDataBindings()
      if (JSON.stringify(customBackground) !== JSON.stringify(newCustomBackground)) {
        setCustomBackground(newCustomBackground)
        log('Custom profile background ' + (customBackground ? 'updated' : 'cleared'))
      }
      applyRank(overrideRank)
    })
  }, 5000)
  log('Polling started')
}

function startPlugin() {
  if (pluginStarted) return
  pluginStarted = true
  Promise.all([fetchDesiredRank(), fetchOverviewSetting(), fetchCustomBackground()]).then(function(values) {
    var rank = values[0]
    overviewEnabled = values[1]
    customBackground = values[2]
    overrideRank = rank
    if (rank) log('Rank: ' + rank.tier + ' ' + rank.division + ' (' + rank.queue + ')')
    else log('No rank found; waiting for config changes')
    log('Profile Overview override: ' + (overviewEnabled ? 'enabled' : 'disabled'))

    installFetchInterceptor()
    function attachObserver() {
      if (!document.body) { setTimeout(attachObserver, 500); return }
      injectCSS()
      observer = new MutationObserver(function() { applyRank(overrideRank) })
      observer.observe(document.body, { childList: true, subtree: true })
      document.addEventListener('mouseover', function() {
        if (hoverApplyTimer) clearTimeout(hoverApplyTimer)
        hoverApplyTimer = setTimeout(function() { applyRank(overrideRank) }, 150)
      }, true)
      log('Observer attached')
      startPolling()
    }
    attachObserver()
  })
}

export function init(context) {
  log('Plugin starting')
  installXHRInterceptor()
  installDataBindingSocketHook(context)
  startPlugin()
}

export default function(context) {
  init(context)
}

export { getMasteryArtLevel, interceptOverviewCards, setCustomBackground }

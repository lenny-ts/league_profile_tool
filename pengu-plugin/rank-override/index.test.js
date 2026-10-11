import { describe, expect, it } from 'vitest'
import { getMasteryArtLevel, interceptOverviewCards, setCustomBackground } from './index.js'

describe('rank override mastery payload', function() {
  it('overrides the primary champion and keeps mastery levels above 10', function() {
    var payload = {
      score: 100,
      masteries: [
        { championId: 103, championLevel: 7 },
        { championId: 86, championLevel: 5 },
        { championId: 22, championLevel: 4 },
      ],
    }
    var rank = {
      masteryScore: '13579',
      masteryLevel: '37',
      masteryLevel2: '8',
      masteryLevel3: '15',
      masteryChampionId: '266',
      masteryChampionId2: '22',
      masteryChampionId3: '99',
      trophyTheme: 'AUTO',
      clashBannerTheme: 'AUTO',
      honorLevel: 'AUTO',
    }

    var result = interceptOverviewCards(payload, '/lol-champion-mastery/v1/player/champion-mastery-view/top?count=3', rank)

    expect(result.score).toBe(13579)
    expect(result.masteries[0]).toEqual({ championId: 266, championLevel: 37 })
    expect(result.masteries[1]).toEqual({ championId: 22, championLevel: 8 })
    expect(result.masteries[2]).toEqual({ championId: 99, championLevel: 15 })
  })

  it('uses the selected hover crest up to Riot maximum artwork level', function() {
    expect(getMasteryArtLevel(2)).toBe(2)
    expect(getMasteryArtLevel(37)).toBe(10)
  })
})

describe('rank override custom background', function() {
  it('applies an animated asset and restores the native background', function() {
    document.body.innerHTML = '<div class="style-profile-skin-background-component"><img src="native.jpg" style="width: 45%; height: auto"><video style="opacity: 1"></video></div>'
    var image = document.querySelector('img')
    var video = document.querySelector('video')
    var container = document.querySelector('.style-profile-skin-background-component')

    setCustomBackground({ asset: 'assets/custom-background.gif', fit: 'cover', position: 'top', dim: 25, version: '123' })

    expect(image.getAttribute('src')).toBe('//plugins/rank-override/assets/custom-background.gif?v=123')
    expect(image.style.objectFit).toBe('cover')
    expect(image.style.objectPosition).toBe('top')
    expect(image.style.width).toBe('100%')
    expect(image.style.height).toBe('100%')
    expect(image.style.maxWidth).toBe('none')
    expect(image.style.imageRendering).toBe('auto')
    expect(image.style.filter).toBe('brightness(0.75)')
    expect(container.style.backgroundImage).toBe('')
    expect(video.style.opacity).toBe('0')

    setCustomBackground(null)
    expect(image.getAttribute('src')).toBe('native.jpg')
    expect(image.style.width).toBe('45%')
    expect(image.style.height).toBe('auto')
    expect(image.style.filter).toBe('')
    expect(video.style.opacity).toBe('1')
  })

  it('uses a container background only when no image surface exists', function() {
    document.body.innerHTML = '<div class="style-profile-skin-background-component"></div>'
    var container = document.querySelector('.style-profile-skin-background-component')

    setCustomBackground({ asset: 'assets/custom-background.gif', fit: 'contain', position: 'center', dim: 0, version: '456' })

    expect(container.style.backgroundImage).toContain('assets/custom-background.gif?v=456')
    expect(container.style.backgroundSize).toBe('contain')

    setCustomBackground(null)
    expect(container.style.backgroundImage).toBe('')
  })
})

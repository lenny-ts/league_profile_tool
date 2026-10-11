import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const clips = [...html.matchAll(/<source src="(media\/[a-z]+\.mp4)"/g)].map(match => match[1]);
if (clips.length !== 11 || new Set(clips).size !== clips.length) throw new Error('Expected eleven unique showcase videos');
for (const clip of clips) {
  for (const asset of [clip, clip.replace('.mp4', '.jpg')]) {
    if (!existsSync(new URL(`../docs/${asset}`, import.meta.url))) throw new Error(`Missing ${asset}`);
  }
}
if (html.includes('Replace with GIF') || html.includes('play-overlay')) throw new Error('Stale video placeholder');
// GitHub Pages publishes only docs/, so the site must not depend on files outside it.
for (const [, asset] of html.matchAll(/(?:src|poster)="([^"]+)"/g)) {
  if (/^(https?:)?\/\//.test(asset) || asset.startsWith('#') || asset.startsWith('data:')) continue;
  if (asset.startsWith('../')) throw new Error(`Reference escapes docs/: ${asset}`);
  if (!existsSync(new URL(`../docs/${asset}`, import.meta.url))) throw new Error(`Missing ${asset}`);
}
if (['showcase-pengu"', 'showcase-status"', 'showcase-music-bio"'].some(section => html.includes(section))) {
  throw new Error('A removed showcase section is still present');
}
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
for (const [section, image] of Object.entries({ presets: 'presets.png', logs: 'logs.png', settings: 'settings.png' })) {
  const actual = window.document.querySelector(`.showcase-${section} .show-screenshot`)?.getAttribute('src');
  if (actual !== `media/${image}` || !existsSync(new URL(`../docs/media/${image}`, import.meta.url))) {
    throw new Error(`Missing ${section} screenshot`);
  }
}
const videos = [...window.document.querySelectorAll('video')];
if (videos.length !== 11 || videos.some(video => !video.hasAttribute('muted') || !video.loop || !video.controls || video.preload !== 'none')) {
  throw new Error('Videos must be muted loops with controls and lazy loading');
}
let plays = 0;
let pauses = 0;
window.HTMLMediaElement.prototype.play = function() { plays++; this.dispatchEvent(new window.Event('play')); return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function() { pauses++; this.dispatchEvent(new window.Event('pause')); };
window.matchMedia = () => ({ matches: false });
const observers = [];
window.IntersectionObserver = class {
  constructor(callback) { this.callback = callback; observers.push(this); }
  observe() {}
  unobserve() {}
};
window.eval(readFileSync(new URL('../docs/script.js', import.meta.url), 'utf8'));
const buttons = [...window.document.querySelectorAll('.video-play-button')];
if (buttons.length !== 11) throw new Error('Each video needs a visible Play button');
observers[0].callback([{ target: videos[0], isIntersecting: true }]);
if (plays !== 0) throw new Error('A video started without a click');
buttons[0].click();
if (plays !== 1 || !buttons[0].hidden) throw new Error('The Play button did not start the demo');
observers[0].callback([{ target: videos[0], isIntersecting: false }]);
if (pauses !== 1 || buttons[0].hidden) throw new Error('Off-screen video did not pause');
dom.window.close();
const quiet = new JSDOM(html, { runScripts: 'outside-only' });
quiet.window.matchMedia = () => ({ matches: true });
quiet.window.IntersectionObserver = class { observe() {} };
let quietPlays = 0;
quiet.window.HTMLMediaElement.prototype.play = () => { quietPlays++; return Promise.resolve(); };
quiet.window.eval(readFileSync(new URL('../docs/script.js', import.meta.url), 'utf8'));
if (quietPlays !== 0) throw new Error('Reduced motion triggered autoplay');
quiet.window.document.querySelector('.video-play-button').click();
if (quietPlays !== 1) throw new Error('Reduced-motion visitors cannot start the video');
quiet.window.close();
console.log('Eleven videos and three screenshots are linked; videos start on click/tap and pause off-screen.');

export interface LibraryTheme { id: string; name: string; css: string }

const ART_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/';

function championTheme(id: string, name: string, description: string, artPath: string, colors: [string, string, string, string], secondary: string, position: string) {
    const [background, panel, accent, text] = colors;
    const image = ART_BASE + artPath;
    const css = `/* ${name} — LPT. Splash artwork © Riot Games, served by CommunityDragon.
Requires network access for artwork. Profile Overview background is intentionally excluded. */
:root {
  --lpt-wallpaper: url("${image}");
  --lpt-theme-ink: ${background};
  --lpt-theme-accent: ${accent};
}
/* The wallpaper sits behind themed modules. Profile/Overview is intentionally absent. */
html, body, .league-client, #rcp-fe-viewport-root, .rcp-fe-viewport-main {
  background-color: ${background} !important;
  background-image: linear-gradient(90deg, ${background}e8 0%, ${background}99 32%, ${background}18 70%, ${background}66 100%), var(--lpt-wallpaper, none) !important;
  background-size: cover !important;
  background-position: ${position} !important;
  background-repeat: no-repeat !important;
  color: ${text} !important;
}
/* Remove page-owned backdrops so the shared wallpaper remains visible. */
.rcp-fe-lol-home, .rcp-fe-lol-home-main,
.rcp-fe-lol-activity-center, .activity-center-application,
.rcp-fe-lol-collections, .collections-application,
.rcp-fe-lol-event-hub, .rcp-fe-lol-event-hub-application,
.rcp-fe-lol-loot, .loot-backdrop,
.rcp-fe-lol-parties, .parties-background,
.rcp-fe-lol-clash, .rcp-fe-lol-postgame,
.rcp-fe-lol-store, .rcp-fe-lol-tft-rotational-shop {
  background-color: transparent !important;
  background-image: none !important;
}
/* Requested full-page surfaces get their own copy of the wallpaper. This also
   works when a module lives in a separate open Shadow DOM. Profile Overview
   does not use any selector in this list. */
.rcp-fe-lol-home, .rcp-fe-lol-home-main, #rcp-fe-lol-home-main,
.clash-hub, .clash-root-component, .rcp-fe-lol-clash-full,
.loot-backdrop, .loot-contents,
.__rcp-fe-lol-store, .store-backdrop, .personalized-offers-root, .yourshop-root,
.challenges-collection-component {
  background-color: ${background} !important;
  background-image: linear-gradient(90deg, ${background}e8 0%, ${background}99 35%, ${background}22 72%, ${background}77 100%), var(--lpt-wallpaper, none) !important;
  background-size: cover !important;
  background-position: ${position} !important;
  background-repeat: no-repeat !important;
}
.rcp-fe-lol-home .lol-uikit-background-switcher-image,
.rcp-fe-lol-activity-center .lol-uikit-background-switcher-image,
.rcp-fe-lol-collections .lol-uikit-background-switcher-image,
.rcp-fe-lol-event-hub .lol-uikit-background-switcher-image,
.rcp-fe-lol-loot .lol-uikit-background-switcher-image,
.rcp-fe-lol-parties .lol-uikit-background-switcher-image,
.rcp-fe-lol-clash .lol-uikit-background-switcher-image,
.rcp-fe-lol-postgame .lol-uikit-background-switcher-image,
.parties-background > .lol-uikit-background-switcher-image,
.loot-backdrop.background-static, .moon-skin-backdrop, .mythic-shop-backdrop,
.shoppefront-background, .event-shop-progression,
.ranked-intro-background, .smoke-background-container,
.clash-tab-team-background, .clash-tab-bracket-background, .tournament-scouting,
.clash-missed-lockin-modal, .clash-root-background-landing, .clash-root-background,
.clash-arurf-intro-modal, .postgame-champion-background,
.postgame-background-image, .vote-ceremony-v3-background,
#background-ambient, .loot-loading-screen,
.loot-milestones-tracker-wrapper,
.loot-backdrop .lol-uikit-video-content,
.challenges-collection-component > .background,
.personalized-offers-root > .background,
.yourshop-root > .background,
.store-backdrop > .background {
  display: none !important;
  background: none !important;
}
.activity-center-application, #activity-center, #activity-center .activity-center__template,
.postgame-champion-background-wrapper, .postgame-champion-background-mask,
.v2-parties-invite-info-panel, .parties-invite-info-panel,
.shoppefront-categories-sidebar, .event-shop-category-nav-bar {
  background: transparent !important;
  background-image: none !important;
}
/* Keep page content readable after removing the original artwork. */
.clash-tab-team-content, .clash-tab-hub-content, .clash-roster-details,
.loot-inventory, .loot-tray, .loot-recipe-help-container,
.__rcp-fe-lol-store .navbar, .item-page-items-container-wrapper,
.personalized-offers-content-wrapper,
.challenges-collection-component .challenge-card,
.challenges-collection-component .challenge-group,
.challenges-collection-component .challenges-collection-content {
  background-color: ${panel}d9 !important;
  border-color: ${accent}33 !important;
  box-shadow: 0 10px 30px ${background}66 !important;
  backdrop-filter: blur(12px);
}
/* Page-specific masks and overlays otherwise darken the wallpaper twice. */
.parties-background-mask, .lobby-header-overlay,
.clash-root-action-timeline-background-gradient,
.loot-backdrop::before, .loot-backdrop::after,
.store-backdrop::before, .store-backdrop::after,
.challenges-collection-component > .background::before,
.challenges-collection-component > .background::after {
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}
.lol-social-roster, .lol-social-sidebar, .rcp-fe-lol-navigation, .some-client-panel {
  background: linear-gradient(145deg, ${panel}ed, ${background}d9) !important;
  color: ${text} !important;
  border-color: ${accent}44 !important;
  box-shadow: 0 14px 40px ${background}88, inset 0 1px ${accent}33 !important;
  backdrop-filter: blur(14px);
}
.some-client-panel { border: 1px solid ${accent}55; border-radius: ${id === 'starguardian' ? '20px' : '4px'}; padding: 28px; }
.navigation-tab, .lol-social-roster-group-header { color: ${text} !important; letter-spacing: .09em; }
.navigation-tab { transition: color .25s, text-shadow .25s; }
.navigation-tab:hover, .navigation-tab.active {
  color: ${accent} !important;
  text-shadow: 0 0 18px ${accent}99;
}
.navigation-tab.active { border-bottom: 2px solid ${accent}; animation: lpt-${id}-glow 4s ease-in-out infinite; }
.lol-social-roster-group-header { border-bottom: 1px solid ${secondary}44 !important; }
input[type="text"], input[type="search"], textarea {
  background: ${background}cc !important; color: ${text} !important;
  border-color: ${accent}66 !important; border-radius: 8px;
}
:focus-visible { outline: 2px solid ${accent} !important; outline-offset: 3px; }
::-webkit-scrollbar { width: 7px; }
::-webkit-scrollbar-thumb { background: linear-gradient(${accent}, ${secondary}) !important; border-radius: 8px; }
::selection { background: ${accent}; color: ${background}; }
/* Non-interactive motes: small lights rather than a full-screen color filter. */
.rcp-fe-lol-home::after, .rcp-fe-lol-activity-center::after,
.rcp-fe-lol-collections::after, .rcp-fe-lol-event-hub::after,
.rcp-fe-lol-loot::after, .rcp-fe-lol-parties::after,
.rcp-fe-lol-clash::after, .rcp-fe-lol-postgame::after {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 1;
  background-image: radial-gradient(circle at 78% 22%, ${accent}bb 0 1px, transparent 3px),
    radial-gradient(circle at 64% 68%, ${secondary}aa 0 2px, transparent 4px),
    radial-gradient(circle at 90% 48%, ${accent}aa 0 1px, transparent 3px),
    radial-gradient(circle at 48% 35%, ${secondary}88 0 1px, transparent 3px);
  animation: lpt-${id}-motes 12s ease-in-out infinite alternate;
}
@keyframes lpt-${id}-motes { from { opacity: .25; transform: translateY(0); } to { opacity: .85; transform: translateY(-14px); } }
@keyframes lpt-${id}-glow {
  0%,100% { text-shadow: 0 0 8px ${accent}55; }
  50% { text-shadow: 0 0 20px ${accent}cc, 0 0 35px ${secondary}88; }
}
@media (prefers-reduced-motion: reduce) {
  .rcp-fe-lol-home::after, .rcp-fe-lol-activity-center::after,
  .rcp-fe-lol-collections::after, .rcp-fe-lol-event-hub::after,
  .rcp-fe-lol-loot::after, .rcp-fe-lol-parties::after,
  .rcp-fe-lol-clash::after, .rcp-fe-lol-postgame::after,
  .navigation-tab { animation: none !important; transition: none !important; }
}
`;
    return { id, name, description, image, colors, css };
}

export const BUILTIN_THEMES = [
    championTheme('arcane', 'Arcane — Fractured', 'Arcane Fractured Jinx. Electric cyan, graffiti pink and dark glass, with drifting shimmer.', 'jinx/skins/skin60/images/jinx_splash_uncentered_60.jpg', ['#080c1b', '#152038', '#65e5ff', '#edf8ff'], '#f768c6', '65% center'),
    championTheme('starguardian', 'Star Guardian — Ahri', 'Ahri, starlight and magical-girl energy. Pearl pink, lilac glass and sparkling accents.', 'ahri/skins/skin14/images/ahri_splash_uncentered_14.jpg', ['#181328', '#38233f', '#ffb9df', '#fff1fc'], '#b7a1ff', '65% center'),
];

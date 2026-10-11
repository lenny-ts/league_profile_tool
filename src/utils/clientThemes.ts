export interface LibraryTheme { id: string; name: string; css: string }

const ART_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/';
const SPLASH_BASE = 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/';

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
html, body, .league-client, #rcp-fe-viewport-root {
  background-color: ${background} !important;
  background-image: none !important;
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
.lol-social-sidebar, .lol-social-roster, .some-client-panel {
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
.lol-social-sidebar { background: linear-gradient(180deg, ${panel}f2, ${background}e8) !important; border-left: 1px solid ${accent}55 !important; }
.lol-social-sidebar .identity, .lol-social-sidebar .identity-container, .lol-social-sidebar .identity-icon,
.lol-social-sidebar .lower-details, .lol-social-sidebar .summoner-level, .lol-social-sidebar .notifications-button {
  background-color: transparent !important; color: ${text} !important;
}
.lol-social-sidebar .identity-icon { border: 1px solid ${accent}88; box-shadow: 0 0 0 3px ${accent}18 !important; }
.lol-social-sidebar .lower-details { border-top: 1px solid ${secondary}44; }
.lol-social-roster { border-left: 1px solid ${accent}55 !important; border-radius: 10px 0 0 10px; }
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

void championTheme;

function surfaceTheme(id: string, name: string, description: string, colors: [string, string, string, string], secondary: string, font: string) {
    const [background, panel, accent, text] = colors;
    const controlRadius = id === 'rosewater' ? '999px' : '5px';
    const headingFont = id === 'rosewater' ? 'Georgia, serif' : '"Segoe UI", sans-serif';
    const signature = id === 'rosewater'
        ? `.rcp-fe-lol-home, .rcp-fe-lol-collections, .rcp-fe-lol-event-hub, .rcp-fe-lol-loot, .rcp-fe-lol-clash, .rcp-fe-lol-store { background-image: radial-gradient(ellipse at 82% 8%, ${accent}25 0%, transparent 32%), linear-gradient(135deg, ${background}d9, ${background}44), var(--lpt-wallpaper) !important; }
.rcp-fe-lol-home .some-client-panel, .rcp-fe-lol-collections [class*="card"], .rcp-fe-lol-event-hub [class*="card"], .rcp-fe-lol-loot [class*="card"], .rcp-fe-lol-store [class*="card"] { border-radius: 18px !important; border-color: ${accent}66 !important; box-shadow: 0 12px 36px ${background}cc, 0 0 0 1px ${accent}14 !important; }
.rcp-fe-lol-home button, .rcp-fe-lol-collections button, .rcp-fe-lol-event-hub button, .rcp-fe-lol-loot button, .rcp-fe-lol-store button { border-radius: 999px !important; }
.rcp-fe-lol-home h1, .rcp-fe-lol-home h2, .rcp-fe-lol-home h3, .rcp-fe-lol-collections h1, .rcp-fe-lol-collections h2, .rcp-fe-lol-event-hub h1, .rcp-fe-lol-event-hub h2 { letter-spacing: .015em; text-shadow: 0 2px 18px ${accent}44; }`
        : `.rcp-fe-lol-home, .rcp-fe-lol-collections, .rcp-fe-lol-event-hub, .rcp-fe-lol-loot, .rcp-fe-lol-clash, .rcp-fe-lol-store { background-image: repeating-linear-gradient(135deg, ${accent}08 0 1px, transparent 1px 72px), linear-gradient(110deg, ${background}df, ${background}40), var(--lpt-wallpaper) !important; }
.rcp-fe-lol-home .some-client-panel, .rcp-fe-lol-collections [class*="card"], .rcp-fe-lol-event-hub [class*="card"], .rcp-fe-lol-loot [class*="card"], .rcp-fe-lol-store [class*="card"] { border-radius: 5px !important; border-color: ${accent}66 !important; box-shadow: 8px 8px 0 ${background}99, inset 3px 0 ${accent}55 !important; }
.rcp-fe-lol-home button, .rcp-fe-lol-collections button, .rcp-fe-lol-event-hub button, .rcp-fe-lol-loot button, .rcp-fe-lol-store button { border-radius: 5px !important; text-transform: uppercase; letter-spacing: .08em; }
.rcp-fe-lol-home h1, .rcp-fe-lol-home h2, .rcp-fe-lol-home h3, .rcp-fe-lol-collections h1, .rcp-fe-lol-collections h2, .rcp-fe-lol-event-hub h1, .rcp-fe-lol-event-hub h2 { letter-spacing: .12em; text-transform: uppercase; }`;
    const image = SPLASH_BASE + (id === 'rosewater' ? 'Seraphine_0.jpg' : 'Kindred_0.jpg');
    const css = `/* ${name} — LPT. A focused surface theme inspired by the best Pengu community themes. */
:root { --lpt-wallpaper: url("${image}"); --lpt-theme-ink: ${background}; --lpt-theme-accent: ${accent}; }
html, body, .league-client, #rcp-fe-viewport-root {
  background: ${background} !important;
  background-image: none !important;
  background-size: cover !important; background-position: center !important; color: ${text} !important;
  font-family: ${font}, "Segoe UI", sans-serif !important;
}
.rcp-fe-lol-home, .rcp-fe-lol-home-main, .rcp-fe-lol-activity-center, .activity-center-application,
.rcp-fe-lol-collections, .collections-application, .rcp-fe-lol-event-hub, .rcp-fe-lol-event-hub-application,
.rcp-fe-lol-loot, .loot-backdrop, .rcp-fe-lol-parties, .parties-background, .rcp-fe-lol-clash,
.rcp-fe-lol-postgame, .rcp-fe-lol-store, .rcp-fe-lol-tft-rotational-shop {
  background-color: transparent !important; background-image: none !important;
}
.rcp-fe-lol-home, .rcp-fe-lol-home-main, #rcp-fe-lol-home-main, .clash-hub, .clash-root-component,
.rcp-fe-lol-clash-full, .loot-backdrop, .loot-contents, .__rcp-fe-lol-store, .store-backdrop,
.personalized-offers-root, .yourshop-root, .challenges-collection-component {
  background: linear-gradient(110deg, ${background}df, ${background}40), var(--lpt-wallpaper) center/cover !important;
}
.rcp-fe-lol-home, .rcp-fe-lol-home-main, #rcp-fe-lol-home-main, .rcp-fe-lol-collections, .collections-application, .rcp-fe-lol-loot, .loot-backdrop, .__rcp-fe-lol-store, .store-backdrop, .rcp-fe-lol-clash, .clash-hub, .clash-root-component { background-image: linear-gradient(110deg, ${background}df, ${background}40), var(--lpt-wallpaper) !important; }
.rcp-fe-lol-home, .rcp-fe-lol-home-main, .rcp-fe-lol-collections, .rcp-fe-lol-event-hub, .rcp-fe-lol-loot, .rcp-fe-lol-clash, .rcp-fe-lol-store { background-size: 112% auto !important; animation: lpt-${id}-wallpaper-drift 24s ease-in-out infinite alternate; }
@keyframes lpt-${id}-wallpaper-drift { from { background-position: 46% 50%; } to { background-position: 54% 50%; } }
#background-ambient, .challenges-collection-component > .background { display: none !important; background: none !important; }
.lol-social-sidebar, .lol-social-roster, .some-client-panel,
.clash-tab-team-content, .clash-tab-hub-content, .clash-roster-details, .loot-inventory, .loot-tray,
.loot-recipe-help-container, .__rcp-fe-lol-store .navbar, .item-page-items-container-wrapper,
.personalized-offers-content-wrapper, .challenges-collection-component .challenge-card,
.challenges-collection-component .challenge-group, .challenges-collection-component .challenges-collection-content {
  background: linear-gradient(145deg, ${panel}f2, ${background}e6) !important;
  color: ${text} !important; border: 1px solid ${accent}38 !important;
  box-shadow: 0 18px 44px ${background}b8, inset 0 1px ${accent}22 !important;
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
}
.some-client-panel { border-radius: ${id === 'rosewater' ? '18px' : '10px'}; padding: 28px; }
.navigation-tab, .lol-social-roster-group-header { color: ${text} !important; letter-spacing: .1em; }
.navigation-root-component, .lol-social-actions-bar { border-color: ${accent}28 !important; }
.rcp-fe-lol-home h1, .rcp-fe-lol-home h2, .rcp-fe-lol-home h3,
.rcp-fe-lol-collections h1, .rcp-fe-lol-collections h2,
.rcp-fe-lol-loot h1, .rcp-fe-lol-clash h1, .rcp-fe-lol-store h1 {
  font-family: ${headingFont} !important; color: ${text} !important;
}
.navigation-tab { transition: color .2s ease, border-color .2s ease, transform .2s ease; }
.navigation-tab:hover, .navigation-tab.active { color: ${accent} !important; text-shadow: 0 0 16px ${accent}66; }
.navigation-tab.active { border-bottom: 2px solid ${accent}; }
.lol-social-roster-group-header { border-bottom: 1px solid ${secondary}55 !important; }
.lol-social-roster-group-header { background: linear-gradient(90deg, ${accent}1f, transparent) !important; }
.lol-social-roster [class*="friend"]:hover, .lol-social-roster [class*="item"]:hover { border-left: 2px solid ${accent} !important; }
.lol-social-sidebar { background: linear-gradient(180deg, ${panel}f2, ${background}e8) !important; border-left: 1px solid ${accent}55 !important; }
.lol-social-sidebar .identity, .lol-social-sidebar .identity-container, .lol-social-sidebar .identity-icon,
.lol-social-sidebar .lower-details, .lol-social-sidebar .summoner-level, .lol-social-sidebar .notifications-button {
  background-color: transparent !important; color: ${text} !important;
}
.lol-social-sidebar .identity-icon { border: 1px solid ${accent}88; box-shadow: 0 0 0 3px ${accent}18 !important; }
.lol-social-sidebar .lower-details { border-top: 1px solid ${secondary}44; }
.lol-social-roster [class*="friend"], .lol-social-roster [class*="item"], .lol-social-roster [class*="group"] { transition: background-color .22s ease, transform .22s ease, border-color .22s ease; }
.lol-social-roster [class*="friend"]:hover, .lol-social-roster [class*="item"]:hover { background: ${accent}14 !important; transform: translateX(${id === 'rosewater' ? '3px' : '2px'}); }
.lol-social-sidebar .identity-icon { animation: lpt-${id}-halo 5s ease-in-out infinite; }
@keyframes lpt-${id}-halo { 0%,100% { filter: drop-shadow(0 0 0 ${accent}00); } 50% { filter: drop-shadow(0 0 9px ${accent}66); } }
.lol-social-sidebar, .lol-social-roster { background-size: 200% 100% !important; animation: lpt-${id}-surface 16s ease-in-out infinite alternate; }
@keyframes lpt-${id}-surface { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }
.lol-social-roster { border-left: 1px solid ${accent}55 !important; border-radius: ${id === 'rosewater' ? '18px 0 0 18px' : '10px 0 0 10px'}; }
input[type="text"], input[type="search"], textarea { background: ${background}cc !important; color: ${text} !important; border: 1px solid ${accent}66 !important; border-radius: ${controlRadius}; }
.lol-uikit-button, .button-standard, .btn, button[class*="button"] { border-radius: ${controlRadius} !important; transition: border-color .2s ease, background .2s ease, transform .2s ease !important; }
.lol-uikit-button:hover, .button-standard:hover, .btn:hover, button[class*="button"]:hover { border-color: ${accent}99 !important; background-color: ${accent}18 !important; transform: ${id === 'rosewater' ? 'translateY(-1px)' : 'none'}; }
:focus-visible { outline: 2px solid ${accent} !important; outline-offset: 3px; }
::-webkit-scrollbar { width: 7px; } ::-webkit-scrollbar-thumb { background: linear-gradient(${accent}, ${secondary}) !important; border-radius: 8px; }
::selection { background: ${accent}; color: ${background}; }
${signature}
/* Disable every Atelier motion path, including wallpaper and sidebar. */
@media (prefers-reduced-motion: reduce) {
  .rcp-fe-lol-home, .rcp-fe-lol-home-main, .rcp-fe-lol-collections, .rcp-fe-lol-event-hub,
  .rcp-fe-lol-loot, .rcp-fe-lol-clash, .rcp-fe-lol-store,
  .lol-social-sidebar, .lol-social-roster, .lol-social-sidebar .identity-icon,
  .lol-social-roster [class*="friend"], .lol-social-roster [class*="item"], .lol-social-roster [class*="group"],
  .navigation-tab, .lol-uikit-button, .button-standard, .btn, button[class*="button"] {
    animation: none !important; transition: none !important;
  }
}
`;
    return { id, name, description, image, colors, css };
}

export const BUILTIN_THEMES = [
    surfaceTheme('obsidian', 'Obsidian Atelier', 'Kindred artwork, charcoal panels and restrained brass accents.', ['#0d0e10', '#1b1d21', '#c6a56a', '#f2eee6'], '#7b8794', 'Inter'),
    surfaceTheme('rosewater', 'Rosewater Atelier', 'Seraphine artwork, champagne highlights and soft plum glass.', ['#1c121b', '#30202b', '#e7b3bf', '#fff4f1'], '#cda6d8', 'Avenir Next'),
];

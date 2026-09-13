# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-13

### Added
- **Custom profile backgrounds**: Install static or animated PNG, JPG, WEBP, and GIF backgrounds through the bundled PenguLoader integration.
- **Overview customization**: Override Mastery, Clash, Honor, banner, and profile Overview rank cards with a persistent live preview.
- **Window size presets**: Switch between compact, recommended, and large layouts from Settings with monitor-aware sizing.

### Changed
- **Compact Control Center**: Rebuilt the application shell with grouped navigation, a global client status header, denser controls, and responsive layouts.
- **Unified editors**: Standardized page headers, section headers, field layouts, panels, and action docks across Background, Overview, Rank, Challenge, and Settings.
- **Accurate previews**: Background darkening and Overview champion icons, mastery levels, and automatic states now update directly in their previews.
- **Responsive forms**: Rank, Challenge, Overview, and Settings controls now reflow cleanly in narrow windows.
- **Feature priority**: Moved Background, Overview, Rank, and Challenge tools to the top of the customization workflow.
- **Default window**: Increased the default workspace to 1200 x 800 with a 960 x 650 minimum size.

### Tests
- Updated profile interaction coverage for the button-based availability controls. The complete frontend suite passes with 191 tests.

## [1.13.0] - 2026-09-02

### Added
- **Challenge Level editor**: Added a dedicated section for changing the challenge crystal level and challenge points independently from rank overrides.
- **Profile Overview rank override**: Added an optional, persisted PenguLoader-powered override for the rank shown on the League Profile Overview card.
- **PenguLoader setup guidance**: Added an installation status, prominent three-step setup instructions, plugin update action, and manual installation documentation.

### Changed
- **Rank Override interface**: Reworked queue, tier, and division controls into a clearer card-based layout consistent with the rest of the application.
- **Independent feature navigation**: Rank Override and Challenge Level now have separate sidebar and Home entries.
- **PenguLoader plugin**: The bundled plugin now updates the Overview queue label, tier text, and regalia emblem while respecting the Overview toggle.
- **Responsive layout**: Rank and Challenge editors now use vertical cards with mobile-friendly control grids.

### Tests
- Added dedicated Challenge Level coverage and expanded Rank Override and Home navigation tests. The complete frontend suite passes with 165 tests.

## [1.12.2] - 2026-09-01

### Added
- **Code signing**: Windows and macOS releases are now signed with Authenticode and Apple Developer ID certificates.
- **Self-signed certificate script**: Added `scripts/generate-cert.ps1` for generating a self-signed code signing certificate.

### Security
- **VirusTotal report**: Automated VirusTotal scanning after each release.

## [1.12.1] - 2026-09-01

### Changed
- **Unlimited bio length**: Removed the application-side character limit and automatic truncation from profile and Music Sync bios. The LCU now handles any server-side validation.
- **SonarQube quality gate**: SonarQube findings now fail the workflow directly instead of creating GitHub issues.

### Dependencies
- **npm:** lucide-react 1.31.0 → 1.33.0, vite 8.2.1 → 8.2.2, @vitejs/plugin-react 6.0.5 → 6.1.0, vitest 4.1.10 → 4.1.11, @vitest/coverage-v8 4.1.9 → 4.1.11
- **github_actions:** github/codeql-action 4.37.7 → 4.37.8

### Notes
- Merged 6 dependabot PRs (lucide-react, vite, @vitejs/plugin-react, vitest, @vitest/coverage-v8, github/codeql-action) into `main`. Resolved conflicts on `package.json` and `package-lock.json` by keeping the latest versions. Verified with `vitest run` (159/159 passing) and `vite build` (ok).

## [1.12.0] - 2026-08-11

### Added
- **Auto-expanding textareas** (#890): `AutoExpandingTextarea` component that grows/shrinks instantly with content; used in MusicTab and ProfileTab with monospace font for ASCII art. Manual vertical resize preserved.
- **Bio length 127 → 255 chars** (#890): Bios now use the full LCU limit, allowing longer ASCII art.
- **Idle-text-as-bio switch** (#890): Toggle in ProfileTab to use the Music Sync idle text (more room) as your profile bio without enabling Music Sync.
- **Char counter**: Live `N/255` indicator under all bio textareas.
- **Zustand store** (`src/store.ts`): Centralizes `lcu`/`musicBio` state and `lcuRequest` action with retry; eliminates prop-drilling.
- **Retry/backoff utility** (`src/utils/retry.ts`): `withRetry()` wraps LCU requests with exponential backoff.
- **Typed storage layer** (`src/utils/storage.ts`): Zod-validated `loadJSON`/`saveJSON` and helpers.
- **Per-tab ErrorBoundary**: Each tab isolated so a crash in one doesn't take down the app.
- **Settings backup & restore**: Export/import all localStorage keys as JSON via Tauri file dialogs.
- **Enforcer/music-sync conflict resolution** (#890): Enforcer skips `statusMessage` when Music Sync is active.
- **`patchChatLol()` mutex**: Serializes concurrent patches to `/lol-chat/v1/me` `lol` field.
- **Storage key constants** (`src/storageKeys.ts`): Named constants replacing string literals.

### Fixed
- **Reactive textarea resize**: Instant resize on content change (removed `ResizeObserver` loop).
- **Stale `presets` state**: Rapid save/delete now reads ref instead of stale state.
- **Auto-Enforce toggle reactive**: Toggling in Settings takes effect without reconnect.
- **Overlapping async cycles**: Re-entry guards and AbortController/timeout in `useLcu`, `useProfileEnforcer`, `useMusicSync`.
- **Rank/Background/Challenge wipes `lol` fields**: All tabs use `patchChatLol()` to merge.
- **Bio draft loss**: `bioDirtyRef` preserves unsaved bio across enforcer cycles.
- **Music sync disable race**: `enabled: false` set before restoring idle bio.
- **Stale summoner on disconnect**: HomeTab clears summoner info on LCU disconnect.
- **`setState` after unmount**: `cancelled` flags in BackgroundTab and HomeTab.
- **useToast timer leak**, **useIcons corrupted-cache crash**, **SettingsTab Clear All** parallelization, **Clear All settings coverage** (4 missing keys), **App close listener race**.

### Dependencies
- **npm:** lucide-react 1.24.0 → 1.30.0, react-window 2.2.7 → 2.3.0, react-dom 19.2.7 → 19.2.8, jsdom 29.1.1 → 30.0.1, zustand 5.x (new), zod 4.x (new)
- **cargo:** base64 0.23.0 → 0.23.1
- **github-actions:** github/codeql-action v4.37.4 → v4.37.6

## [1.11.0] - 2026-08-07

### Fixed
- Reduced cognitive complexity in `BackgroundTab.tsx` by extracting helper functions `groupChampionsByName`, `fetchSkinsForId`, `addUniqueSkins` (#897, #899)
- Replaced assignment expression with nullish coalescing operator `??=` in `BackgroundTab.tsx` (#898)

### Dependencies
- **npm:** lucide-react 1.21.0 → 1.24.0, react-icons 5.6.0 → 5.7.0, @types/node 26.0.1 → 26.1.1, @vitejs/plugin-react 6.0.1 → 6.0.3, vitest 4.1.9 → 4.1.10, postcss 8.5.15 → 8.5.25
- **cargo:** base64 0.22.1 → 0.23.0, serde 1.0.228 → 1.0.229, serde_json 1.0.150 → 1.0.151, serde_with 3.19.0 → 3.21.0, tauri-plugin-dialog 2.7.1 → 2.7.2, tauri-plugin-log 2.8.0 → 2.9.0
- **github_actions:** actions/setup-node v6 → v7, tauri-apps/tauri-action v0 → v1, github/codeql-action v4 → v4.37.4, SonarSource/sonarqube-scan-action 8.2.0 → 8.2.1

## [1.10.2] - 2026-07-30

### Added
- **Signature Immortalized Legend Kai'Sa (#891)**: Added missing Signature Immortalized Legend Kai'Sa background skin (ID `145071`) via supplemental skin registry.

### Fixed
- **Champion Duplication & Mode Skin Unification**: Fixed issue where champions appeared multiple times in the selection grid due to game mode IDs (e.g. Swarm/Arena `60000+` IDs). Unified duplicate champions into a single card and combined all available background skins under one entry.

## [1.10.1] - 2026-07-23

### Added
- **Custom Application Icon (#265)**: Added custom Draven Spinning Axe app icon design for Windows executable (`.exe`), macOS app bundle (`.icns`), Linux/favicons, and application navigation header logo.

### Fixed
- **Cargo Configuration Warning**: Removed deprecated `http.http2` config setting from `.cargo/config.toml`.
- **Tauri v2 Config Validation**: Removed invalid `icon` property from `app.windows[0]` in `tauri.conf.json`.

## [1.10.0] - 2026-07-11

### Added
- **Selective Clear All Settings (#434, #436)**: Replaced the simple Yes/No confirm with a checkbox-based panel — pick exactly what to reset: rank, challenge, background, tokens, icon, status, or auto-enforcer.
- **Profile Icon Reset**: Clear All now restores your saved icon (or defaults to icon 0).
- **Status & Bio Reset**: Clear All resets availability to chat and clears the status message.

### Fixed
- **LCU Override Fields Not Clearing (#434, #436)**: Deleting fields from chat presence didn't work; now they're set to empty strings.
- **CDragon Cache**: Fixed cache invalidation issues with CommunityDragon data fetching.

## [1.9.9] - 2026-07-11

### Fixed
- **Profile Reset After Games (#429)**: The Auto-Enforcer now continuously polls every 15 seconds to re-apply profile picture, rank (tier/division/queue), challenge points, and crystal level after League resets them post-game.
- **Rank & Challenge Stats Enforcement**: Added support for persisting rank overrides (`rankedLeagueTier`, `rankedLeagueDivision`, `rankedLeagueQueue`) and challenge stats (`challengeCrystalLevel`, `challengePoints`) via chat presence.

## [1.9.8] - 2026-07-05

### Fixed
- **GitHub Release Assets**: Changed `productName` from `"League Profile Tool"` to `"League-Profile-Tool"` in `tauri.conf.json` so that the Tauri bundler produces filenames that match the paths expected by the CI release action.

### Changed
- **Updater URLs**: Updated download URL patterns in the CI workflow to use the new hyphenated name, ensuring the auto-updater can locate the correct release assets.

## [1.9.7] - 2026-07-05

### Added
- **Profile Banner Customization**: New dropdown selector in the Regalia customizer lets you choose your profile banner by name (loaded from CommunityDragon).

### Fixed
- **Crest Handling**: Crest border is now preserved unchanged — no UI, just passthrough.
- **Title Sentinel Fix**: Title ID -1 ("No Title") is filtered out before being sent to the LCU API, preventing invalid title errors.
- **Copy Button Fix**: Fixed overlapping tagline issue in the summoner banner.

## [1.9.6] - 2026-06-28

### Added
- **Supplemental Skin Data**: Added a system to include skins missing from CommunityDragon via `src/data/supplemental-skins.json`, resolving issue #303. The first entry is Immortalized Legend Ahri (ID: 103086).
- **Fallback Splash Placeholder**: When a splash image fails to load (404), a styled placeholder with "Preview not available" text is now shown instead of a broken image icon.
- **Skin Search by Name**: The Direct Skin ID input now accepts skin names with autocomplete suggestions.

## [1.9.5] - 2026-06-25

### Added
- **Test Coverage**: Created new comprehensive unit test suites for `FriendManagerTab`, `LobbyTab`, `PresetsTab`, `useProfileEnforcer`, and `useAutoRestore` hooks, increasing overall statement test coverage to over 80%.

### Fixed
- **Security Vulnerability**: Updated `undici` to `7.28.0` to resolve multiple CVEs in #315 (TLS validation bypass, cross-origin request routing, HTTP header injection, SameSite downgrade, and HTTP response queue poisoning).
- **Security Vulnerability**: Updated `tar` to `0.4.46` in Cargo.lock.

## [1.9.4] - 2026-06-25

### Added
- **Tokens Redesign**: Completely overhauled the Tokens tab with a new UI that utilizes full horizontal space.
- **Summoner Title Selection**: Added the ability to dynamically select the Summoner Title directly from the Tokens tab.
- **Auto-Enforcer Resilience**: The Auto-Enforcer now isolates each configuration restore. If one fails, it won't prevent the rest from being applied.
- **Auto-Enforcer Retry Mechanism**: Added an intelligent retry mechanism for applying settings.

## [1.9.3] - 2026-06-20

### Fixed
- **Presets & Backgrounds**: Resolved an issue where loading presets or applying backgrounds failed if the profile icon or background skin was unowned. The app now properly falls back to the force method to apply them.

## [1.9.2] - 2026-06-17

### Changed
- Modified and enhanced the System Logs user interface.

## [1.9.1] - 2026-06-08

### Fixed
- **Invisible Status**: Implemented an "Enforce Offline" feature in the Profile tab to prevent the League client from automatically reverting status to "Online" when entering Champion Select.

## [1.9.0] - 2026-05-23

### Added
- **Presets Disk Persistence**: Profile presets are now securely saved to disk, surviving app reinstalls and updates.
- **Secure Backend Commands**: Implemented `load_presets` and `save_presets` commands in the Tauri Rust backend to securely manage presets file storage.

### Changed
- **Performance (React)**: Restructured loading state so that each tab manages its own fetching process locally, preventing the entire app from locking up during a request.
- **Performance (Rust)**: System process detection logic was rewritten using a singleton `OnceLock` pattern.

## [1.8.0] - 2026-05-21

### Added
- **Profile Presets**: Introduced a brand new "Presets" tab. Users can now save their entire customized profile (Icon, Background, Bio, Tokens, and Status) as a named preset.
- **Visual Preset Cards**: The Presets tab features dynamic cards that display a live preview of the profile, loading the exact champion splash art and icon directly from Community Dragon.
- **Active Auto-Restore Enforcement**: The auto-restore system has been completely rewritten. It now continuously monitors the League client in the background.

## [1.7.1] - 2026-05-16

### Fixed
- **macOS Support**: Fixed a critical bug where the app would get stuck on "Connecting..." on macOS by correctly supporting macOS process names (`LeagueClientUx`) and expanding LCU `lockfile` detection to include common macOS installation paths.

## [1.7.0] - 2026-05-10

### Added
- **Smart Friend Manager**: Integrated a new tab for manual bulk friend deletion, featuring real-time Riot ID display (Name#Tag) and a detailed progress tracker.
- **Profile Dashboard**: Redesigned the Home page with a live header displaying current summoner icon, level, and Riot ID.
- **UX Polish**: Refactored the Home page to a cleaner, category-based navigation.
- **Security Whitelist**: Updated the backend LCU request whitelist to support dynamic IDs (UUIDs) for deletion and status endpoints.

## [1.6.4] - 2026-04-27

### Fixed
- **CI/CD**: Resolved Tauri plugin version mismatch between Rust and NPM dependencies.

## [1.6.2] - 2026-03-16

### Added
- **Descriptive Icon Names**: Switched to Community Dragon as the primary data source, providing real names for over 6,000 icons instead of generic IDs.
- **English-First Search**: Forced English (en_gb) as the default language for both Icons and Tokens/Challenges metadata, ensuring consistent search results regardless of client locale.
- **Supercharged Icon Loading**: Implemented a version-aware local cache that skips large 2.5MB metadata fetches if the version hasn't changed, making the app startup nearly instantaneous.

## [1.6.1] - 2026-03-14

### Changed
- **Dependencies**: Bumped various frontend, backend, and CI dependencies via Dependabot (vite, vitest, sysinfo, actions/setup-node, etc.) for improved security and performance.

## [1.6.0] - 2026-03-13

### Added
- **Categorized Navigation**: Migrated from a horizontal top-bar to a premium vertical sidebar with grouped categories (Customization, Enhancements, System).
- **Collapsible Sidebar**: Added support for collapsing the navigation rail to maximize workspace, featuring icon-only mode and smooth transitions.
- **Smart Home Dashboard**: Completely redesigned home page with hierarchical category navigation and improved drill-down UX.
- **Profile Background**: New dedicated tab to set any champion skin as your profile background.

## [1.5.4] - 2026-03-08

### Fixed
- **LCU API (Status Update)**: Resolved `405 Method Not Allowed` when updating chat availability by switching from `PATCH` to `PUT` method, ensuring compatibility with newer League client versions.

## [1.5.3] - 2026-03-07

### Fixed
- **Profile Bio Persistence**: Implemented a local storage mechanism and auto-restore logic to prevent the profile bio from being reset to empty upon client restarts.
- **LCU API Compatibility**: Fixed `405 Method Not Allowed` errors during status updates by correctly implementing the `PUT` method for the `/lol-chat/v1/me` endpoint.
- **Race Condition (Startup)**: Added an exponential backoff retry system to profile synchronization, ensuring successful connection even if the LCU chat service is not immediately ready after client launch.

## [1.5.2] - 2026-02-27

### Added
- **Discord**: Added automated release notification workflow to broadcast updates on Discord.
- **Discord**: Add discord link server.

### Changed
- **Music Tab**: Reduced cognitive complexity and added Discord Rich Presence documentation.

## [1.5.1] - 2026-02-25

### Fixed
- Replaced deprecated Lucide `Github` icon with `react-icons` (`SiGithub`) to eliminate TypeScript deprecation warnings.
- Updated `MusicTab.test.tsx` to align with the recent UI redesign, fixing failing assertions for button labels and interaction flows.

### Added
- New image demo.

### Changed
- Gui style improvement.
- Updated GitHub Actions to latest versions: `actions/checkout@v6`, `sonarqube-scan-action@v7`, `actions/setup-node@v6`, and `actions/github-script@v8`.

## [1.5.0] - 2026-02-23

### Added
- **Profile Tokens**: Introduced a dedicated "Tokens" tab for customizing challenge medals on your profile.
- **Visual Picker**: New HD token selection grid powered by Community Dragon assets.
- **Multi-Slot Assignment**: Added support for assigning the same token to multiple slots simultaneously.
- **Smart Search**: Real-time filtering for owned tokens within the selection modal.
- **Sync Control**: Added a RotateCw icon for manual token synchronization and status badges for owned count.

### Fixed
- **LCU Bridge**: Hardened the backend whitelist for LCU API requests.

## [1.4.2] - 2026-02-22

### Fixed
- **Updater**: Migrated from CDN-cached `raw.githubusercontent` to GitHub Releases API to guarantee instant update detection upon launch.
- **CI/CD**: Fixed a Syntax Error vulnerability in `auto-close-fixed-issues.yml` by using environment variables to securely pass JSON output to GitHub Scripts instead of unsafe inline interpolation.

## [1.4.1] - 2026-02-22

### Fixed
- **CI/CD**: Resolved YAML syntax error on line 150 of `auto-close-fixed-issues.yml` caused by a backtick-delimited JavaScript template literal inside a YAML block scalar — replaced with safe string concatenation.

## [1.4.0] - 2026-02-22

### Added
- **LastFM Bio Sync**: Dynamic bio integration with the Last.fm API — the app now automatically updates your League profile bio with the song you are currently listening to.

### Changed
- **App Architecture**: Refactored the root `App` component to reduce Cognitive Complexity from 22 to under 15, improving maintainability and readability.

### Fixed
- **Security (CodeQL)**: Resolved incomplete URL substring sanitization warnings flagged by CodeQL analysis.
- **Accessibility**: Associated all form labels with their controls across all tabs.

## [1.3.7] - 2026-02-19

### Added
- **Security CI**: Added automated VirusTotal scanning workflow for release assets (`.github/workflows/virustotal-report.yml`).
- **Security Report**: Added versioned report output at `res/docs/SECURITY_REPORT.md`, automatically updated by CI.

### Changed
- **Documentation (README)**: Reworked structure with quicker onboarding, trust-focused sections, security links, and improved markdown presentation.
- **Dependencies (Dependabot)**: Bumped lucide-react from 0.574.0 to 0.575.0.

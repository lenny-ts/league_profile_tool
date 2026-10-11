# 🏆 League Profile Tool

A desktop tool built with **Tauri v2** and **React** for League of Legends profile customization through the LCU (League Client Update) API.

<p align="center">

<a href="https://github.com/lenny-ts/league_profile_tool/releases">
  <img src="https://img.shields.io/github/release/lenny-ts/league_profile_tool.svg?style=flat-square" alt="Latest Release"/>
</a>

<a href="https://github.com/lenny-ts/league_profile_tool/actions">
  <img src="https://img.shields.io/github/actions/workflow/status/lenny-ts/league_profile_tool/release.yml?style=flat-square&logo=githubactions&logoColor=white&color=238636&cacheSeconds=0" alt="CI Workflow"/>
</a>

<a href="https://github.com/lenny-ts/league_profile_tool/actions/workflows/virustotal-report.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/lenny-ts/league_profile_tool/virustotal-report.yml?style=flat-square&logo=virustotal&logoColor=white&label=VirusTotal&color=0b65d8&cacheSeconds=0" alt="VirusTotal"/>
</a>

<a href="https://sonarcloud.io/summary/new_code?id=lenny-ts_league_profile_tool">
  <img src="https://img.shields.io/badge/Code%20Quality-SonarCloud-F3702A?style=flat-square&logo=sonarcloud&logoColor=white&cacheSeconds=0" alt="Code Quality"/>
</a>

<a href="https://github.com/lenny-ts/league_profile_tool/releases">
  <img src="https://img.shields.io/endpoint?url=https://downloadsbadge.duckdns.org/downloads&style=flat-square" alt="Downloads"/>
</a>

<a href="LICENSE">
  <img src="https://img.shields.io/github/license/lenny-ts/league_profile_tool?style=flat-square&color=9e6a03&cacheSeconds=0" alt="License"/>
</a>

</p>

---

![League Profile Tool Demo](res/img/demo.png)

## 🎬 Interactive Demos

Watch the real recordings on the project site: **[league-profile-tool site](https://lenny-ts.github.io/league_profile_tool/#showcase)**.

Each feature has a short demo that you can start directly from the page:

| Demo | Direct link |
|---|---|
| Client Themes | [`docs/media/theme.mp4`](docs/media/theme.mp4) |
| Profile Background | [`docs/media/background.mp4`](docs/media/background.mp4) |
| Overview Cards | [`docs/media/overview.mp4`](docs/media/overview.mp4) |
| Rank Override | [`docs/media/rank.mp4`](docs/media/rank.mp4) |
| Challenge Level | [`docs/media/challenges.mp4`](docs/media/challenges.mp4) |
| Icon Swapper | [`docs/media/icon.mp4`](docs/media/icon.mp4) |
| Profile Tokens | [`docs/media/tokens.mp4`](docs/media/tokens.mp4) |
| Profile Bio | [`docs/media/bio.mp4`](docs/media/bio.mp4) |
| Music Auto Bio | [`docs/media/music.mp4`](docs/media/music.mp4) |
| Friend Manager | [`docs/media/friends.mp4`](docs/media/friends.mp4) |
| Lobby Manager | [`docs/media/lobby.mp4`](docs/media/lobby.mp4) |

<p align="center">
  <a href="https://www.youtube.com/watch?v=zd6FKj8uvA4">
    <strong>🎥 Or watch the full video demo on YouTube</strong>
    <br>
    <img src="https://img.youtube.com/vi/zd6FKj8uvA4/maxresdefault.jpg" alt="Watch the video" width="100%">
  </a>
</p>

> **Tip:** Fast links: [Download](https://github.com/lenny-ts/league_profile_tool/releases) • [Security Report](res/docs/SECURITY_REPORT.md) • [Changelog](res/docs/CHANGELOG.md)

| 🚀 Start Here | 🔗 Link |
|---|---|
| Latest Release | [GitHub Releases](https://github.com/lenny-ts/league_profile_tool/releases) |
| Interactive Demos | [Site showcase](https://lenny-ts.github.io/league_profile_tool/#showcase) |
| CI Workflows | [GitHub Actions](https://github.com/lenny-ts/league_profile_tool/actions) |
| Security Report | [`res/docs/SECURITY_REPORT.md`](res/docs/SECURITY_REPORT.md) |

## ✨ Main Features

- **🗂️ Categorized Navigation**: Premium vertical sidebar with grouped categories (Customization, Enhancements, System).
- **🧹 Smart Friend Manager**: Bulk delete friends with ease, featuring real-time Riot ID display (Name#Tag) and a detailed progress tracker.
- **🏠 Live Profile Dashboard**: Redesigned home page with a live header displaying your current summoner icon, level, and Riot ID.
- **🖼️ Profile Background**: Dedicated tab to set any champion skin as your profile background with lazy loading.
- **🆕 Profile Tokens**: Customize your 3 challenge medals with a visual image picker powered by HD Community Dragon assets.
- **🎵 Music Integration**: Synchronize your profile bio with your **Last.fm** scrobbles automatically. Supports 255-char bios with ASCII art; idle text can be used standalone as your profile bio via a toggle switch.
- **🏆 Rank Override**: Customize the visible queue, tier, and division used by chat and social cards.
- **🔷 Challenge Level**: Set the challenge crystal level and challenge points from a dedicated editor.
- **🐧 PenguLoader Overview Override**: Optionally mirror the selected rank in the League Profile Overview card, tooltip text, and regalia emblem through the bundled PenguLoader plugin.
- **🖼️ Icon Swapper**: Browse and apply **6,000+ profile icons** with descriptive names (e.g., "Blue Minion Bruiser").
- **📝 Presence Control**: Edit **bio/chat status** and set LCU presence (**Online, Away, Mobile, Offline**). Auto-expanding textareas with monospace font for ASCII art, live char counter (N/255), and a toggle to use the Music Sync idle text as your bio for more room.
- **⚡ Performance Optimized**: Version-aware local cache for metadata and JPG previews for instant loading.
- **🔄 Auto-Updater**: Built-in update detection with secure ED25519 signatures.
- **↔️ Collapsible Sidebar**: Support for icon-only mode with smooth transitions.

## ⚡ Quick Start (Users)

1. Download the latest build from [Releases](https://github.com/lenny-ts/league_profile_tool/releases).
2. Start League of Legends client.
3. Open **League Profile Tool**.
4. Join our [Discord Server](https://discord.gg/G3M4X3B) (Optional) for support and updates.
5. Apply your desired customizations directly through the Hextech-inspired UI.

### Profile Overview override

Chat and social rank overrides work directly through the LCU. Overriding the rank shown in the League **Profile Overview** additionally requires [PenguLoader](https://github.com/PenguLoader/PenguLoader):

1. Open **Settings > Pengu Loader** in League Profile Tool.
2. Select **Install Pengu & Plugins**. The app downloads and manages the official PenguLoader runtime automatically.
3. Enable **PenguLoader Overview Override** in the Rank Override section, apply the changes, and fully restart League.

The Overview toggle is independent: disabling it does not affect chat or social hover cards.

### Pengu Loader attribution

League Profile Tool downloads and manages the official [Pengu Loader](https://github.com/PenguLoader/PenguLoader)
runtime under the user's local app data directory. Pengu Loader is MIT licensed; its own license and notices remain
with the managed runtime. The tool does not bundle or redistribute any injection DLL.

## 🛠️ Development

### Prerequisites

- **Node.js**: `v20.x` or newer
- **Rust**: latest stable via [rustup](https://rustup.rs/)
- **League of Legends** client installed

### Run locally

```bash
git clone https://github.com/lenny-ts/league_profile_tool.git
cd league_profile_tool
npm ci
npm run tauri dev
```

### Production build

```bash
npm run tauri build
```

## 🔒 Security and Trust

This project uses automated checks and public reporting:

- **CodeQL** for static security analysis
- **SonarCloud** for quality and hotspot analysis
- **Dependabot** for dependency updates
- **VirusTotal release report** generated in CI and published at [`res/docs/SECURITY_REPORT.md`](res/docs/SECURITY_REPORT.md)

All checks run in GitHub Actions and are publicly visible from the repository Actions tab.

<details>
<summary><strong>🧪 How release verification works (CLICK HERE)</strong></summary>

1. CI builds release artifacts.
2. Release assets are scanned via VirusTotal.
3. Results are published to `res/docs/SECURITY_REPORT.md`.
4. Users can cross-check release notes, hashes/signatures, and scan report.

</details>

## 🧰 Built With

- [Tauri v2](https://v2.tauri.app/)
- [React](https://react.dev/)
- [Lucide React](https://lucide.dev/)
- [Vite](https://vitejs.dev/)

## 📚 Project Docs

- [Changelog](res/docs/CHANGELOG.md)
- [Contributing](res/docs/CONTRIBUTING.md)
- [Code of Conduct](res/docs/CODE_OF_CONDUCT.md)
- [Security Policy](res/docs/SECURITY.md)

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## ☕ Support

If the project is useful to you, you can support it here:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/profumato)

## 👥 Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/lenny-ts"><img src="https://avatars.githubusercontent.com/u/74313264?v=4?s=100" width="100px;" alt="lenny-ts"/><br /><sub><b>lenny-ts</b></sub></a><br /><a href="https://github.com/lenny-ts/league_profile_tool/commits?author=lenny-ts" title="Code">💻</a> <a href="#design-lenny-ts" title="Design">🎨</a> <a href="#maintenance-lenny-ts" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification.

---

*Disclaimer: This tool is not affiliated with, endorsed by, or integrated with Riot Games in any official capacity.*

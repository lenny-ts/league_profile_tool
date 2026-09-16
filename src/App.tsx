import React, { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { isEnabled } from "@tauri-apps/plugin-autostart";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SiGithub, SiKofi, SiDiscord } from "react-icons/si";
import {
    Award,
    Disc3,
    Home,
    Image,
    Loader2,
    Settings,
    ShieldCheck,
    Terminal,
    Trophy,
    UserCircle,
    Menu,
    ChevronLeft,
    Users,
    UserMinus,
    FolderOpen,
    Gem,
    PanelsTopLeft
} from 'lucide-react';
import "./App.css";

// Hooks
import { useToast } from "./hooks/useToast";
import { useLogs } from "./hooks/useLogs";
import { useLcu } from "./hooks/useLcu";
import { useIcons } from "./hooks/useIcons";
import { useMusicSync } from "./hooks/useMusicSync";
import { useAnalytics } from "./hooks/useAnalytics";
import { useProfileEnforcer } from "./hooks/useProfileEnforcer";


// Components
import HomeTab from "./components/tabs/HomeTab";
import ProfileTab from "./components/tabs/ProfileTab";
import MusicTab from "./components/tabs/MusicTab";
import RankTab from "./components/tabs/RankTab";
import OverviewTab from "./components/tabs/OverviewTab";
import ChallengeLevelTab from "./components/tabs/ChallengeLevelTab";
import IconTab from "./components/tabs/IconTab";
import LogsTab from "./components/tabs/LogsTab";
import TokensTab from "./components/tabs/TokensTab";
import BackgroundTab from "./components/tabs/BackgroundTab";
import SettingsTab from "./components/tabs/SettingsTab";
import ThemeTab from "./components/tabs/ThemeTab";
import LobbyTab from "./components/tabs/LobbyTab";
import FriendManagerTab from "./components/tabs/FriendManagerTab";
import PresetsTab from "./components/tabs/PresetsTab";
import ErrorBoundary from "./components/ErrorBoundary";
import { applyWindowSizePreset, getSavedWindowSizePreset } from "./utils/windowSize";

const TAB_TITLES: Record<string, string> = {
  home: "Dashboard",
  profile: "Profile Bio & Status",
  background: "Background",
  themes: "Client Themes",
  overview: "Overview Cards",
  rank: "Rank Overrides",
  challenge: "Challenge Level",
  icons: "Icon Swapper",
  tokens: "Profile Tokens",
  music: "Music Sync",
  presets: "Profile Presets",
  friends: "Friend Manager",
  lobby: "Lobby Manager",
  logs: "System Logs",
  settings: "Settings",
};

function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [appReady, setAppReady] = useState(false);
  const [clientVersion, setClientVersion] = useState("0.0.0");
  const [latestVersion, setLatestVersion] = useState("");
  const [isAutostartEnabled, setIsAutostartEnabled] = useState(false);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { message, showToast } = useToast();
  const { logs, addLog, exportLogs, clearLogs } = useLogs();
  const { lcu, lcuRequest } = useLcu(addLog);
  const { musicBio, setMusicBio, applyIdleBio } = useMusicSync(lcu, addLog);
  const icons = useIcons(addLog);
  useAnalytics();
  useProfileEnforcer(lcu, lcuRequest, addLog, musicBio.enabled);


  const closingRef = useRef(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    applyWindowSizePreset(getSavedWindowSizePreset()).catch((err) => {
      addLog(`Window size restore failed: ${err}`);
    });

    const init = async () => {
      try {
        const [v, autostart, tray] = await Promise.all([
          getVersion(),
          isEnabled(),
          invoke<boolean>("get_minimize_to_tray").catch(() => true)
        ]);
        if (!active) return;
        setClientVersion(v);
        setIsAutostartEnabled(autostart);
        setMinimizeToTray(tray);

        fetch('https://api.github.com/repos/lenny-ts/league_profile_tool/releases/latest', {
          signal: controller.signal
        })
          .then(res => res.ok ? res.json() : Promise.reject(new Error("Failed to load latest release from GitHub API")))
          .then(releaseData => {
            if (active && releaseData.tag_name) {
              const version = releaseData.tag_name.replace(/^v/, '');
              setLatestVersion(version);
            }
          })
          .catch((err) => {
            if (active) addLog(`Update Check Error: ${err.message}`);
          });

        setAppReady(true);
        addLog(`Application ready. v${v}`);
      } catch (err) {
        if (!active) return;
        setAppReady(true);
        addLog(`Init Error: ${err}`);
      }
    };

    init();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    const appWindow = getCurrentWindow();

    appWindow.onCloseRequested(async (event) => {
      if (disposed || closingRef.current) return;
      closingRef.current = true;
      event.preventDefault();

      try {
        if (musicBio.enabled && lcu) {
          await Promise.race([
            applyIdleBio(),
            new Promise((resolve) => setTimeout(resolve, 1200))
          ]);
        }
      } catch (err: unknown) {
        addLog(`Shutdown bio application failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (minimizeToTray) {
          try {
            await appWindow.hide();
            closingRef.current = false;
          } catch (err) {
            addLog(`Failed to hide window: ${err}`);
            await invoke("force_quit");
          }
        } else {
          await invoke("force_quit").catch(() => { });
        }
      }
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [musicBio.enabled, lcu, applyIdleBio, minimizeToTray, addLog]);

  const toggleMinimizeToTray = async () => {
    try {
      const newState = !minimizeToTray;
      await invoke("set_minimize_to_tray", { enabled: newState });
      setMinimizeToTray(newState);
      addLog(`Minimize to tray ${newState ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      addLog(`Failed to toggle minimize to tray: ${err}`);
    }
  };

  if (!appReady) {
    return (
      <div className="main-app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 className="intel-spinner" size={48} style={{ color: 'var(--hextech-gold)', marginBottom: '20px' }} />
          <h2 style={{ color: 'var(--hextech-gold)', letterSpacing: '4px', fontSize: '0.8rem' }}>INITIALIZING LCU BRIDGE...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={`main-app ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="app-header">
        <button type="button" className="app-brand" onClick={() => setActiveTab('home')} aria-label="Open dashboard">
          <img src="/app-icon.svg" alt="" className="app-brand-logo" />
          <span>LPT CONTROL CENTER</span>
        </button>
        <div className="app-header-status">
          <span className={`app-connection ${lcu ? 'connected' : ''}`}>
            <span className={`status-dot ${lcu ? 'online' : 'offline'}`}></span>
            {lcu ? 'LCU CONNECTED' : 'WAITING FOR LCU'}
          </span>
          <span className="app-version">v{clientVersion}</span>
        </div>
      </header>

      <nav className="nav-bar">
        <div className="nav-header">
          {!isCollapsed && <span className="nav-title">Navigation</span>}
          <button type="button" 
            className="nav-toggle-btn" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Menu" : "Collapse Menu"}
          >
            {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        <div className="nav-links">
          <NavItem icon={<Home size={18} />} label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} collapsed={isCollapsed} />

          <div className="nav-category">
            {!isCollapsed && <div className="nav-category-title">Customization</div>}
            <NavItem icon={<Image size={18} />} label="Background" active={activeTab === 'background'} onClick={() => setActiveTab('background')} collapsed={isCollapsed} />
            <NavItem icon={<PanelsTopLeft size={18} />} label="Client Themes" active={activeTab === 'themes'} onClick={() => setActiveTab('themes')} collapsed={isCollapsed} />
            <NavItem icon={<PanelsTopLeft size={18} />} label="Overview Cards" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} collapsed={isCollapsed} />
            <NavItem icon={<Trophy size={18} />} label="Rank Overrides" active={activeTab === 'rank'} onClick={() => setActiveTab('rank')} collapsed={isCollapsed} />
            <NavItem icon={<Gem size={18} />} label="Challenge Level" active={activeTab === 'challenge'} onClick={() => setActiveTab('challenge')} collapsed={isCollapsed} />
            <NavItem icon={<UserCircle size={18} />} label="Icons" active={activeTab === 'icons'} onClick={() => setActiveTab('icons')} collapsed={isCollapsed} />
            <NavItem icon={<Award size={18} />} label="Tokens" active={activeTab === 'tokens'} onClick={() => setActiveTab('tokens')} collapsed={isCollapsed} />
          </div>

          <div className="nav-category">
            {!isCollapsed && <div className="nav-category-title">Identity</div>}
            <NavItem icon={<ShieldCheck size={18} />} label="Profile Bio" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} collapsed={isCollapsed} />
            <NavItem icon={<Disc3 size={18} />} label="Music Sync" active={activeTab === 'music'} onClick={() => setActiveTab('music')} collapsed={isCollapsed} />
            <NavItem icon={<FolderOpen size={18} />} label="Presets" active={activeTab === 'presets'} onClick={() => setActiveTab('presets')} collapsed={isCollapsed} />
          </div>

          <div className="nav-category">
            {!isCollapsed && <div className="nav-category-title">Tools</div>}
            <NavItem icon={<UserMinus size={18} />} label="Friends" active={activeTab === 'friends'} onClick={() => setActiveTab('friends')} collapsed={isCollapsed} />
            <NavItem icon={<Users size={18} />} label="Lobby Manager" active={activeTab === 'lobby'} onClick={() => setActiveTab('lobby')} collapsed={isCollapsed} />
            <NavItem icon={<Terminal size={18} />} label="System Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} collapsed={isCollapsed} />
            <NavItem icon={<Settings size={18} />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} hasUpdate={!!latestVersion && clientVersion !== latestVersion} collapsed={isCollapsed} />
          </div>
        </div>

        <div className="nav-social">
          <a href="https://github.com/lenny-ts/league_profile_tool" target="_blank" rel="noreferrer" className="social-link-top" aria-label="GitHub Repository"><SiGithub size={18} /></a>
          {!isCollapsed && <a href="https://ko-fi.com/profumato" target="_blank" rel="noreferrer" className="social-link-top" aria-label="Support on Ko-fi"><SiKofi size={24} /></a>}
          {!isCollapsed && <a href="https://discord.gg/CcaARTSdz5" target="_blank" rel="noreferrer" className="social-link-top" aria-label="Join our Discord server"><SiDiscord size={20} /></a>}
        </div>
      </nav>

      <div className="main-container">
        <div className="workspace-header">
          <div>
            <span className="workspace-kicker">Workspace</span>
            <strong>{TAB_TITLES[activeTab]}</strong>
          </div>
          <span className="workspace-mode">LIVE CLIENT EDITOR</span>
        </div>
        <main className="content-area">
          {activeTab === 'home' && <ErrorBoundary name="Home"><HomeTab lcu={lcu} clientVersion={clientVersion} setActiveTab={setActiveTab} lcuRequest={lcuRequest} /></ErrorBoundary>}
          {activeTab === 'profile' && <ErrorBoundary name="Profile"><ProfileTab lcu={lcu} showToast={showToast} addLog={addLog} lcuRequest={lcuRequest} musicSyncActive={musicBio.enabled} /></ErrorBoundary>}
          {activeTab === 'friends' && <ErrorBoundary name="Friends"><FriendManagerTab lcu={lcu} showToast={showToast} addLog={addLog} lcuRequest={lcuRequest} /></ErrorBoundary>}
          {activeTab === 'background' && <ErrorBoundary name="Background"><BackgroundTab lcu={lcu} showToast={showToast} addLog={addLog} lcuRequest={lcuRequest} /></ErrorBoundary>}
          {activeTab === 'themes' && <ErrorBoundary name="Client Themes"><ThemeTab showToast={showToast} addLog={addLog} /></ErrorBoundary>}
          {activeTab === 'music' && <ErrorBoundary name="Music"><MusicTab lcu={lcu} musicBio={musicBio} setMusicBio={setMusicBio} showToast={showToast} addLog={addLog} applyIdleBio={applyIdleBio} /></ErrorBoundary>}
          {activeTab === 'tokens' && <ErrorBoundary name="Tokens"><TokensTab lcu={lcu} showToast={showToast} addLog={addLog} lcuRequest={lcuRequest} /></ErrorBoundary>}
          {activeTab === 'presets' && <ErrorBoundary name="Presets"><PresetsTab lcu={lcu} showToast={showToast} addLog={addLog} lcuRequest={lcuRequest} /></ErrorBoundary>}
          {activeTab === 'rank' && <ErrorBoundary name="Rank"><RankTab lcu={lcu} showToast={showToast} addLog={addLog} lcuRequest={lcuRequest} /></ErrorBoundary>}
          {activeTab === 'overview' && <ErrorBoundary name="Overview Cards"><OverviewTab lcu={lcu} showToast={showToast} addLog={addLog} lcuRequest={lcuRequest} /></ErrorBoundary>}
          {activeTab === 'challenge' && <ErrorBoundary name="Challenge Level"><ChallengeLevelTab lcu={lcu} showToast={showToast} addLog={addLog} lcuRequest={lcuRequest} /></ErrorBoundary>}
          {activeTab === 'lobby' && <ErrorBoundary name="Lobby"><LobbyTab lcu={lcu} showToast={showToast} addLog={addLog} lcuRequest={lcuRequest} /></ErrorBoundary>}
          {activeTab === 'icons' && <ErrorBoundary name="Icons"><IconTab lcu={lcu} showToast={showToast} addLog={addLog} {...icons} /></ErrorBoundary>}
          {activeTab === 'logs' && <ErrorBoundary name="Logs"><LogsTab logs={logs} exportLogs={exportLogs} clearLogs={clearLogs} showToast={showToast} /></ErrorBoundary>}
          {activeTab === 'settings' && <ErrorBoundary name="Settings"><SettingsTab isAutostartEnabled={isAutostartEnabled} setIsAutostartEnabled={setIsAutostartEnabled} minimizeToTray={minimizeToTray} toggleMinimizeToTray={toggleMinimizeToTray} latestVersion={latestVersion} clientVersion={clientVersion} addLog={addLog} showToast={showToast} lcuRequest={lcuRequest} /></ErrorBoundary>}
        </main>

      </div>

      {message.text && (
        <div className={`toast ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, hasUpdate, collapsed }: Readonly<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void, hasUpdate?: boolean, collapsed?: boolean }>) {
  return (
    <button
      type="button"
      className={`nav-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`} 
      onClick={onClick} 
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={collapsed ? label : undefined}
    >
      <div className="nav-item-icon">{icon}</div>
      {!collapsed && <span className="nav-item-label">{label}</span>}
      {hasUpdate && <div className="nav-update-beacon" aria-label="Update available"></div>}
    </button>
  );
}

export default App;

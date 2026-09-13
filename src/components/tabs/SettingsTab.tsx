import React, { useState } from 'react';
import { RefreshCw, Cpu, Trash2, X, Check, Download, Upload, Puzzle, FolderOpen, ExternalLink, AppWindow } from 'lucide-react';
import { enable, disable } from "@tauri-apps/plugin-autostart";
import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { SAVED_AUTO_ENFORCE_KEY, SAVED_ENFORCE_OFFLINE_KEY, SAVED_ICON_KEY, ALL_SAVED_KEYS, PENGU_PLUGIN_INSTALLED_KEY, PENGU_OVERVIEW_OVERRIDE_KEY, SAVED_RANK_QUEUE_KEY, SAVED_RANK_TIER_KEY, SAVED_RANK_DIV_KEY, SAVED_RANK_LP_KEY, SAVED_LAST_SEASON_RANK_KEY, SAVED_RANK_BORDER_KEY, SAVED_RANK_BANNER_KEY, SAVED_OVERVIEW_CARDS_KEY, SAVED_CUSTOM_BACKGROUND_KEY, SAVED_WINDOW_SIZE_KEY } from '../../storageKeys';
import { patchChatLol } from '../../utils/chatMe';
import { applyWindowSizePreset, getSavedWindowSizePreset, WINDOW_SIZE_PRESETS, WindowSizePreset } from '../../utils/windowSize';

const MAX_STORAGE_VALUE_LENGTH = 10000;

function sanitizeForStorage(value: unknown): string {
    if (typeof value !== 'string') return '';
    return decodeURIComponent(encodeURIComponent(value))
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .slice(0, MAX_STORAGE_VALUE_LENGTH);
}

interface SettingsTabProps {
    isAutostartEnabled: boolean;
    setIsAutostartEnabled: (enabled: boolean) => void;
    minimizeToTray: boolean;
    toggleMinimizeToTray: () => void;
    latestVersion: string;
    clientVersion: string;
    addLog: (msg: string) => void;
    showToast?: (text: string, type: string) => void;
    lcuRequest?: (method: string, endpoint: string, body?: Record<string, unknown>) => Promise<unknown>;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
    isAutostartEnabled, setIsAutostartEnabled,
    minimizeToTray, toggleMinimizeToTray,
    latestVersion, clientVersion, addLog,
    showToast, lcuRequest
}) => {
    const [autoEnforce, setAutoEnforce] = useState(() => localStorage.getItem(SAVED_AUTO_ENFORCE_KEY) === 'true');
    const [pluginInstalled, setPluginInstalled] = useState(() => localStorage.getItem(PENGU_PLUGIN_INSTALLED_KEY) === 'true');
    const [windowSizePreset, setWindowSizePreset] = useState<WindowSizePreset>(getSavedWindowSizePreset);

    const changeWindowSize = async (value: WindowSizePreset) => {
        try {
            await applyWindowSizePreset(value);
            localStorage.setItem(SAVED_WINDOW_SIZE_KEY, value);
            setWindowSizePreset(value);
            const preset = WINDOW_SIZE_PRESETS.find(item => item.value === value);
            addLog(`Window size changed to ${preset?.width}x${preset?.height}.`);
            showToast?.("Window size updated!", "success");
        } catch (err) {
            addLog(`Window resize failed: ${err}`);
            showToast?.("Window resize failed", "error");
        }
    };

    const toggleAutoEnforce = (checked: boolean) => {
        setAutoEnforce(checked);
        localStorage.setItem(SAVED_AUTO_ENFORCE_KEY, checked.toString());
        if (checked) {
            addLog(`Auto-Enforcer enabled.`);
        } else {
            localStorage.removeItem(SAVED_ENFORCE_OFFLINE_KEY);
            addLog(`Auto-Enforcer disabled.`);
        }
    };

    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [resetChecks, setResetChecks] = useState<Record<string, boolean>>({
        rank: true,
        overview: true,
        challenge: true,
        background: true,
        tokens: true,
        icon: true,
        status: true,
        enforcer: true,
    });

    const resetLabels: Record<string, string> = {
        rank: "Rank overrides",
        overview: "Overview Cards",
        challenge: "Challenge overrides",
        background: "Background skin & custom",
        tokens: "Tokens, Title, Banner & Crest",
        icon: "Profile icon",
        status: "Status & Bio",
        enforcer: "Auto-Enforcer & localStorage",
    };

    const resetChatPresence = async (): Promise<void> => {
        if (!lcuRequest) return;
        const promises: Promise<unknown>[] = [];

        const hasLolFields = resetChecks.rank || resetChecks.challenge || resetChecks.background;
        if (hasLolFields) {
            promises.push(patchChatLol(lcuRequest, (current) => {
                const updated: Record<string, unknown> = { ...current };
                if (resetChecks.rank) {
                    updated.rankedLeagueTier = "";
                    updated.rankedLeagueDivision = "";
                    updated.rankedLeagueQueue = "";
                }
                if (resetChecks.challenge) {
                    updated.challengeCrystalLevel = "";
                    updated.challengePoints = "";
                }
                if (resetChecks.background) {
                    updated.backgroundSkinId = "";
                }
                return updated;
            }));
        }

        if (resetChecks.status) {
            promises.push(lcuRequest("PUT", "/lol-chat/v1/me", {
                availability: "chat",
                statusMessage: ""
            }));
        }

        await Promise.allSettled(promises);
    };

    const clearAllSettings = async () => {
        const savedIconVal = resetChecks.icon ? localStorage.getItem(SAVED_ICON_KEY) : null;
        let overviewCards: Record<string, unknown> = {};
        try {
            overviewCards = JSON.parse(localStorage.getItem(SAVED_OVERVIEW_CARDS_KEY) || '{}') as Record<string, unknown>;
        } catch {
            overviewCards = {};
        }

        if (resetChecks.enforcer) {
            ALL_SAVED_KEYS.forEach(key => localStorage.removeItem(key));
            setAutoEnforce(false);
        }

        if (resetChecks.rank) {
            [SAVED_RANK_QUEUE_KEY, SAVED_RANK_TIER_KEY, SAVED_RANK_DIV_KEY, SAVED_RANK_LP_KEY, SAVED_LAST_SEASON_RANK_KEY, SAVED_RANK_BORDER_KEY, SAVED_RANK_BANNER_KEY].forEach(key => localStorage.removeItem(key));
        }

        if (resetChecks.overview) {
            localStorage.removeItem(SAVED_OVERVIEW_CARDS_KEY);
            localStorage.removeItem(PENGU_OVERVIEW_OVERRIDE_KEY);
        }

        if (resetChecks.background) {
            localStorage.removeItem(SAVED_CUSTOM_BACKGROUND_KEY);
            try {
                await invoke("clear_custom_background");
            } catch (err) {
                addLog(`Custom background reset skipped: ${err}`);
            }
        }

        if (resetChecks.rank || resetChecks.overview) {
            try {
                await invoke("save_rank_config", {
                    tier: resetChecks.rank ? "NONE" : localStorage.getItem(SAVED_RANK_TIER_KEY) || "NONE",
                    division: resetChecks.rank ? "I" : localStorage.getItem(SAVED_RANK_DIV_KEY) || "I",
                    queue: resetChecks.rank ? "RANKED_SOLO_5x5" : localStorage.getItem(SAVED_RANK_QUEUE_KEY) || "RANKED_SOLO_5x5",
                    leaguePoints: resetChecks.rank ? 0 : Number(localStorage.getItem(SAVED_RANK_LP_KEY)) || 0,
                    lastSeasonTier: resetChecks.rank ? "UNRANKED" : localStorage.getItem(SAVED_LAST_SEASON_RANK_KEY) || "UNRANKED",
                    borderTier: resetChecks.rank ? "AUTO" : localStorage.getItem(SAVED_RANK_BORDER_KEY) || "AUTO",
                    bannerTier: resetChecks.rank ? "AUTO" : localStorage.getItem(SAVED_RANK_BANNER_KEY) || "AUTO",
                    honorLevel: resetChecks.overview ? "AUTO" : String(overviewCards.honorLevel || "AUTO"),
                    masteryScore: resetChecks.overview ? "" : String(overviewCards.masteryScore || ""),
                    masteryLevel: resetChecks.overview ? "AUTO" : String(overviewCards.masteryLevel || "AUTO"),
                    masteryLevel2: resetChecks.overview ? "AUTO" : String(overviewCards.masteryLevel2 || "AUTO"),
                    masteryLevel3: resetChecks.overview ? "AUTO" : String(overviewCards.masteryLevel3 || "AUTO"),
                    masteryChampionId: resetChecks.overview ? "AUTO" : String(overviewCards.masteryChampionId || "AUTO"),
                    masteryChampionId2: resetChecks.overview ? "AUTO" : String(overviewCards.masteryChampionId2 || "AUTO"),
                    masteryChampionId3: resetChecks.overview ? "AUTO" : String(overviewCards.masteryChampionId3 || "AUTO"),
                    trophyTheme: resetChecks.overview ? "AUTO" : String(overviewCards.trophyTheme || "AUTO"),
                    trophyBracket: resetChecks.overview ? 4 : Number(overviewCards.trophyBracket) || 4,
                    trophyTier: resetChecks.overview ? 4 : Number(overviewCards.trophyTier) || 4,
                    clashBannerTheme: resetChecks.overview ? "AUTO" : String(overviewCards.clashBannerTheme || "AUTO"),
                    clashBannerLevel: resetChecks.overview ? 1 : Number(overviewCards.clashBannerLevel) || 1,
                    overviewEnabled: resetChecks.overview ? false : localStorage.getItem(PENGU_OVERVIEW_OVERRIDE_KEY) !== "false",
                });
            } catch (err) {
                // Pengu Loader may not be installed; the LCU reset still proceeds.
                addLog(`Rank override config reset skipped: ${err}`);
            }
        }

        if (!lcuRequest) {
            addLog("Saved settings cleared.");
            showToast?.("Saved settings cleared!", "success");
            setShowResetConfirm(false);
            return;
        }

        const promises: Promise<unknown>[] = [];

        const hasChatFields = resetChecks.rank || resetChecks.challenge || resetChecks.background || resetChecks.status;
        if (hasChatFields) promises.push(resetChatPresence());

        if (resetChecks.background) {
            promises.push(lcuRequest("POST", "/lol-summoner/v1/current-summoner/summoner-profile", {
                key: "backgroundSkinId",
                value: 0,
            }));
        }

        if (resetChecks.tokens) {
            promises.push(lcuRequest("POST", "/lol-challenges/v1/update-player-preferences", {
                challengeIds: [],
                title: "",
                bannerAccent: "",
                crestBorder: "",
                prestigeCrestBorderLevel: 0,
            }));
        }

        if (resetChecks.icon) {
            const iconId = savedIconVal ? Number.parseInt(savedIconVal, 10) : 0;
            if (!Number.isNaN(iconId)) {
                promises.push(lcuRequest("PUT", "/lol-summoner/v1/current-summoner/icon", {
                    profileIconId: iconId,
                }));
            }
        }

        await Promise.allSettled(promises);
        addLog("Saved settings cleared.");
        showToast?.("Saved settings cleared!", "success");
        setShowResetConfirm(false);
    };

    const exportSettings = async () => {
        try {
            const data: Record<string, string | null> = {};
            ALL_SAVED_KEYS.forEach(key => { data[key] = localStorage.getItem(key); });
            const json = JSON.stringify(data, null, 2);
            const defaultName = `league-profile-settings-${new Date().toISOString().slice(0, 10)}.json`;
            const path = await save({
                defaultPath: defaultName,
                filters: [{ name: "JSON", extensions: ["json"] }]
            });
            if (!path) return;
            const target = Array.isArray(path) ? path[0] : path;
            await invoke("save_logs_to_path", { path: target, content: json });
            addLog(`Settings exported to: ${target}`);
            showToast?.("Settings exported!", "success");
        } catch (err) {
            addLog(`Settings export failed: ${err}`);
            showToast?.("Settings export failed", "error");
        }
    };

    const importSettings = async () => {
        try {
            const path = await open({
                filters: [{ name: "JSON", extensions: ["json"] }],
                multiple: false,
            });
            if (!path) return;
            const target = Array.isArray(path) ? path[0] : path;
            const text = await invoke<string>("read_text_file", { path: target });
            const data = JSON.parse(text) as Record<string, string | null>;
            ALL_SAVED_KEYS.forEach(key => {
                if (key in data) {
                    if (data[key] === null) {
                        localStorage.removeItem(key);
                    } else {
                        localStorage.setItem(key, sanitizeForStorage(data[key]));
                    }
                }
            });
            setAutoEnforce(localStorage.getItem(SAVED_AUTO_ENFORCE_KEY) === 'true');
            addLog("Settings imported successfully.");
            showToast?.("Settings imported! Restart for full effect.", "success");
        } catch (err) {
            addLog(`Settings import failed: ${err}`);
            showToast?.("Settings import failed", "error");
        }
    };

    return (
        <div className="tab-content fadeIn ui-page">
            <div className="ui-page-header">
                <div className="ui-page-header__copy">
                    <h2 className="ui-page-header__title">Settings</h2>
                    <p className="ui-page-header__description">Configure startup behavior, backups, integrations, and saved profile data.</p>
                </div>
            </div>

            <div className="card ui-panel">
                <div className="ui-section-header">
                    <div className="ui-section-header__icon">
                        <Cpu size={16} style={{ color: 'var(--hextech-gold)' }} />
                    </div>
                    <div className="ui-section-header__copy">
                        <h3 className="ui-section-header__title">Technical Settings</h3>
                        <p className="ui-section-header__description">Choose how the application behaves in Windows and with the League Client.</p>
                    </div>
                </div>
                <button type="button" className="settings-row ui-settings-row" onClick={async () => {
                    const newState = !isAutostartEnabled;
                    try {
                        if (newState) await enable(); else await disable();
                        setIsAutostartEnabled(newState);
                        addLog(`Auto-launch ${newState ? 'enabled' : 'disabled'}.`);
                    } catch (err) {
                        addLog(`Failed to toggle auto-launch: ${err}`);
                        showToast?.(`Failed to toggle auto-launch: ${err}`, "error");
                    }
                }}>
                    <div className="settings-info">
                        <span className="settings-label">Auto-launch</span>
                        <p className="settings-desc">Launch the app automatically when your PC starts.</p>
                    </div>
                    <span className="switch">
                        <span className="sr-only">Toggle Auto-launch</span>
                        <input type="checkbox" checked={isAutostartEnabled} readOnly />
                        <span className="slider"></span>
                    </span>
                </button>

                <button type="button" className="settings-row ui-settings-row" onClick={toggleMinimizeToTray}>
                    <div className="settings-info">
                        <span className="settings-label">Minimize to Tray</span>
                        <p className="settings-desc">Close button will minimize the app to the system tray.</p>
                    </div>
                    <span className="switch">
                        <span className="sr-only">Toggle Minimize to Tray</span>
                        <input type="checkbox" checked={minimizeToTray} readOnly />
                        <span className="slider"></span>
                    </span>
                </button>

                <div className="settings-row ui-settings-row settings-window-size-row">
                    <AppWindow size={18} style={{ color: 'var(--hextech-gold)', flexShrink: 0 }} />
                    <div className="settings-info">
                        <label className="settings-label" htmlFor="window-size-preset">Default Window Size</label>
                        <p className="settings-desc">Applied immediately and restored whenever the app starts.</p>
                    </div>
                    <select id="window-size-preset" className="window-size-select" value={windowSizePreset} onChange={(event) => changeWindowSize(event.target.value as WindowSizePreset)}>
                        {WINDOW_SIZE_PRESETS.map(preset => <option key={preset.value} value={preset.value}>{preset.label} - {preset.width} x {preset.height}</option>)}
                    </select>
                </div>

                <button type="button" className="settings-row ui-settings-row" onClick={() => toggleAutoEnforce(!autoEnforce)}>
                    <div className="settings-info">
                        <span className="settings-label">Auto-Restore Profile</span>
                        <p className="settings-desc">Automatically re-apply profile overrides (rank, icons, status) when the League Client opens.</p>
                    </div>
                    <span className="switch">
                        <span className="sr-only">Toggle Auto Restore</span>
                        <input type="checkbox" checked={autoEnforce} readOnly />
                        <span className="slider"></span>
                    </span>
                </button>

                {showResetConfirm ? (
                    <div style={{ marginTop: '10px', padding: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.18)', borderRadius: '10px' }}>
                        <span className="settings-label" style={{ color: '#f87171', marginBottom: '12px', display: 'block' }}>What to clear?</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 16px' }}>
                            {Object.entries(resetLabels).map(([key, label]) => (
                                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                    <input type="checkbox" checked={resetChecks[key]} onChange={() => setResetChecks(prev => ({ ...prev, [key]: !prev[key] }))} style={{ accentColor: '#ef4444' }} />
                                    {label}
                                </label>
                            ))}
                        </div>
                        <div className="settings-confirm-actions" style={{ marginTop: '14px' }}>
                            <button type="button" className="ghost-btn" style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.25)', display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px' }} onClick={clearAllSettings}><Check size={14} />Clear Selected</button>
                            <button type="button" className="ghost-btn" onClick={() => setShowResetConfirm(false)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px' }}><X size={14} />Cancel</button>
                        </div>
                    </div>
                ) : (
                    <button type="button" className="settings-row ui-settings-row settings-row--danger" onClick={() => setShowResetConfirm(true)}>
                        <div className="settings-info">
                            <span className="settings-label">Clear Saved Data</span>
                            <p className="settings-desc">Reset profile overrides, rank, tokens, status, icon &amp; more</p>
                        </div>
                        <Trash2 size={18} style={{ color: '#ff6b6b', flexShrink: 0, marginLeft: '16px' }} />
                    </button>
                )}
            </div>

            <div className="card ui-panel">
                <div className="ui-section-header settings-backup-row" style={{ marginBottom: 0 }}>
                    <div className="ui-section-header__icon">
                            <Download size={16} style={{ color: 'var(--hextech-gold)' }} />
                    </div>
                    <div className="ui-section-header__copy">
                        <h3 className="ui-section-header__title">Backup &amp; Restore</h3>
                        <p className="ui-section-header__description">Export your saved profile settings or restore them from a JSON backup.</p>
                    </div>
                    <div className="ui-section-header__actions settings-backup-actions">
                        <button type="button" className="ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 15px' }} onClick={exportSettings}>
                            <Download size={15} /> Export
                        </button>
                        <button type="button" className="ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 15px' }} onClick={importSettings}>
                            <Upload size={15} /> Import
                        </button>
                    </div>
                </div>
            </div>

            <div className="card ui-panel">
                <div className="ui-section-header settings-integration-header">
                    <div className="ui-section-header__icon">
                            <Puzzle size={16} style={{ color: 'var(--hextech-gold)' }} />
                    </div>
                    <div className="ui-section-header__copy">
                        <h3 className="ui-section-header__title">Pengu Loader Integration</h3>
                        <p className="ui-section-header__description">Required to display custom ranks in the League profile overview.</p>
                    </div>
                    <span className="ui-section-header__actions" style={{ padding: '4px 9px', borderRadius: '999px', background: pluginInstalled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: pluginInstalled ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)', color: pluginInstalled ? '#22c55e' : '#f59e0b', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {pluginInstalled ? 'PLUGIN READY' : 'SETUP REQUIRED'}
                    </span>
                </div>
                <p className="settings-desc" style={{ margin: '0 0 14px', lineHeight: 1.5 }}>
                    Install the Rank Override plugin to show custom ranks in the League client's profile overview.
                    Requires <a href="https://github.com/PenguLoader/PenguLoader" target="_blank" rel="noreferrer" style={{ color: 'var(--hextech-gold)' }}>Pengu Loader</a> to be installed.
                    {pluginInstalled && (
                        <span style={{ color: '#22c55e', marginLeft: '8px' }}>✓ Plugin installed</span>
                    )}
                </p>
                
                <div className="settings-integration-actions">
                    <button 
                        type="button" 
                        className="ghost-btn" 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 15px' }}
                        onClick={async () => {
                            try {
                                await invoke("install_pengu_plugin");
                                localStorage.setItem(PENGU_PLUGIN_INSTALLED_KEY, 'true');
                                setPluginInstalled(true);
                                addLog("Pengu Loader plugin installed successfully.");
                                showToast?.("Plugin installed! Restart League Client.", "success");
                            } catch (err) {
                                addLog(`Plugin install failed: ${err}`);
                                showToast?.(`Install failed: ${err}`, "error");
                            }
                        }}
                    >
                        <Puzzle size={16} /> {pluginInstalled ? 'Reinstall Plugin' : 'Install Plugin'}
                    </button>
                    
                    <button 
                        type="button" 
                        className="ghost-btn" 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 15px' }}
                        onClick={async () => {
                            try {
                                await invoke("open_pengu_plugins_folder");
                                addLog("Opened Pengu Loader plugins folder.");
                            } catch (err) {
                                addLog(`Failed to open plugins folder: ${err}`);
                                showToast?.(`Failed to open folder: ${err}`, "error");
                            }
                        }}
                    >
                        <FolderOpen size={16} /> Open Plugins Folder
                    </button>
                    
                    <a 
                        href="https://github.com/PenguLoader/PenguLoader/releases" 
                        target="_blank" 
                        rel="noreferrer"
                        className="ghost-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 15px', textDecoration: 'none' }}
                    >
                        <ExternalLink size={16} /> Download Pengu Loader
                    </a>
                </div>
                
                <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(0,0,0,0.22)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    <strong style={{ color: 'var(--hextech-gold)' }}>Manual Installation:</strong><br />
                    Copy the complete <code>rank-override</code> folder to <code>C:\Program Files\Pengu Loader\plugins\rank-override\</code>.<br />
                    Restart the League Client and enable <strong>Profile Overview</strong> from the Rank tab.
                </div>
            </div>

            {latestVersion && clientVersion !== latestVersion && (
                <div className="card update-panel-hero">
                    <div className="update-content">
                        <div className="update-intel">
                            <RefreshCw size={24} className="intel-spinner" />
                            <div>
                                <h3 className="update-title-hero">New Enhancement Available</h3>
                                <p className="update-desc-hero">A fresh build of the toolkit is ready to be installed (<b>v{latestVersion}</b>).</p>
                            </div>
                        </div>
                        <a href="https://github.com/lenny-ts/league_profile_tool/releases/latest" target="_blank" rel="noreferrer" className="update-action-btn-hero">
                            UPDATE NOW
                        </a>
                    </div>
                </div>
            )}

        </div>
    );
};

export default React.memo(SettingsTab);

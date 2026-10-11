import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { LcuInfo } from '../../hooks/useLcu';
import { Save, FolderOpen, Trash2, CheckCircle2 } from 'lucide-react';
import { patchChatLol, LcuRequestFn } from '../../utils/chatMe';
import { disableCustomBackground } from '../../utils/disableCustomBackground';
import {
    SAVED_AVAILABILITY_KEY,
    SAVED_BIO_KEY,
    SAVED_ICON_KEY,
    SAVED_BACKGROUND_KEY,
    SAVED_TOKENS_KEY,
    SAVED_TITLE_KEY
} from '../../storageKeys';

interface ChallengeSummary {
    bannerId?: string;
    crestId?: string;
    prestigeCrestBorderLevel?: number;
    preferences?: {
        bannerId?: string;
        crestId?: string;
        bannerAccent?: string;
        crestBorder?: string;
        prestigeCrestBorderLevel?: number;
    };
    bannerAccent?: string;
    crestBorder?: string;
}

interface PresetsTabProps {
    lcu: LcuInfo | null;
    showToast: (msg: string, type: 'success' | 'error') => void;
    addLog: (msg: string) => void;
    lcuRequest: LcuRequestFn;
}

interface ProfilePreset {
    id: string;
    name: string;
    bio: string | null;
    availability: string | null;
    iconId: string | null;
    backgroundId: string | null;
    tokens: string | null;
    title?: string | null;
    bannerAccent?: string | null;
    crestBorder?: string | null;
}

/** Legacy key used before disk persistence — kept for migration */
const PRESETS_LS_KEY = "profile_presets_list_v1";

const PresetsTab: React.FC<PresetsTabProps> = ({ lcu, showToast, addLog, lcuRequest }) => {
    const [presets, setPresets] = useState<ProfilePreset[]>([]);
    const [newPresetName, setNewPresetName] = useState("");
    const [saving, setSaving] = useState(false);

    // Always track the latest presets so async handlers (save/delete) don't
    // read stale state if multiple fire in quick succession.
    const presetsRef = useRef(presets);
    presetsRef.current = presets;

    /** Serialize disk writes so save/delete don't interleave and clobber each other */
    const persistMutexRef = useRef<Promise<void>>(Promise.resolve());
    const persistPresets = useCallback((updated: ProfilePreset[]) => {
        persistMutexRef.current = persistMutexRef.current.then(async () => {
            const json = JSON.stringify(updated);
            try {
                await invoke("save_presets", { data: json });
            } catch (err) {
                addLog(`Disk save failed, using localStorage fallback: ${err}`);
                localStorage.setItem(PRESETS_LS_KEY, json);
            }
            presetsRef.current = updated;
            setPresets(updated);
        });
        return persistMutexRef.current;
    }, [addLog]);

    useEffect(() => {
        const load = async () => {
            // 1. Try to load from disk (Tauri AppData)
            try {
                const raw = await invoke<string>("load_presets");
                const parsed: ProfilePreset[] = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setPresets(parsed);
                    return;
                }
            } catch (err) {
                addLog(`Disk load failed, checking localStorage: ${err}`);
            }

            // 2. Migrate from localStorage for existing users
            const lsData = localStorage.getItem(PRESETS_LS_KEY);
            if (lsData) {
                try {
                    const parsed: ProfilePreset[] = JSON.parse(lsData);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setPresets(parsed);
                        // Migrate to disk silently
                        await invoke("save_presets", { data: lsData }).catch(() => {});
                        localStorage.removeItem(PRESETS_LS_KEY);
                        addLog(`Migrated ${parsed.length} preset(s) from localStorage to disk.`);
                    }
                } catch { /* ignore parse errors */ }
            }
        };
        load();
    }, [addLog]);

    const handleSaveCurrentAsPreset = async () => {
        if (!newPresetName.trim()) {
            showToast("Please enter a name for the preset", "error");
            return;
        }
        setSaving(true);
        const newPreset: ProfilePreset = {
            id: Date.now().toString(),
            name: newPresetName.trim(),
            bio:          localStorage.getItem(SAVED_BIO_KEY),
            availability: localStorage.getItem(SAVED_AVAILABILITY_KEY),
            iconId:       localStorage.getItem(SAVED_ICON_KEY),
            backgroundId: localStorage.getItem(SAVED_BACKGROUND_KEY),
            tokens:       localStorage.getItem(SAVED_TOKENS_KEY),
            title:        localStorage.getItem(SAVED_TITLE_KEY)
        };
        const updated = [...presetsRef.current, newPreset];
        await persistPresets(updated);
        setNewPresetName("");
        showToast(`Preset "${newPreset.name}" saved!`, "success");
        addLog(`Saved preset: ${newPreset.name}`);
        setSaving(false);
    };

    const applyPresetBio = async (bio: string | null, lcuPort: string, lcuToken: string): Promise<boolean> => {
        if (bio === null) {
            localStorage.removeItem(SAVED_BIO_KEY);
            return true;
        }
        localStorage.setItem(SAVED_BIO_KEY, bio);
        try {
            await invoke("update_bio", { port: lcuPort, token: lcuToken, newBio: bio });
            return true;
        } catch (err) {
            addLog(`Failed to apply bio from preset: ${err}`);
            return false;
        }
    };

    const applyPresetAvailability = async (availability: string | null): Promise<boolean> => {
        if (availability === null) {
            localStorage.removeItem(SAVED_AVAILABILITY_KEY);
            return true;
        }
        localStorage.setItem(SAVED_AVAILABILITY_KEY, availability);
        try {
            await lcuRequest("PUT", "/lol-chat/v1/me", { availability });
            return true;
        } catch (err) {
            addLog(`Failed to apply availability from preset: ${err}`);
            return false;
        }
    };

    const applyPresetIcon = async (iconId: string | null): Promise<boolean> => {
        if (iconId === null) {
            localStorage.removeItem(SAVED_ICON_KEY);
            return true;
        }
        localStorage.setItem(SAVED_ICON_KEY, iconId);
        try {
            await lcuRequest("PUT", "/lol-summoner/v1/current-summoner/icon", { profileIconId: Number.parseInt(iconId, 10) });
            return true;
        } catch (err) {
            addLog(`Official icon update failed (${err}). Trying force method...`);
            try {
                await lcuRequest("PUT", "/lol-chat/v1/me", { icon: Number.parseInt(iconId, 10) });
                return true;
            } catch (forceErr) {
                addLog(`Failed to apply icon from preset (Force): ${forceErr}`);
                return false;
            }
        }
    };

    const applyPresetBackground = async (backgroundId: string | null): Promise<boolean> => {
        if (backgroundId === null) {
            localStorage.removeItem(SAVED_BACKGROUND_KEY);
            return true;
        }
        try {
            await lcuRequest('POST', '/lol-summoner/v1/current-summoner/summoner-profile', {
                key: 'backgroundSkinId',
                value: Number.parseInt(backgroundId, 10)
            });
        } catch (err) {
            addLog(`Official background update failed (${err}). Trying force method...`);
            try {
                await patchChatLol(lcuRequest, (current) => ({
                    ...current,
                    backgroundSkinId: backgroundId,
                }));
            } catch (forceErr) {
                addLog(`Failed to apply background from preset (Force): ${forceErr}`);
                return false;
            }
        }
        localStorage.setItem(SAVED_BACKGROUND_KEY, backgroundId);
        try {
            await disableCustomBackground();
        } catch (err) {
            addLog(`Preset skin saved, but custom background could not be removed: ${err}`);
            return false;
        }
        return true;
    };

    const applyPresetTokensAndTitle = async (
        tokens: string | null,
        title?: string | null
    ): Promise<boolean> => {
        const payload: Record<string, unknown> = {};

        if (tokens === null) {
            localStorage.removeItem(SAVED_TOKENS_KEY);
        } else {
            localStorage.setItem(SAVED_TOKENS_KEY, tokens);
            try {
                payload.challengeIds = JSON.parse(tokens);
            } catch (e) {
                console.debug("Failed to parse preset tokens JSON:", e);
            }
        }

        if (title !== null && title !== undefined && title !== "-1") {
            localStorage.setItem(SAVED_TITLE_KEY, title);
            payload.title = title;
        } else {
            localStorage.removeItem(SAVED_TITLE_KEY);
        }
        // The update endpoint does a FULL REPLACE — merge current preferences
        // so we don't reset banner/crest/prestige.
        try {
            const summary = await lcuRequest("GET", "/lol-challenges/v1/summary-player-data/local-player") as ChallengeSummary | null;
            if (summary) {
                payload.bannerAccent = payload.bannerAccent ?? summary.bannerId ?? summary.preferences?.bannerId ?? summary.bannerAccent ?? summary.preferences?.bannerAccent ?? "";
                payload.crestBorder = payload.crestBorder ?? summary.crestId ?? summary.preferences?.crestId ?? summary.crestBorder ?? summary.preferences?.crestBorder ?? "";
                payload.prestigeCrestBorderLevel = payload.prestigeCrestBorderLevel ?? summary.prestigeCrestBorderLevel ?? summary.preferences?.prestigeCrestBorderLevel ?? 0;
            }
        } catch (err) {
            addLog(`Warning: Could not read current preferences to merge in preset: ${err}`);
        }

        if (Object.keys(payload).length === 0) {
            return true;
        }

        try {
            await lcuRequest("POST", "/lol-challenges/v1/update-player-preferences", payload);
        } catch (err) {
            addLog(`Failed to apply tokens/title from preset: ${err}`);
            return false;
        }
        return true;
    };

    const handleLoadPreset = async (preset: ProfilePreset) => {
        if (!lcu) {
            showToast("Connect League client first", "error");
            return;
        }

        const bioOk = await applyPresetBio(preset.bio, lcu.port, lcu.token);
        const availOk = await applyPresetAvailability(preset.availability);
        const iconOk = await applyPresetIcon(preset.iconId);
        const bgOk = await applyPresetBackground(preset.backgroundId);
        const tokensOk = await applyPresetTokensAndTitle(preset.tokens, preset.title);

        const hasError = !bioOk || !availOk || !iconOk || !bgOk || !tokensOk;

        if (hasError) {
            showToast(`Preset "${preset.name}" applied partially (see logs).`, "error");
        } else {
            showToast(`Preset "${preset.name}" applied successfully!`, "success");
        }
        addLog(`Finished loading preset: ${preset.name}.`);
    };

    const handleDeletePreset = async (id: string) => {
        const updated = presetsRef.current.filter(p => p.id !== id);
        await persistPresets(updated);
        showToast("Preset deleted.", "success");
    };

    return (
        <div className="tab-content fadeIn">
            {/* Save current setup */}
            <div className="card" style={{ marginBottom: '12px' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FolderOpen size={20} style={{ color: 'var(--hextech-gold)' }} />
                    Profile Presets
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                    Save your current profile setup (Bio, Icon, Background, Tokens, Status).
                    Presets are stored on disk and persist across reinstalls and future updates.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        placeholder="e.g. 'Edgy Setup' or 'Ranked Mode'"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveCurrentAsPreset()}
                        style={{ flex: 1 }}
                    />
                    <button type="button"
                        className="primary-btn"
                        onClick={handleSaveCurrentAsPreset}
                        disabled={saving || !newPresetName.trim()}
                        style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '12px 20px' }}
                    >
                        <Save size={16} />
                        {saving ? 'SAVING...' : 'SAVE PRESET'}
                    </button>
                </div>
            </div>

            {/* Preset list */}
            <div className="card">
                <h3 className="card-title">Your Presets</h3>

                {presets.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                        <FolderOpen size={48} style={{ margin: '0 auto 15px auto', opacity: 0.5 }} />
                        <p style={{ margin: '0 0 8px 0' }}>No presets saved yet.</p>
                        <p style={{ fontSize: '0.8rem', margin: 0 }}>Customize your profile in the other tabs, then save it here.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                        {presets.map(preset => {
                            const iconUrl = preset.iconId
                                ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${preset.iconId}.jpg`
                                : null;

                            let bgUrl: string | null = null;
                            if (preset.backgroundId) {
                                const bgIdNum = Number.parseInt(preset.backgroundId, 10);
                                if (!Number.isNaN(bgIdNum)) {
                                    const champId = Math.floor(bgIdNum / 1000);
                                    bgUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/${champId}/${bgIdNum}.jpg`;
                                }
                            }

                            return (
                                <div
                                    key={preset.id}
                                    style={{
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        background: '#1a1a1c',
                                        border: '1px solid rgba(200, 170, 110, 0.4)',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        minHeight: '200px',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                                        transition: 'transform 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    {bgUrl && (
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                            backgroundImage: `url(${bgUrl})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center 20%',
                                            opacity: 0.5, zIndex: 0
                                        }} />
                                    )}
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                        background: 'linear-gradient(to bottom, rgba(10,10,12,0.1) 0%, rgba(10,10,12,0.95) 100%)',
                                        zIndex: 1
                                    }} />

                                    <div style={{ position: 'relative', zIndex: 2, padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '15px' }}>
                                            <div style={{
                                                width: '60px', height: '60px', borderRadius: '50%',
                                                border: '2px solid var(--hextech-gold)',
                                                background: '#0a0a0c', overflow: 'hidden', flexShrink: 0
                                            }}>
                                                {iconUrl ? (
                                                    <img src={iconUrl} alt="Icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>?</div>
                                                )}
                                            </div>
                                            <div style={{ flex: 1, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                                <h4 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#fff', letterSpacing: '0.5px' }}>{preset.name}</h4>
                                                {preset.availability && (() => {
                                                    const getBadgeStyles = (avail: string) => {
                                                        if (avail === 'chat') return { background: 'rgba(40, 167, 69, 0.2)', color: '#28a745' };
                                                        if (avail === 'away') return { background: 'rgba(220, 53, 69, 0.2)', color: '#dc3545' };
                                                        return { background: 'rgba(255, 255, 255, 0.1)', color: '#aaa' };
                                                    };
                                                    const badgeStyle = getBadgeStyles(preset.availability);
                                                    return (
                                                        <span style={{
                                                            fontSize: '0.7rem', textTransform: 'uppercase', padding: '2px 6px',
                                                            borderRadius: '3px',
                                                            ...badgeStyle,
                                                            border: '1px solid currentColor'
                                                        }}>
                                                            {preset.availability}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {preset.bio && (
                                            <p style={{ margin: '0 0 15px 0', fontSize: '0.82rem', color: '#ddd', fontStyle: 'italic', textShadow: '0 1px 3px rgba(0,0,0,0.8)', flex: 1 }}>
                                                "{preset.bio}"
                                            </p>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid rgba(200, 170, 110, 0.2)', paddingTop: '12px' }}>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                {preset.tokens && (
                                                    <div style={{ display: 'flex', gap: '4px' }} title="Has equipped tokens">
                                                        {[0,1,2].map(i => <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--hextech-gold)' }} />)}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button type="button"
                                                    className="primary-btn"
                                                    onClick={() => handleLoadPreset(preset)}
                                                    style={{ padding: '6px 14px', fontSize: '0.75rem', display: 'flex', gap: '5px', alignItems: 'center' }}
                                                    disabled={!lcu}
                                                    title={lcu ? 'Load preset' : 'Connect League client first'}
                                                >
                                                    <CheckCircle2 size={13} /> LOAD
                                                </button>
                                                <button type="button"
                                                    onClick={() => handleDeletePreset(preset.id)}
                                                    style={{ padding: '6px', background: 'rgba(220, 53, 69, 0.2)', color: '#ff6b6b', border: '1px solid rgba(220, 53, 69, 0.4)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                    title="Delete preset"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(PresetsTab);

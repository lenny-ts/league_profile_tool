import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { Info, ArrowLeftRight } from 'lucide-react';
import { LcuInfo } from '../../hooks/useLcu';
import { SAVED_AVAILABILITY_KEY, SAVED_BIO_KEY, SAVED_ENFORCE_OFFLINE_KEY, SAVED_USE_IDLE_AS_BIO_KEY } from '../../storageKeys';
import { AutoExpandingTextarea } from '../../hooks/useAutoGrowingTextarea';
import { useAppStore } from '../../store';
import { truncateBio } from '../../hooks/useMusicSync';

interface ProfileTabProps {
    lcu: LcuInfo | null;
    showToast: (text: string, type: string) => void;
    addLog: (msg: string) => void;
    lcuRequest: (method: string, endpoint: string, body?: Record<string, unknown>) => Promise<unknown>;
    musicSyncActive?: boolean;
}

const ProfileTab: React.FC<ProfileTabProps> = ({ lcu, showToast, addLog, lcuRequest, musicSyncActive = false }) => {
    const [bio, setBio] = useState(() => localStorage.getItem(SAVED_BIO_KEY) ?? "");
    const [availability, setAvailability] = useState("chat");
    const [loading, setLoading] = useState(false);
    const [enforceOffline, setEnforceOffline] = useState(() => localStorage.getItem(SAVED_ENFORCE_OFFLINE_KEY) === 'true');
    const [useIdleAsBio, setUseIdleAsBio] = useState(() => localStorage.getItem(SAVED_USE_IDLE_AS_BIO_KEY) === 'true');
    const bioDirtyRef = useRef(false);

    const musicBio = useAppStore(s => s.musicBio);
    const setMusicBio = useAppStore(s => s.setMusicBio);

    const statusLabel = useCallback((value: string) => {
        switch (value) {
            case "chat":    return "ONLINE";
            case "away":    return "AWAY";
            case "mobile":  return "MOBILE";
            case "offline": return "OFFLINE";
            default:        return value.toUpperCase();
        }
    }, []);

    const refreshProfileData = useCallback(async () => {
        if (!lcu) return;
        try {
            const chatRes = await lcuRequest("GET", "/lol-chat/v1/me") as Record<string, unknown>;
            if (chatRes?.availability) setAvailability(chatRes.availability as string);
            if (!bioDirtyRef.current) {
                const lcuBio = (chatRes?.statusMessage as string) || "";
                if (lcuBio.trim()) {
                    setBio(lcuBio);
                    localStorage.setItem(SAVED_BIO_KEY, lcuBio);
                }
            }
        } catch (err) {
            addLog(`Profile sync failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }, [lcu, lcuRequest, addLog]);

    useEffect(() => {
        refreshProfileData();
    }, [refreshProfileData]);

    const handleUpdateBio = useCallback(async () => {
        if (!lcu) return;
        setLoading(true);
        try {
            const bioToApply = useIdleAsBio ? musicBio.idleText : bio;
            const truncated = truncateBio(bioToApply.trim());
            await invoke("update_bio", { port: lcu.port, token: lcu.token, newBio: truncated });
            localStorage.setItem(SAVED_BIO_KEY, truncated);
            bioDirtyRef.current = false;
            addLog(`Bio updated: "${truncated}"`);
            showToast("Bio Updated!", "success");
        } catch (err: unknown) {
            showToast("Failed to update bio", "error");
            addLog(`Bio update failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally { setLoading(false); }
    }, [lcu, bio, useIdleAsBio, musicBio.idleText, addLog, showToast]);

    const applyAvailability = useCallback(async (next?: string) => {
        if (!lcu) return;
        const target = (next || availability).trim();
        if (!target) return;
        const previous = availability;
        if (next) setAvailability(next);
        setLoading(true);
        try {
            await lcuRequest("PUT", "/lol-chat/v1/me", { availability: target });
            localStorage.setItem(SAVED_AVAILABILITY_KEY, target);
            showToast(`Status set to ${statusLabel(target)}`, "success");
            addLog(`Status updated: ${statusLabel(target)}.`);
        } catch (err) {
            if (next) setAvailability(previous);
            showToast("Failed to update status", "error");
            addLog(`Status update failed: ${err}`);
        } finally {
            setLoading(false);
        }
    }, [lcu, availability, statusLabel, addLog, showToast]);

    const toggleEnforceOffline = useCallback((checked: boolean) => {
        setEnforceOffline(checked);
        localStorage.setItem(SAVED_ENFORCE_OFFLINE_KEY, checked.toString());
        addLog(`Enforce offline ${checked ? 'enabled' : 'disabled'}.`);
    }, [addLog]);

    const toggleUseIdleAsBio = useCallback((checked: boolean) => {
        setUseIdleAsBio(checked);
        localStorage.setItem(SAVED_USE_IDLE_AS_BIO_KEY, checked.toString());
        addLog(`Use idle text as bio ${checked ? 'enabled' : 'disabled'}.`);
    }, [addLog]);

    const isBusy = musicSyncActive && !useIdleAsBio;

    return (
        <div className="tab-content fadeIn" style={{ padding: '0 20px 40px 20px' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Profile Bio & Status</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Update your status message and chat availability.</p>
            </div>

            {/* Music Sync Warning */}
            {isBusy && (
                <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '10px', fontSize: '0.8rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Info size={16} style={{ flexShrink: 0 }} />
                    <span>Music Sync is active — it controls your bio. Disable it to use this editor.</span>
                </div>
            )}

            {/* Bio Editor Card */}
            <div className="card" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '0.85rem' }}>Status Message</h3>
                </div>

                {/* Music Sync Toggle */}
                <div style={{ 
                    marginBottom: '16px', padding: '14px 16px', 
                    background: useIdleAsBio ? 'rgba(59, 130, 246, 0.06)' : 'rgba(0, 0, 0, 0.15)',
                    border: `1px solid ${useIdleAsBio ? 'rgba(59, 130, 246, 0.25)' : 'var(--glass-border)'}`,
                    borderRadius: '12px', transition: 'all 0.25s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <div style={{ 
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: useIdleAsBio ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: useIdleAsBio ? 'var(--hextech-gold)' : 'var(--text-secondary)',
                            transition: 'all 0.25s ease', flexShrink: 0
                        }}>
                            <ArrowLeftRight size={15} />
                        </div>
                        <div>
                            <span style={{ 
                                fontSize: '0.82rem', fontWeight: 600,
                                color: useIdleAsBio ? 'var(--text-primary)' : 'var(--text-secondary)',
                                transition: 'color 0.2s', display: 'block', lineHeight: 1.3
                            }}>
                                Use Music Sync idle text as bio
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                                {useIdleAsBio ? "Active — editing idle text" : "Toggle to use idle text instead"}
                            </span>
                        </div>
                    </div>
                    
                    {/* Custom Toggle Switch */}
                    <button
                        type="button"
                        aria-label="Use Music Sync idle text as bio"
                        aria-pressed={useIdleAsBio}
                        onClick={() => toggleUseIdleAsBio(!useIdleAsBio)}
                        disabled={!lcu || loading}
                        style={{
                            width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: useIdleAsBio ? 'var(--hextech-gold)' : 'rgba(255, 255, 255, 0.1)',
                            position: 'relative', transition: 'all 0.25s ease', flexShrink: 0,
                            boxShadow: useIdleAsBio ? '0 0 12px rgba(59, 130, 246, 0.3)' : 'none'
                        }}
                    >
                        <span style={{
                            position: 'absolute', top: '3px',
                            left: useIdleAsBio ? '23px' : '3px',
                            width: '18px', height: '18px', borderRadius: '50%',
                            background: useIdleAsBio ? '#09090b' : 'rgba(255, 255, 255, 0.6)',
                            transition: 'all 0.25s ease',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
                        }}></span>
                    </button>
                </div>

                {/* Bio Input */}
                <div className="input-group" style={{ marginBottom: '16px' }}>
                    {useIdleAsBio ? (
                        <AutoExpandingTextarea
                            id="idle-bio-input"
                            aria-label="Status message"
                            value={musicBio.idleText}
                            onChange={(e) => {
                                bioDirtyRef.current = true;
                                setMusicBio(prev => ({ ...prev, idleText: e.target.value }));
                            }}
                            placeholder="Enter your bio text or ASCII art here..."
                            disabled={!lcu || loading}
                            minRows={8}
                            maxRows={200}
                            style={{ background: 'rgba(0, 0, 0, 0.3)', fontFamily: 'var(--font-mono)', fontSize: '0.80rem', borderRadius: '10px' }}
                        />
                    ) : (
                        <AutoExpandingTextarea
                            id="bio-input"
                            aria-label="Status message"
                            value={bio}
                            onChange={(e) => { bioDirtyRef.current = true; setBio(e.target.value); }}
                            placeholder="Tell your friends what you're up to..."
                            disabled={!lcu || loading}
                            minRows={8}
                            maxRows={200}
                            style={{ background: 'rgba(0, 0, 0, 0.3)', fontFamily: 'var(--font-mono)', fontSize: '0.80rem', borderRadius: '10px' }}
                        />
                    )}
                </div>

                {/* Apply Button */}
                <button type="button" className="primary-btn" onClick={handleUpdateBio} disabled={!lcu || loading || (useIdleAsBio ? !musicBio.idleText.trim() : !bio.trim())} style={{ width: '100%', padding: '12px', borderRadius: '10px', fontSize: '0.8rem' }}>
                    {loading ? 'APPLYING...' : 'APPLY BIO'}
                </button>
            </div>

            {/* Availability Card */}
            {lcu && (
                <div className="card">
                    <h3 className="card-title" style={{ margin: '0 0 16px 0', fontSize: '0.85rem' }}>Chat Availability</h3>
                    
                    {/* Status Pills */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {[
                            { value: "chat",    label: "ONLINE",  color: "#22c55e" },
                            { value: "away",    label: "AWAY",    color: "#eab308" },
                            { value: "mobile",  label: "MOBILE",  color: "#3b82f6" },
                            { value: "offline", label: "OFFLINE", color: "#6b7280" }
                        ].map(state => (
                            <button
                                key={state.value}
                                type="button"
                                onClick={() => applyAvailability(state.value)}
                                disabled={!lcu || loading}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    background: availability === state.value ? `${state.color}15` : 'rgba(0, 0, 0, 0.2)',
                                    border: `1px solid ${availability === state.value ? `${state.color}40` : 'var(--glass-border)'}`,
                                    borderRadius: '8px',
                                    color: availability === state.value ? state.color : 'var(--text-secondary)',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.5px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: availability === state.value ? state.color : 'var(--text-secondary)', boxShadow: availability === state.value ? `0 0 8px ${state.color}` : 'none' }}></span>
                                {state.label}
                            </button>
                        ))}
                    </div>

                    {/* Enforce Offline Toggle */}
                    <div style={{ 
                        padding: '12px 14px', 
                        background: enforceOffline ? 'rgba(59, 130, 246, 0.08)' : 'rgba(0, 0, 0, 0.2)',
                        border: `1px solid ${enforceOffline ? 'rgba(59, 130, 246, 0.2)' : 'var(--glass-border)'}`,
                        borderRadius: '10px', transition: 'all 0.2s'
                    }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.82rem' }}>
                            <input 
                                type="checkbox" 
                                checked={enforceOffline} 
                                onChange={(e) => toggleEnforceOffline(e.target.checked)} 
                                style={{ width: '16px', height: '16px', accentColor: 'var(--hextech-gold)' }}
                            />
                            <span style={{ color: enforceOffline ? 'var(--hextech-gold)' : 'var(--text-primary)', transition: 'color 0.2s' }}>
                                Enforce "Offline" status (even in Champ Select)
                            </span>
                        </label>
                    </div>
                </div>
            )}

            {/* Offline Warning */}
            {!lcu && (
                <div style={{ marginTop: '20px', padding: '14px 16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', textAlign: 'center' }}>
                    <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>Start League of Legends to enable this feature.</span>
                </div>
            )}
        </div>
    );
};

export default React.memo(ProfileTab);

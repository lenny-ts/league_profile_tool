import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { LcuInfo } from '../../hooks/useLcu';
import { SAVED_BACKGROUND_KEY } from '../../hooks/useAutoRestore';
import { PENGU_PLUGIN_INSTALLED_KEY, SAVED_CUSTOM_BACKGROUND_KEY } from '../../storageKeys';
import { patchChatLol } from '../../utils/chatMe';
import { Search, Image, Loader2, Hash, Upload, Trash2, Film } from 'lucide-react';
import supplementalSkins from '../../data/supplemental-skins.json';

interface BackgroundTabProps {
    lcu: LcuInfo | null;
    showToast: (text: string, type: string) => void;
    addLog: (msg: string) => void;
    lcuRequest: (method: string, endpoint: string, body?: Record<string, unknown>) => Promise<unknown>;
}

interface ChampionSummary {
    id: number;
    name: string;
    alias: string;
    squarePortraitPath: string;
    allIds?: number[];
}

interface SkinEntry {
    id: number;
    name: string;
    isBase: boolean;
    splashPath: string;
}

interface SkinSearchEntry {
    id: number;
    name: string;
    championName: string;
}

const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';

interface CustomBackgroundSettings {
    active: boolean;
    fileName: string;
    fit: 'cover' | 'contain';
    position: 'center' | 'top' | 'bottom' | 'left' | 'right';
    dim: number;
}

function getSavedCustomBackground(): CustomBackgroundSettings {
    try {
        const saved = JSON.parse(localStorage.getItem(SAVED_CUSTOM_BACKGROUND_KEY) || '{}') as Partial<CustomBackgroundSettings>;
        return {
            active: saved.active === true,
            fileName: typeof saved.fileName === 'string' ? saved.fileName : '',
            fit: saved.fit === 'contain' ? 'contain' : 'cover',
            position: ['center', 'top', 'bottom', 'left', 'right'].includes(saved.position || '') ? saved.position! : 'center',
            dim: saved.dim === undefined ? 20 : Math.min(80, Math.max(0, Number(saved.dim) || 0)),
        };
    } catch {
        return { active: false, fileName: '', fit: 'cover', position: 'center', dim: 20 };
    }
}

function cdnUrl(path: string): string {
    return CDRAGON_BASE + path.replace('/lol-game-data/assets', '').toLowerCase();
}

const FALLBACK_SPLASH = "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225">
        <rect width="400" height="225" fill="#1e1e2f"/>
        <rect x="100" y="25" width="200" height="110" rx="6" fill="none" stroke="#666" stroke-width="4"/>
        <circle cx="155" cy="60" r="10" fill="none" stroke="#666" stroke-width="4"/>
        <path d="M110 125 L160 80 L200 100 L250 60 L295 100" fill="none" stroke="#666" stroke-width="4" stroke-linejoin="round"/>
        <text x="200" y="180" fill="#999" font-family="system-ui, sans-serif" font-size="24" text-anchor="middle">Preview not available</text>
    </svg>`
);

const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = FALLBACK_SPLASH;
};

function addUniqueSkins(target: SkinEntry[], source: SkinEntry[], seenIds: Set<number>): void {
    for (const skin of source) {
        if (!seenIds.has(skin.id)) {
            seenIds.add(skin.id);
            target.push(skin);
        }
    }
}

async function fetchSkinsForId(id: number): Promise<SkinEntry[]> {
    try {
        const res = await fetch(`${CDRAGON_BASE}/v1/champions/${id}.json`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.skins || []).map((s: { id: number; name: string; isBase: boolean; splashPath: string }) => ({
            id: s.id,
            name: s.name,
            isBase: s.isBase,
            splashPath: s.splashPath,
        }));
    } catch {
        return [];
    }
}

function groupChampionsByName(list: ChampionSummary[]): ChampionSummary[] {
    const champMap = new Map<string, ChampionSummary>();
    for (const c of list) {
        const key = c.name.toLowerCase().trim();
        if (!champMap.has(key)) {
            champMap.set(key, { ...c, allIds: [c.id] });
        } else {
            const existing = champMap.get(key)!;
            existing.allIds ??= [existing.id];
            if (!existing.allIds.includes(c.id)) {
                existing.allIds.push(c.id);
            }
            if (c.id < existing.id) {
                existing.id = c.id;
                existing.squarePortraitPath = c.squarePortraitPath;
            }
        }
    }
    return Array.from(champMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

const BackgroundTab: React.FC<BackgroundTabProps> = ({ lcu, showToast, addLog, lcuRequest }) => {
    const savedCustomBackground = useRef(getSavedCustomBackground()).current;
    const [backgroundMode, setBackgroundMode] = useState<'riot' | 'custom'>('riot');
    const [loading, setLoading] = useState(false);
    const [customLoading, setCustomLoading] = useState(false);
    const [customSourcePath, setCustomSourcePath] = useState('');
    const [customPreview, setCustomPreview] = useState('');
    const [customActive, setCustomActive] = useState(savedCustomBackground.active);
    const [customFileName, setCustomFileName] = useState(savedCustomBackground.fileName);
    const [customFit, setCustomFit] = useState<'cover' | 'contain'>(savedCustomBackground.fit);
    const [customPosition, setCustomPosition] = useState<CustomBackgroundSettings['position']>(savedCustomBackground.position);
    const [customDim, setCustomDim] = useState(savedCustomBackground.dim);
    const [champions, setChampions] = useState<ChampionSummary[]>([]);
    const [champSearch, setChampSearch] = useState('');
    const [selectedChampion, setSelectedChampion] = useState<ChampionSummary | null>(null);
    const [skins, setSkins] = useState<SkinEntry[]>([]);
    const [selectedSkin, setSelectedSkin] = useState<SkinEntry | null>(null);
    const [currentBgId, setCurrentBgId] = useState<number | null>(null);
    const [loadingChamps, setLoadingChamps] = useState(false);
    const [loadingSkins, setLoadingSkins] = useState(false);
    const [champsLoaded, setChampsLoaded] = useState(false);
    const [skinQuery, setSkinQuery] = useState('');
    const [skinSuggestions, setSkinSuggestions] = useState<SkinSearchEntry[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedDirectSkin, setSelectedDirectSkin] = useState<SkinSearchEntry | null>(null);
    const [allSkinsLoaded, setAllSkinsLoaded] = useState(false);
    const skinCacheRef = useRef<Map<number, SkinEntry[]>>(new Map());
    const skinGridRef = useRef<HTMLDivElement>(null);
    const allSkinsRef = useRef<SkinSearchEntry[]>([]);
    const searchRef = useRef<HTMLDivElement>(null);

    // Fetch current background skin ID from LCU
    const fetchCurrentBackground = useCallback(async () => {
        if (!lcu) return;
        try {
            const res = await lcuRequest('GET', '/lol-summoner/v1/current-summoner/summoner-profile');
            if (res && typeof res === 'object' && 'backgroundSkinId' in res) {
                setCurrentBgId(res.backgroundSkinId as number);
            }
        } catch (err) {
            console.error('Failed to fetch current background:', err);
        }
    }, [lcu, lcuRequest]);

    // Fetch champion list only (single request, instant)
    const fetchChampions = useCallback(async () => {
        if (champsLoaded || loadingChamps) return;
        setLoadingChamps(true);
        try {
            const res = await fetch(`${CDRAGON_BASE}/v1/champion-summary.json`);
            if (!res.ok) throw new Error('Failed to fetch champion list');
            const list: ChampionSummary[] = await res.json();
            const valid = groupChampionsByName(list.filter(c => c.id > 0 && c.id < 66600));
            setChampions(valid);
            setChampsLoaded(true);
            addLog(`Loaded ${valid.length} champions.`);
        } catch (err) {
            addLog(`Error fetching champions: ${err}`);
            showToast('Failed to load champion list', 'error');
        } finally {
            setLoadingChamps(false);
        }
    }, [champsLoaded, loadingChamps, addLog, showToast]);

    useEffect(() => {
        if (!champsLoaded && !loadingChamps) fetchChampions();
        if (lcu) fetchCurrentBackground();
    }, [champsLoaded, loadingChamps, fetchChampions, lcu, fetchCurrentBackground]);

    const fetchUnifiedChampSkins = useCallback(async (champ: ChampionSummary): Promise<SkinEntry[]> => {
        const idsToFetch = champ.allIds && champ.allIds.length > 0 ? champ.allIds : [champ.id];
        const skinList: SkinEntry[] = [];
        const seenIds = new Set<number>();

        for (const id of idsToFetch) {
            const cdnSkins = await fetchSkinsForId(id);
            addUniqueSkins(skinList, cdnSkins, seenIds);

            const extras = (supplementalSkins as Record<string, SkinEntry[]>)[String(id)];
            if (extras) addUniqueSkins(skinList, extras, seenIds);
        }

        return skinList;
    }, []);

    // Build skin search index after champions load
    useEffect(() => {
        if (!champsLoaded || allSkinsLoaded || champions.length === 0) return;
        let cancelled = false;

        const addChampToIndex = (champ: ChampionSummary, skinList: SkinEntry[], index: SkinSearchEntry[]) => {
            skinCacheRef.current.set(champ.id, skinList);
            for (const skin of skinList) {
                index.push({ id: skin.id, name: skin.name, championName: champ.name });
            }
        };

        const addSupplementalSkins = (index: SkinSearchEntry[]) => {
            for (const [champIdStr, extras] of Object.entries(supplementalSkins)) {
                for (const skin of extras as SkinEntry[]) {
                    if (!index.some(s => s.id === skin.id)) {
                        index.push({ id: skin.id, name: skin.name, championName: `Champion ${champIdStr}` });
                    }
                }
            }
        };

        const buildIndex = async () => {
            const index: SkinSearchEntry[] = [];
            const batchSize = 20;
            for (let i = 0; i < champions.length; i += batchSize) {
                if (cancelled) return;
                const batch = champions.slice(i, i + batchSize);
                const results = await Promise.allSettled(batch.map(async champ => {
                    const skinList = await fetchUnifiedChampSkins(champ);
                    return { champ, skinList };
                }));
                for (const result of results) {
                    if (result.status !== 'fulfilled' || !result.value) continue;
                    addChampToIndex(result.value.champ, result.value.skinList, index);
                }
            }
            if (cancelled) return;
            addSupplementalSkins(index);
            if (cancelled) return;
            allSkinsRef.current = index;
            setAllSkinsLoaded(true);
        };

        buildIndex();
        return () => { cancelled = true; };
    }, [champsLoaded, allSkinsLoaded, champions, fetchUnifiedChampSkins]);

    // Fetch skins for a specific champion (lazy, cached)
    const selectChampion = useCallback(async (champ: ChampionSummary) => {
        setSelectedChampion(champ);
        setSelectedSkin(null);

        // Check cache first
        const cached = skinCacheRef.current.get(champ.id);
        if (cached) {
            setSkins(cached);
            return;
        }

        setLoadingSkins(true);
        setSkins([]);
        try {
            const skinList = await fetchUnifiedChampSkins(champ);
            skinCacheRef.current.set(champ.id, skinList);
            setSkins(skinList);
        } catch (err) {
            addLog(`Error loading skins: ${err}`);
        } finally {
            setLoadingSkins(false);
        }
    }, [addLog, fetchUnifiedChampSkins]);

    // Scroll skin grid to top when champion changes
    useEffect(() => {
        if (skinGridRef.current) skinGridRef.current.scrollTop = 0;
    }, [selectedChampion]);

    const filteredChampions = champSearch.trim()
        ? champions.filter(c =>
            c.name.toLowerCase().includes(champSearch.toLowerCase()) ||
            c.alias.toLowerCase().includes(champSearch.toLowerCase())
        )
        : champions;

    // Skin search suggestions
    useEffect(() => {
        if (!skinQuery.trim() || selectedDirectSkin) {
            setSkinSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        const q = skinQuery.toLowerCase();
        const isNumeric = /^\d+$/.test(q);
        const matches = allSkinsRef.current.filter(s => {
            if (isNumeric) return String(s.id).startsWith(q);
            return s.name.toLowerCase().includes(q);
        }).slice(0, 12);
        setSkinSuggestions(matches);
        setShowSuggestions(matches.length > 0);
    }, [skinQuery, selectedDirectSkin, allSkinsLoaded]);

    // Close suggestions on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const applyBackground = async (skinId: number, skinName: string) => {
        if (!lcu) return;
        setLoading(true);
        try {
            await lcuRequest('POST', '/lol-summoner/v1/current-summoner/summoner-profile', {
                key: 'backgroundSkinId',
                value: skinId,
            });
            localStorage.setItem(SAVED_BACKGROUND_KEY, skinId.toString());
            showToast(`Background set to ${skinName}!`, 'success');
            addLog(`Profile background updated: ${skinName} (ID: ${skinId})`);
            setCurrentBgId(skinId);
        } catch (err) {
            addLog(`Official background update failed (${err}). Trying force method...`);
            try {
                await patchChatLol(lcuRequest, (current) => ({
                    ...current,
                    backgroundSkinId: skinId.toString()
                }));
                
                localStorage.setItem(SAVED_BACKGROUND_KEY, skinId.toString());
                showToast(`Background forced to ${skinName}!`, 'success');
                addLog(`Profile background forced: ${skinName} (ID: ${skinId})`);
                setCurrentBgId(skinId);
            } catch (forceErr) {
                const msg = forceErr instanceof Error ? forceErr.message : String(forceErr);
                showToast('Failed to set background', 'error');
                addLog(`Background update failed: ${msg}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const chooseCustomBackground = async () => {
        const selected = await open({
            multiple: false,
            filters: [{ name: 'Images and animations', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
        });
        if (!selected) return;
        const path = Array.isArray(selected) ? selected[0] : selected;
        setCustomSourcePath(path);
        setCustomFileName(path.split(/[\\/]/).pop() || 'Custom background');
        try {
            setCustomPreview(await invoke<string>('read_custom_background_preview', { path }));
        } catch {
            setCustomPreview('');
        }
    };

    const applyCustomBackground = async () => {
        if (!customSourcePath && !customActive) return;
        setCustomLoading(true);
        try {
            await invoke('install_pengu_plugin');
            const installedName = await invoke<string>('save_custom_background', {
                sourcePath: customSourcePath || null,
                fit: customFit,
                position: customPosition,
                dim: customDim,
            });
            const settings: CustomBackgroundSettings = { active: true, fileName: customFileName || installedName, fit: customFit, position: customPosition, dim: customDim };
            localStorage.setItem(SAVED_CUSTOM_BACKGROUND_KEY, JSON.stringify(settings));
            localStorage.setItem(PENGU_PLUGIN_INSTALLED_KEY, 'true');
            setCustomActive(true);
            setCustomFileName(settings.fileName);
            setCustomSourcePath('');
            showToast('Custom profile background applied!', 'success');
            addLog(`Custom profile background applied: ${settings.fileName}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            showToast(`Custom background failed: ${message}`, 'error');
            addLog(`Custom profile background failed: ${message}`);
        } finally {
            setCustomLoading(false);
        }
    };

    const clearCustomBackground = async () => {
        setCustomLoading(true);
        try {
            await invoke('clear_custom_background');
            localStorage.removeItem(SAVED_CUSTOM_BACKGROUND_KEY);
            setCustomActive(false);
            setCustomSourcePath('');
            setCustomPreview('');
            setCustomFileName('');
            showToast('Custom background removed.', 'success');
            addLog('Custom profile background removed.');
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            showToast(`Could not remove custom background: ${message}`, 'error');
            addLog(`Custom profile background removal failed: ${message}`);
        } finally {
            setCustomLoading(false);
        }
    };

    // Correctly extract the label logic
    const getApplyButtonLabel = () => {
        if (loading) return 'APPLYING...';
        if (selectedSkin) return `APPLY — ${selectedSkin.name}`;
        return 'SELECT A SKIN';
    };

    return (
        <div className="tab-content fadeIn" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0 20px 40px 20px' }}>
            <div className="background-tab-header">
                <div>
                    <h2>Background</h2>
                    <p>Choose a Riot skin or use your own image or animated GIF.</p>
                </div>
            </div>

            <div className="background-mode-switch card" role="tablist" aria-label="Background source">
                <button type="button" role="tab" aria-label="Riot Skins" aria-selected={backgroundMode === 'riot'} className={backgroundMode === 'riot' ? 'active' : ''} onClick={() => setBackgroundMode('riot')}><Image size={18} /><span><strong>Riot Skins</strong><small>Browse official champion splash art</small></span></button>
                <button type="button" role="tab" aria-label="Custom / GIF" aria-selected={backgroundMode === 'custom'} className={backgroundMode === 'custom' ? 'active' : ''} onClick={() => setBackgroundMode('custom')}><Film size={18} /><span><strong>Custom / GIF</strong><small>Upload your own static or animated background</small></span></button>
            </div>

            {backgroundMode === 'custom' && <div className="card custom-background-card" style={{ marginBottom: '12px', flexShrink: 0, padding: '18px 20px' }}>
                <div className="custom-background-layout">
                    <div className="custom-background-preview" style={{ backgroundSize: customFit, backgroundPosition: customPosition }}>
                        {customPreview ? <img src={customPreview} alt="Custom background preview" style={{ objectFit: customFit, objectPosition: customPosition }} /> : <Film size={28} />}
                        <span>{customFileName || 'PNG, JPG, WEBP or GIF'}</span>
                        {customActive && <b>ACTIVE</b>}
                    </div>
                    <div className="custom-background-content">
                        <div>
                            <h3 className="card-title" style={{ margin: 0, fontSize: '0.9rem' }}>Custom Image / GIF</h3>
                            <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Use any local image or animated GIF. Custom media takes priority until removed.</p>
                        </div>
                        <div className="custom-background-options">
                            <label>Fit
                                <select aria-label="Custom background fit" value={customFit} onChange={event => setCustomFit(event.target.value as 'cover' | 'contain')}><option value="cover">AUTO FILL</option><option value="contain">SHOW FULL IMAGE</option></select>
                            </label>
                            <label>Position
                                <select aria-label="Custom background position" value={customPosition} onChange={event => setCustomPosition(event.target.value as CustomBackgroundSettings['position'])}>
                                    <option value="center">CENTER</option><option value="top">TOP</option><option value="bottom">BOTTOM</option><option value="left">LEFT</option><option value="right">RIGHT</option>
                                </select>
                            </label>
                            <label>Darken <span>{customDim}%</span>
                                <input aria-label="Custom background darken" type="range" min="0" max="80" step="5" value={customDim} onChange={event => setCustomDim(Number(event.target.value))} />
                            </label>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <button type="button" className="ghost-btn" onClick={chooseCustomBackground} disabled={customLoading}><Upload size={14} /> Choose File</button>
                            <button type="button" className="primary-btn" onClick={applyCustomBackground} disabled={customLoading || (!customSourcePath && !customActive)}>{customLoading ? 'APPLYING...' : 'APPLY CUSTOM'}</button>
                            {customActive && <button type="button" className="ghost-btn" onClick={clearCustomBackground} disabled={customLoading} style={{ color: '#f87171' }}><Trash2 size={14} /> Remove</button>}
                        </div>
                    </div>
                </div>
            </div>}

            {backgroundMode === 'riot' && <>
            {/* 1. Direct Skin ID Card */}
            <div className="card" style={{ marginBottom: '12px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ 
                        width: '28px', height: '28px', borderRadius: '6px', 
                        background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Hash size={14} style={{ color: 'var(--hextech-gold)' }} />
                    </div>
                    <div><h3 className="card-title" style={{ margin: 0, fontSize: '0.9rem' }}>Profile Background</h3><p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Search directly or browse by champion.</p></div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                    <div ref={searchRef} style={{ flex: 1, position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Search skin by name or ID..."
                            value={selectedDirectSkin ? `${selectedDirectSkin.name} (${selectedDirectSkin.championName})` : skinQuery}
                            onChange={(e) => {
                                setSkinQuery(e.target.value);
                                setSelectedDirectSkin(null);
                            }}
                            onFocus={() => {
                                if (skinSuggestions.length > 0) setShowSuggestions(true);
                            }}
                            style={{ width: '100%', padding: '10px 12px', fontSize: '0.82rem' }}
                        />
                        {showSuggestions && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                background: '#18181b', border: '1px solid var(--glass-border)',
                                borderRadius: '8px', zIndex: 100, maxHeight: '240px',
                                overflowY: 'auto', marginTop: '4px',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                            }}>
                                {skinSuggestions.map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedDirectSkin(s);
                                            setShowSuggestions(false);
                                        }}
                                        style={{
                                            display: 'block', width: '100%', padding: '10px 12px',
                                            textAlign: 'left', background: 'none', border: 'none',
                                            borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer',
                                            color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.82rem',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                    >
                                        <span style={{ color: 'var(--hextech-gold)', fontWeight: 600 }}>{s.championName}</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{' — '}{s.name}</span>
                                        <span style={{ color: 'var(--text-secondary)', opacity: 0.5, marginLeft: '8px', fontSize: '0.7rem' }}>
                                            #{s.id}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button type="button"
                        className="primary-btn"
                        onClick={() => {
                            if (selectedDirectSkin) {
                                applyBackground(selectedDirectSkin.id, selectedDirectSkin.name);
                            } else {
                                const id = Number.parseInt(skinQuery, 10);
                                if (!Number.isNaN(id) && id > 0) applyBackground(id, `Skin ${id}`);
                            }
                        }}
                        disabled={!lcu || loading || (!selectedDirectSkin && (!skinQuery.trim() || Number.isNaN(Number.parseInt(skinQuery, 10))))}
                        style={{ padding: '10px 20px', fontSize: '0.75rem', borderRadius: '8px' }}
                    >
                        APPLY
                    </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', margin: '12px 0', paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
                    {lcu && currentBgId !== null && (
                        <div style={{
                            padding: '6px 12px', borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.15)',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Equipped</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--hextech-gold)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                {currentBgId === 0 ? 'DEFAULT' : `#${currentBgId}`}
                            </span>
                        </div>
                    )}
                </div>

                {selectedChampion ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <button type="button"
                                className="ghost-btn"
                                onClick={() => { setSelectedChampion(null); setSkins([]); setSelectedSkin(null); }}
                                style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                            >
                                ← BACK
                            </button>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                {selectedChampion.name}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>— select a skin</span>
                        </div>

                        {loadingSkins && (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <Loader2 className="intel-spinner" size={28} style={{ color: 'var(--hextech-gold)', marginBottom: '10px' }} />
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0 }}>Loading skins...</p>
                            </div>
                        )}

                        {!loadingSkins && skins.length > 0 && (
                            <div ref={skinGridRef} className="bg-skin-grid">
                                {skins.map(skin => (
                                    <button
                                        key={skin.id}
                                        type="button"
                                        className={`bg-skin-item ${selectedSkin?.id === skin.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedSkin(skin)}
                                        title={`${skin.name} (ID: ${skin.id})`}
                                    >
                                        <img src={cdnUrl(skin.splashPath)} alt={skin.name} loading="lazy" onError={handleImgError} />
                                        <div className="bg-skin-overlay">
                                            <div className="bg-skin-name">{skin.name}</div>
                                            <div className="bg-skin-id">ID: {skin.id}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {selectedSkin && (
                            <div className="bg-preview-strip fadeIn">
                                <img src={cdnUrl(selectedSkin.splashPath)} className="bg-preview-thumb" alt="" onError={handleImgError} />
                                <div className="bg-preview-text">
                                    <span className="bg-preview-name">{selectedSkin.name}</span>
                                    <span className="bg-preview-meta">ID: {selectedSkin.id}</span>
                                </div>
                            </div>
                        )}

                        <button type="button"
                            className="primary-btn"
                            id="apply-background-btn"
                            onClick={() => selectedSkin && applyBackground(selectedSkin.id, selectedSkin.name)}
                            disabled={!lcu || loading || !selectedSkin}
                            style={{ width: '100%', marginTop: '12px', padding: '12px', fontSize: '0.8rem' }}
                        >
                            {getApplyButtonLabel()}
                        </button>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ marginBottom: '12px', position: 'relative', width: '100%', flexShrink: 0 }}>
                            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                id="bg-search-input"
                                placeholder="Search by champion name..."
                                value={champSearch}
                                onChange={(e) => setChampSearch(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px 10px 35px', fontSize: '0.82rem' }}
                            />
                        </div>

                        {loadingChamps && (
                            <div style={{ textAlign: 'center', padding: '40px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <Loader2 className="intel-spinner" size={28} style={{ color: 'var(--hextech-gold)', marginBottom: '10px' }} />
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0 }}>Loading champions...</p>
                            </div>
                        )}

                        {!loadingChamps && champsLoaded && (
                            <div className="bg-champ-grid" style={{ flex: 1, minHeight: 0 }}>
                                {filteredChampions.map(champ => (
                                    <button
                                        key={champ.id}
                                        type="button"
                                        className="bg-champ-item"
                                        onClick={() => selectChampion(champ)}
                                        title={champ.name}
                                    >
                                        <img src={cdnUrl(champ.squarePortraitPath)} alt={champ.name} loading="lazy" />
                                        <div className="bg-champ-name">{champ.name}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            </>}

            {!lcu && backgroundMode === 'riot' && (
                <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', textAlign: 'center' }}>
                    <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>Start League of Legends to enable this feature.</span>
                </div>
            )}
        </div>
    );
};

export default React.memo(BackgroundTab);

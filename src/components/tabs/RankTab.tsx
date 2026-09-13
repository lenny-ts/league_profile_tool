import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LcuInfo } from '../../hooks/useLcu';
import { getCurrentRankedStats, LcuRequestFn, patchChatLol } from '../../utils/chatMe';
import { 
    SAVED_RANK_QUEUE_KEY, 
    SAVED_RANK_TIER_KEY, 
    SAVED_RANK_DIV_KEY, 
    SAVED_RANK_LP_KEY,
    SAVED_LAST_SEASON_RANK_KEY,
    SAVED_RANK_BORDER_KEY,
    SAVED_RANK_BANNER_KEY,
    SAVED_OVERVIEW_CARDS_KEY,
    PENGU_OVERVIEW_OVERRIDE_KEY,
    PENGU_PLUGIN_INSTALLED_KEY,
} from '../../storageKeys';
import { Shield, RefreshCw, Monitor, Puzzle } from 'lucide-react';

interface RankTabProps {
    lcu: LcuInfo | null;
    showToast: (text: string, type: string) => void;
    addLog: (msg: string) => void;
    lcuRequest: LcuRequestFn;
}

const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const LAST_SEASON_TIERS = ["UNRANKED", ...TIERS];
const BORDER_TIERS = ["AUTO", ...TIERS];
const BANNER_TIERS = ["AUTO", "DEFAULT", ...TIERS];
const DIVISIONS = ["I", "II", "III", "IV"];
const QUEUES = [
    { value: "RANKED_SOLO_5x5", label: "Solo/Duo" },
    { value: "RANKED_FLEX_SR", label: "Flex 5v5" },
    { value: "RANKED_PREMADE_5x5", label: "5v5" },
    { value: "RANKED_TFT", label: "TFT" },
    { value: "RANKED_TFT_DOUBLE_UP", label: "Double Up" }
];
const TIER_COLORS: Record<string, string> = {
    NONE: "#595959",
    IRON: "#595959",
    BRONZE: "#8b5a2b",
    SILVER: "#c0c0c0",
    GOLD: "#ffd700",
    PLATINUM: "#00ced1",
    EMERALD: "#2ecc71",
    DIAMOND: "#1e90ff",
    MASTER: "#8a2be2",
    GRANDMASTER: "#ff4500",
    CHALLENGER: "#00ffff"
};

const RankTab: React.FC<RankTabProps> = ({ lcu, showToast, addLog, lcuRequest }) => {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // Rank states
    const [soloTier, setSoloTier] = useState("CHALLENGER");
    const [soloDiv, setSoloDiv] = useState("I");
    const [leaguePoints, setLeaguePoints] = useState(0);
    const [lastSeasonTier, setLastSeasonTier] = useState("UNRANKED");
    const [borderTier, setBorderTier] = useState("AUTO");
    const [bannerTier, setBannerTier] = useState("AUTO");
    const [queueType, setQueueType] = useState("RANKED_SOLO_5x5");
    const [overviewEnabled, setOverviewEnabled] = useState(() => localStorage.getItem(PENGU_OVERVIEW_OVERRIDE_KEY) !== 'false');
    const pluginInstalled = localStorage.getItem(PENGU_PLUGIN_INSTALLED_KEY) === 'true';

    const applyLolData = useCallback((raw: string | Record<string, unknown>): boolean => {
        const lol = typeof raw === 'string' ? JSON.parse(raw) as Record<string, unknown> : raw;
        const tier = String(lol.rankedLeagueTier || '').toUpperCase();
        const division = String(lol.rankedLeagueDivision || '').toUpperCase();
        const queue = String(lol.rankedLeagueQueue || '');
        if (!TIERS.includes(tier)) return false;
        setSoloTier(tier);
        if (DIVISIONS.includes(division)) setSoloDiv(division);
        if (QUEUES.some(item => item.value === queue)) setQueueType(queue);
        return true;
    }, []);

    const fetchCurrentData = useCallback(async (targetQueue: string, notify = false) => {
        if (!lcu) return;
        setFetching(true);
        try {
            addLog("Syncing rank status from LCU...");

            let synced = false;
            const rankedStats = await getCurrentRankedStats(lcuRequest);
            const previousTier = String(rankedStats?.highestPreviousSeasonEndTier || '').toUpperCase();
            if (LAST_SEASON_TIERS.includes(previousTier)) setLastSeasonTier(previousTier);
            const queueMap = rankedStats?.queueMap;
            if (queueMap && typeof queueMap === 'object') {
                const entry = (queueMap as Record<string, unknown>)[targetQueue];
                if (entry && typeof entry === 'object') {
                    const rank = entry as Record<string, unknown>;
                    const tier = String(rank.tier || '').toUpperCase();
                    const division = String(rank.division || '').toUpperCase();
                    const points = Number(rank.leaguePoints);
                    if (TIERS.includes(tier)) {
                        setSoloTier(tier);
                        if (DIVISIONS.includes(division)) setSoloDiv(division);
                        if (Number.isFinite(points)) setLeaguePoints(Math.max(0, Math.trunc(points)));
                        synced = true;
                    }
                }
            }

            if (!synced) {
                const chatRes = await lcuRequest("GET", "/lol-chat/v1/me") as { lol?: string | Record<string, unknown> } | null;
                if (chatRes?.lol) synced = applyLolData(chatRes.lol);
            }

            if (!synced) throw new Error(`No rank data found for ${QUEUES.find(item => item.value === targetQueue)?.label || targetQueue}`);
            addLog("Rank status synced successfully.");
            if (notify) showToast("Rank synced from League Client", "success");
        } catch (err) {
            addLog(`Failed to fetch current status: ${err}`);
            if (notify) showToast(`Rank sync failed: ${err instanceof Error ? err.message : String(err)}`, "error");
        } finally {
            setFetching(false);
        }
    }, [lcu, lcuRequest, addLog, applyLolData, showToast]);

    useEffect(() => {
        if (lcu) {
            fetchCurrentData("RANKED_SOLO_5x5");
        }
    }, [lcu, fetchCurrentData]);

    const applyChanges = async () => {
        if (!lcu) return;
        setLoading(true);
        try {
            // Serialized RMW: read latest lol, apply overrides, write back.
            // This prevents races with other components editing the same field.
            await patchChatLol(lcuRequest, (current) => ({
                ...current,
                rankedLeagueTier: soloTier,
                rankedLeagueDivision: soloDiv,
                rankedLeagueQueue: queueType,
            }));

            // Save overrides to local storage for the Auto-Enforcer
            localStorage.setItem(SAVED_RANK_QUEUE_KEY, queueType);
            localStorage.setItem(SAVED_RANK_TIER_KEY, soloTier);
            localStorage.setItem(SAVED_RANK_DIV_KEY, soloDiv);
            localStorage.setItem(SAVED_RANK_LP_KEY, leaguePoints.toString());
            localStorage.setItem(SAVED_LAST_SEASON_RANK_KEY, lastSeasonTier);
            localStorage.setItem(SAVED_RANK_BORDER_KEY, borderTier);
            localStorage.setItem(SAVED_RANK_BANNER_KEY, bannerTier);
            localStorage.setItem(PENGU_OVERVIEW_OVERRIDE_KEY, overviewEnabled.toString());

            // Write config for Pengu Loader plugin
            try {
                let overviewCards: Record<string, unknown> = {};
                try {
                    overviewCards = JSON.parse(localStorage.getItem(SAVED_OVERVIEW_CARDS_KEY) || '{}') as Record<string, unknown>;
                } catch {
                    localStorage.removeItem(SAVED_OVERVIEW_CARDS_KEY);
                }
                await invoke("save_rank_config", {
                    tier: soloTier,
                    division: soloDiv,
                    queue: queueType,
                    leaguePoints,
                    lastSeasonTier,
                    borderTier,
                    bannerTier,
                    honorLevel: String(overviewCards.honorLevel || 'AUTO'),
                    masteryScore: String(overviewCards.masteryScore || ''),
                    masteryLevel: String(overviewCards.masteryLevel || 'AUTO'),
                    masteryLevel2: String(overviewCards.masteryLevel2 || 'AUTO'),
                    masteryLevel3: String(overviewCards.masteryLevel3 || 'AUTO'),
                    masteryChampionId: String(overviewCards.masteryChampionId || 'AUTO'),
                    masteryChampionId2: String(overviewCards.masteryChampionId2 || 'AUTO'),
                    masteryChampionId3: String(overviewCards.masteryChampionId3 || 'AUTO'),
                    trophyTheme: String(overviewCards.trophyTheme || 'AUTO'),
                    trophyBracket: Number(overviewCards.trophyBracket) || 4,
                    trophyTier: Number(overviewCards.trophyTier) || 4,
                    clashBannerTheme: String(overviewCards.clashBannerTheme || 'AUTO'),
                    clashBannerLevel: Number(overviewCards.clashBannerLevel) || 1,
                    overviewEnabled,
                });
            } catch (e) {
                // Plugin may not be installed — ignore silently
            }

            showToast("Rank Overrides Applied!", "success");
            addLog(`Rank overrides updated successfully.`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            showToast(`Customization failed: ${errorMessage}`, "error");
            addLog(`Customization application failed: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const hasDivision = !["MASTER", "GRANDMASTER", "CHALLENGER"].includes(soloTier);

    return (
        <div className="tab-content fadeIn ui-page">
            <div className="ui-page-header">
                <div className="ui-page-header__copy">
                    <h2 className="ui-page-header__title">Rank Override</h2>
                    <p className="ui-page-header__description">Customize your visible rank, queue, and profile overview.</p>
                </div>
            </div>

            <div className="ui-page-stack">
                {/* Queue Card */}
                <div className="card ui-panel">
                    <div className="ui-section-header">
                        <div className="ui-section-header__icon">
                            <Shield size={16} style={{ color: 'var(--hextech-gold)' }} />
                        </div>
                        <div className="ui-section-header__copy"><h3 className="ui-section-header__title">Queue</h3><p className="ui-section-header__description">Select which ranked queue to display.</p></div>
                    </div>
                    <div className="rank-queue-grid">
                        {QUEUES.map(q => (
                            <button type="button"
                                key={q.value}
                                onClick={() => setQueueType(q.value)}
                                disabled={!lcu}
                                style={{
                                    padding: '12px 10px', border: 'none', borderRight: '1px solid var(--glass-border)',
                                    background: queueType === q.value ? 'rgba(59, 130, 246, 0.12)' : 'rgba(0, 0, 0, 0.2)',
                                    color: queueType === q.value ? 'var(--hextech-gold)' : 'var(--text-secondary)',
                                    fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                                    boxShadow: queueType === q.value ? 'inset 0 -2px #3b82f6' : 'none',
                                    transition: 'all 0.15s'
                                }}
                            >
                                {q.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tier + Division Card */}
                <div>
                    <div className="card ui-panel">
                        <div className="ui-section-header">
                            <div className="ui-section-header__icon">
                                <Shield size={16} style={{ color: 'var(--hextech-gold)' }} />
                            </div>
                            <div className="ui-section-header__copy"><h3 className="ui-section-header__title">Tier</h3><p className="ui-section-header__description">Choose the rank and division shown in the client.</p></div>
                        </div>
                        <div className="rank-tier-grid">
                            {TIERS.map(t => {
                                const isActive = soloTier === t;
                                const color = TIER_COLORS[t] || "#ffffff";
                                return (
                                    <button type="button"
                                        key={t}
                                        onClick={() => setSoloTier(t)}
                                        disabled={!lcu}
                                        aria-pressed={isActive}
                                        title={`${t} rank tier`}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px',
                                            padding: '8px 10px', borderRadius: '6px',
                                            border: isActive ? `1px solid ${color}` : '1px solid var(--glass-border)',
                                            background: isActive ? `${color}12` : 'rgba(0, 0, 0, 0.28)',
                                            color: isActive ? color : 'var(--text-secondary)',
                                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                            boxShadow: isActive ? `inset 2px 0 ${color}` : 'none',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        <Shield size={16} />
                                        {t}
                                    </button>
                                );
                            })}
                        </div>
                        {hasDivision && (
                            <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid var(--glass-border)' }}>
                                <div className="ui-section-header">
                                    <div className="ui-section-header__icon">
                                        <Shield size={16} style={{ color: 'var(--hextech-gold)' }} />
                                    </div>
                                    <div className="ui-section-header__copy"><h3 className="ui-section-header__title">Division</h3></div>
                                </div>
                                <div className="rank-division-grid">
                                    {DIVISIONS.map(d => (
                                        <button type="button"
                                            key={d}
                                            onClick={() => setSoloDiv(d)}
                                            disabled={!lcu}
                                            aria-pressed={soloDiv === d}
                                            title={`Division ${d}`}
                                            style={{
                                                padding: '8px', borderRadius: '6px',
                                                border: soloDiv === d ? '1px solid var(--hextech-gold)' : '1px solid var(--glass-border)',
                                                background: soloDiv === d ? 'rgba(59, 130, 246, 0.12)' : 'rgba(0, 0, 0, 0.28)',
                                                color: soloDiv === d ? 'var(--hextech-gold)' : 'var(--text-secondary)',
                                                fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="rank-presentation-panel">
                            <div className="rank-presentation-heading">
                                <div><strong>Profile presentation</strong><small>League Points, previous rank and profile artwork.</small></div>
                            </div>
                            <div className="rank-presentation-grid">
                                <label htmlFor="rank-league-points" className="rank-presentation-field">
                                    <span>League Points</span><small>Current LP value</small>
                                    <input id="rank-league-points" aria-label="League Points" type="number" min="0" max="9999" step="1" value={leaguePoints} disabled={!lcu} onChange={(event) => setLeaguePoints(Math.min(9999, Math.max(0, Number.parseInt(event.target.value, 10) || 0)))} />
                                </label>
                                <label htmlFor="last-season-rank" className="rank-presentation-field">
                                    <span>Last Season Rank</span><small>Shown inside the tooltip</small>
                                    <select id="last-season-rank" aria-label="Last Season Rank" value={lastSeasonTier} disabled={!lcu} onChange={(event) => setLastSeasonTier(event.target.value)}>
                                        {LAST_SEASON_TIERS.map(tier => <option key={tier} value={tier}>{tier}</option>)}
                                    </select>
                                </label>
                                <label htmlFor="rank-banner" className="rank-presentation-field">
                                    <span>Rank Banner</span><small>Profile banner artwork</small>
                                    <select id="rank-banner" aria-label="Rank Banner" value={bannerTier} disabled={!lcu} onChange={(event) => setBannerTier(event.target.value)}>
                                        {BANNER_TIERS.map(tier => <option key={tier} value={tier}>{tier === 'AUTO' ? 'AUTOMATIC / LAST SEASON' : tier}</option>)}
                                    </select>
                                </label>
                                <label htmlFor="rank-border" className="rank-presentation-field">
                                    <span>Rank Border</span><small>Profile crest frame</small>
                                    <select id="rank-border" aria-label="Rank Border" value={borderTier} disabled={!lcu} onChange={(event) => setBorderTier(event.target.value)}>
                                        {BORDER_TIERS.map(tier => <option key={tier} value={tier}>{tier === 'AUTO' ? 'AUTOMATIC / CURRENT RANK' : tier}</option>)}
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom — PenguLoader Toggle + Actions */}
                <div className="card ui-action-dock rank-action-dock">
                        <div className="ui-action-dock__hint rank-overview-control">
                            <Monitor size={16} style={{ color: 'var(--hextech-gold)', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Profile Overview</span>
                            <span style={{ 
                                fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px',
                                background: pluginInstalled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                                color: pluginInstalled ? '#22c55e' : '#fbbf24',
                                fontWeight: 600, flexShrink: 0
                            }}>
                                {pluginInstalled ? 'Pengu ready' : 'Setup'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setOverviewEnabled(!overviewEnabled)}
                                aria-label="Toggle Profile Overview rank override"
                                aria-pressed={overviewEnabled}
                                style={{
                                    width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
                                    background: overviewEnabled ? 'var(--hextech-gold)' : 'rgba(255, 255, 255, 0.1)',
                                    position: 'relative', transition: 'all 0.2s', flexShrink: 0
                                }}
                            >
                                <span style={{
                                    position: 'absolute', top: '3px',
                                    left: overviewEnabled ? '21px' : '3px',
                                    width: '16px', height: '16px', borderRadius: '50%',
                                    background: overviewEnabled ? '#09090b' : 'rgba(255, 255, 255, 0.5)',
                                    transition: 'all 0.2s'
                                }}></span>
                            </button>
                        </div>

                        <div className="ui-action-dock__actions">
                            <button type="button" className="primary-btn" onClick={applyChanges} disabled={!lcu || loading || fetching}
                                style={{ padding: '9px 20px', fontSize: '0.85rem', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                                {loading ? '...' : 'APPLY'}
                            </button>
                            <button type="button" onClick={() => fetchCurrentData(queueType, true)} disabled={!lcu || fetching}
                                title="Read the current rank for the selected queue from the League Client"
                                style={{
                                    padding: '9px 20px', fontSize: '0.85rem', fontWeight: 800, borderRadius: '8px',
                                    border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)',
                                    color: 'var(--text-secondary)', cursor: 'pointer',
                                    textTransform: 'uppercase', letterSpacing: '1px',
                                    display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap'
                                }}>
                                <RefreshCw size={13} className={fetching ? 'intel-spinner' : ''} /> Sync
                            </button>
                        </div>
                </div>

                {/* PenguLoader Setup Guide */}
                <div className="card ui-panel">
                    <div className="ui-section-header">
                        <div className="ui-section-header__icon">
                            <Puzzle size={16} style={{ color: 'var(--hextech-gold)' }} />
                        </div>
                        <div className="ui-section-header__copy"><h3 className="ui-section-header__title">Profile Overview Setup Guide</h3><p className="ui-section-header__description">Three steps to enable the client-side rank card.</p></div>
                    </div>
                    <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        The Profile Overview shows your rank in the League client's profile card and tooltip.
                        This feature requires <a href="https://github.com/PenguLoader/PenguLoader" target="_blank" rel="noreferrer" style={{ color: 'var(--hextech-gold)' }}>PenguLoader</a> and a small plugin installed by this app.
                    </p>
                    <div className="rank-setup-grid">
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--hextech-gold)', marginBottom: '6px' }}>1. Install PenguLoader</div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                Go to <strong>Settings &gt; Pengu Loader</strong> and click <strong>Download Pengu Loader</strong> to install it.
                            </p>
                        </div>
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--hextech-gold)', marginBottom: '6px' }}>2. Install Plugin</div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                In <strong>Settings &gt; Pengu Loader</strong>, click <strong>Install / Update Plugin</strong>. This app installs the rank override plugin for you.
                            </p>
                        </div>
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--hextech-gold)', marginBottom: '6px' }}>3. Enable & Restart</div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                Toggle <strong>Profile Overview</strong> ON above, then restart the League Client. Your rank will appear on your profile.
                            </p>
                        </div>
                    </div>
                </div>

                {!lcu && (
                    <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', textAlign: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>Start League of Legends to enable this feature.</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(RankTab);

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Award, Flag, Medal, Trophy } from 'lucide-react';
import { LcuInfo } from '../../hooks/useLcu';
import { getCurrentRankedStats, LcuRequestFn } from '../../utils/chatMe';
import {
    PENGU_OVERVIEW_OVERRIDE_KEY,
    PENGU_PLUGIN_INSTALLED_KEY,
    SAVED_LAST_SEASON_RANK_KEY,
    SAVED_OVERVIEW_CARDS_KEY,
    SAVED_RANK_BANNER_KEY,
    SAVED_RANK_BORDER_KEY,
    SAVED_RANK_DIV_KEY,
    SAVED_RANK_LP_KEY,
    SAVED_RANK_QUEUE_KEY,
    SAVED_RANK_TIER_KEY,
} from '../../storageKeys';

interface OverviewTabProps {
    lcu: LcuInfo | null;
    showToast: (text: string, type: string) => void;
    addLog: (msg: string) => void;
    lcuRequest: LcuRequestFn;
}

interface ChampionSummary {
    id: number;
    name: string;
}

const CLASH_THEMES = ['AUTO', 'Bandle_City', 'Bilgewater', 'Demacia', 'Freljord', 'Ionia', 'Ixtal', 'Mount_Targon', 'Noxus', 'Piltover', 'Shadow_Isles', 'Shurima', 'Void', 'Zaun'];
const RANK_TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const CHAMPION_SUMMARY_URL = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json';
const fieldStyle: React.CSSProperties = { display: 'grid', gap: '7px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' };
const controlStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '7px', border: '1px solid var(--glass-border)', background: '#111318', color: 'var(--text-primary)', fontWeight: 700 };

function getSavedValue(key: string, fallback: string): string {
    try {
        const saved = JSON.parse(localStorage.getItem(SAVED_OVERVIEW_CARDS_KEY) || '{}') as Record<string, unknown>;
        return typeof saved[key] === 'string' ? saved[key] as string : fallback;
    } catch {
        return fallback;
    }
}

const OverviewTab: React.FC<OverviewTabProps> = ({ lcu, showToast, addLog, lcuRequest }) => {
    const [loading, setLoading] = useState(false);
    const [honorLevel, setHonorLevel] = useState(() => getSavedValue('honorLevel', 'AUTO'));
    const [masteryScore, setMasteryScore] = useState(() => getSavedValue('masteryScore', ''));
    const [masteryLevel, setMasteryLevel] = useState(() => getSavedValue('masteryLevel', 'AUTO'));
    const [masteryLevel2, setMasteryLevel2] = useState(() => getSavedValue('masteryLevel2', 'AUTO'));
    const [masteryLevel3, setMasteryLevel3] = useState(() => getSavedValue('masteryLevel3', 'AUTO'));
    const [masteryChampionId, setMasteryChampionId] = useState(() => getSavedValue('masteryChampionId', 'AUTO'));
    const [masteryChampionId2, setMasteryChampionId2] = useState(() => getSavedValue('masteryChampionId2', 'AUTO'));
    const [masteryChampionId3, setMasteryChampionId3] = useState(() => getSavedValue('masteryChampionId3', 'AUTO'));
    const [champions, setChampions] = useState<ChampionSummary[]>([]);
    const [trophyTheme, setTrophyTheme] = useState(() => getSavedValue('trophyTheme', 'AUTO'));
    const [trophyBracket, setTrophyBracket] = useState(() => getSavedValue('trophyBracket', '4'));
    const [trophyTier, setTrophyTier] = useState(() => getSavedValue('trophyTier', '4'));
    const [clashBannerTheme, setClashBannerTheme] = useState(() => getSavedValue('clashBannerTheme', 'AUTO'));
    const [clashBannerLevel, setClashBannerLevel] = useState(() => getSavedValue('clashBannerLevel', '1'));
    const [pluginInstalled, setPluginInstalled] = useState(() => localStorage.getItem(PENGU_PLUGIN_INSTALLED_KEY) === 'true');

    useEffect(() => {
        if (!lcu) return;
        let active = true;
        fetch(CHAMPION_SUMMARY_URL)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json() as Promise<ChampionSummary[]>;
            })
            .then((data) => {
                if (!active || !Array.isArray(data)) return;
                const list = data
                    .filter(champion => champion.id > 0 && champion.id < 66600 && champion.name)
                    .sort((a, b) => a.name.localeCompare(b.name));
                setChampions(list);
            })
            .catch(err => addLog(`Mastery champion list unavailable: ${err}`));
        return () => { active = false; };
    }, [lcu, addLog]);

    const applyChanges = async () => {
        if (!lcu) return;
        setLoading(true);
        try {
            const queue = localStorage.getItem(SAVED_RANK_QUEUE_KEY) || 'RANKED_SOLO_5x5';
            const rankedStats = await getCurrentRankedStats(lcuRequest);
            const queueMap = rankedStats?.queueMap && typeof rankedStats.queueMap === 'object'
                ? rankedStats.queueMap as Record<string, unknown>
                : {};
            const rankedEntry = queueMap[queue] && typeof queueMap[queue] === 'object'
                ? queueMap[queue] as Record<string, unknown>
                : {};
            const chat = await lcuRequest('GET', '/lol-chat/v1/me') as { lol?: string | Record<string, unknown> } | null;
            const chatLol = chat?.lol
                ? (typeof chat.lol === 'string' ? JSON.parse(chat.lol) as Record<string, unknown> : chat.lol)
                : {};
            const tier = String(localStorage.getItem(SAVED_RANK_TIER_KEY) || rankedEntry.tier || chatLol.rankedLeagueTier || '').toUpperCase();
            if (!RANK_TIERS.includes(tier)) throw new Error('Apply or sync a rank before saving Overview cards');

            const division = String(localStorage.getItem(SAVED_RANK_DIV_KEY) || rankedEntry.division || chatLol.rankedLeagueDivision || 'I').toUpperCase();
            const leaguePoints = Number(localStorage.getItem(SAVED_RANK_LP_KEY) ?? rankedEntry.leaguePoints ?? 0) || 0;
            const lastSeasonTier = String(localStorage.getItem(SAVED_LAST_SEASON_RANK_KEY) || rankedStats?.highestPreviousSeasonEndTier || 'UNRANKED').toUpperCase();
            const overviewCards = { honorLevel, masteryScore, masteryLevel, masteryLevel2, masteryLevel3, masteryChampionId, masteryChampionId2, masteryChampionId3, trophyTheme, trophyBracket, trophyTier, clashBannerTheme, clashBannerLevel };
            localStorage.setItem(SAVED_OVERVIEW_CARDS_KEY, JSON.stringify(overviewCards));

            await invoke('install_pengu_plugin');
            localStorage.setItem(PENGU_PLUGIN_INSTALLED_KEY, 'true');
            setPluginInstalled(true);
            await invoke('save_rank_config', {
                tier,
                division,
                queue,
                leaguePoints,
                lastSeasonTier,
                borderTier: localStorage.getItem(SAVED_RANK_BORDER_KEY) || 'AUTO',
                bannerTier: localStorage.getItem(SAVED_RANK_BANNER_KEY) || 'AUTO',
                honorLevel,
                masteryScore,
                masteryLevel,
                masteryLevel2,
                masteryLevel3,
                masteryChampionId,
                masteryChampionId2,
                masteryChampionId3,
                trophyTheme,
                trophyBracket: Number(trophyBracket),
                trophyTier: Number(trophyTier),
                clashBannerTheme,
                clashBannerLevel: Number(clashBannerLevel),
                overviewEnabled: localStorage.getItem(PENGU_OVERVIEW_OVERRIDE_KEY) !== 'false',
            });
            showToast('Overview Overrides Applied!', 'success');
            addLog('Overview card overrides updated successfully.');
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            showToast(`Overview update failed: ${message}`, 'error');
            addLog(`Overview card update failed: ${message}`);
        } finally {
            setLoading(false);
        }
    };

    const championOptions = (selectedId: string) => (
        <>
            <option value="AUTO">AUTOMATIC</option>
            {selectedId !== 'AUTO' && !champions.some(champion => String(champion.id) === selectedId) && <option value={selectedId}>CHAMPION #{selectedId}</option>}
            {champions.map(champion => <option key={champion.id} value={String(champion.id)}>{champion.name.toUpperCase()}</option>)}
        </>
    );

    const normalizeMasteryLevel = (value: string) => value === '' ? 'AUTO' : String(Math.max(1, Number.parseInt(value, 10) || 1));
    const masterySlots = [
        { number: '01', title: 'Center', detail: 'Primary profile card', suffix: '', championId: masteryChampionId, setChampionId: setMasteryChampionId, level: masteryLevel, setLevel: setMasteryLevel },
        { number: '02', title: 'Left', detail: 'First hover slot', suffix: '-left', championId: masteryChampionId2, setChampionId: setMasteryChampionId2, level: masteryLevel2, setLevel: setMasteryLevel2 },
        { number: '03', title: 'Right', detail: 'Third hover slot', suffix: '-right', championId: masteryChampionId3, setChampionId: setMasteryChampionId3, level: masteryLevel3, setLevel: setMasteryLevel3 },
    ];

    return (
        <div className="tab-content fadeIn overview-studio-page" style={{ padding: '0 20px 40px' }}>
            <div className="overview-studio-header">
                <div>
                    <h2>Overview Cards</h2>
                    <p>Customize Honor, Mastery and Clash cards shown on your profile.</p>
                </div>
                <span className={`overview-plugin-state ${pluginInstalled ? 'ready' : ''}`}>
                    {pluginInstalled ? 'Pengu ready' : 'Pengu required'}
                </span>
            </div>

            <div className="overview-studio-grid">
                <section className="card overview-module overview-mastery-module">
                    <header className="overview-module-header">
                        <div className="overview-module-icon"><Medal size={18} /></div>
                        <div><h3>Honor & Mastery</h3><p>Set progression values and the three champions shown on hover.</p></div>
                    </header>
                    <div className="overview-global-fields">
                        <label htmlFor="overview-honor-level" style={fieldStyle}>Honor Level
                            <select id="overview-honor-level" value={honorLevel} disabled={!lcu} onChange={(event) => setHonorLevel(event.target.value)} style={controlStyle}>
                                <option value="AUTO">AUTOMATIC</option>
                                {[1, 2, 3, 4, 5].map(level => <option key={level} value={String(level)}>LEVEL {level}</option>)}
                            </select>
                        </label>
                        <label htmlFor="overview-mastery-score" style={fieldStyle}>Mastery Score
                            <input id="overview-mastery-score" type="number" min="0" max="9999999" placeholder="Automatic" value={masteryScore} disabled={!lcu} onChange={(event) => setMasteryScore(event.target.value === '' ? '' : String(Math.min(9999999, Math.max(0, Number.parseInt(event.target.value, 10) || 0))))} style={{ ...controlStyle, background: 'rgba(0, 0, 0, 0.28)' }} />
                        </label>
                    </div>
                    <div className="overview-mastery-roster">
                        {masterySlots.map(slot => (
                            <div className="overview-mastery-row" key={slot.number}>
                                <div className="overview-slot-label"><div><strong>{slot.title}</strong><span>{slot.detail}</span></div></div>
                                <label htmlFor={`overview-mastery-champion${slot.suffix}`} style={fieldStyle}>Champion
                                    <select id={`overview-mastery-champion${slot.suffix}`} aria-label={`${slot.title === 'Center' ? 'Primary / Center' : `${slot.title} Hover`} Champion`} value={slot.championId} disabled={!lcu} onChange={(event) => slot.setChampionId(event.target.value)} style={controlStyle}>{championOptions(slot.championId)}</select>
                                </label>
                                <label htmlFor={`overview-mastery-level${slot.suffix}`} style={fieldStyle}>Level
                                    <input id={`overview-mastery-level${slot.suffix}`} aria-label={`${slot.title === 'Center' ? 'Primary / Center' : `${slot.title} Hover`} Mastery Level`} type="number" min="1" placeholder="Auto" value={slot.level === 'AUTO' ? '' : slot.level} disabled={!lcu} onChange={(event) => slot.setLevel(normalizeMasteryLevel(event.target.value))} style={{ ...controlStyle, background: 'rgba(0, 0, 0, 0.28)' }} />
                                </label>
                            </div>
                        ))}
                    </div>
                </section>

                <aside className="overview-clash-stack">
                    <section className="card overview-module overview-clash-module">
                        <header className="overview-module-header"><div className="overview-module-icon"><Trophy size={18} /></div><div><h3>Clash Trophy</h3><p>Choose the cup, bracket and tier.</p></div></header>
                        <div className="overview-clash-fields">
                            <label htmlFor="overview-trophy-theme" style={fieldStyle}>Theme
                                <select id="overview-trophy-theme" aria-label="Clash Trophy" value={trophyTheme} disabled={!lcu} onChange={(event) => setTrophyTheme(event.target.value)} style={controlStyle}>{CLASH_THEMES.map(theme => <option key={theme} value={theme}>{theme === 'AUTO' ? 'AUTOMATIC' : theme.replaceAll('_', ' ')}</option>)}</select>
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', opacity: trophyTheme === 'AUTO' ? 0.5 : 1 }}>
                                <label htmlFor="overview-trophy-bracket" style={fieldStyle}>Bracket
                                    <select id="overview-trophy-bracket" aria-label="Trophy Bracket" value={trophyBracket} disabled={!lcu || trophyTheme === 'AUTO'} onChange={(event) => setTrophyBracket(event.target.value)} style={controlStyle}>{[4, 8, 16].map(bracket => <option key={bracket} value={String(bracket)}>{bracket} TEAMS</option>)}</select>
                                </label>
                                <label htmlFor="overview-trophy-tier" style={fieldStyle}>Tier
                                    <select id="overview-trophy-tier" aria-label="Trophy Tier" value={trophyTier} disabled={!lcu || trophyTheme === 'AUTO'} onChange={(event) => setTrophyTier(event.target.value)} style={controlStyle}>{[1, 2, 3, 4].map(tier => <option key={tier} value={String(tier)}>TIER {tier}</option>)}</select>
                                </label>
                            </div>
                        </div>
                    </section>

                    <section className="card overview-module overview-clash-module">
                        <header className="overview-module-header"><div className="overview-module-icon"><Flag size={18} /></div><div><h3>Clash Banner</h3><p>Choose the regional flag and level.</p></div></header>
                        <div className="overview-clash-fields">
                            <label htmlFor="overview-clash-banner-theme" style={fieldStyle}>Theme
                                <select id="overview-clash-banner-theme" aria-label="Clash Banner" value={clashBannerTheme} disabled={!lcu} onChange={(event) => setClashBannerTheme(event.target.value)} style={controlStyle}>{CLASH_THEMES.map(theme => <option key={theme} value={theme}>{theme === 'AUTO' ? 'AUTOMATIC' : theme.replaceAll('_', ' ')}</option>)}</select>
                            </label>
                            <label htmlFor="overview-clash-banner-level" style={{ ...fieldStyle, opacity: clashBannerTheme === 'AUTO' ? 0.5 : 1 }}>Banner Level
                                <select id="overview-clash-banner-level" value={clashBannerLevel} disabled={!lcu || clashBannerTheme === 'AUTO'} onChange={(event) => setClashBannerLevel(event.target.value)} style={controlStyle}>{[1, 2, 3].map(level => <option key={level} value={String(level)}>LEVEL {level}</option>)}</select>
                            </label>
                        </div>
                    </section>
                </aside>
            </div>

            <div className="overview-action-dock card">
                <div><Award size={17} /><span>Automatic keeps Riot's original value.</span></div>
                <button type="button" className="primary-btn" onClick={applyChanges} disabled={!lcu || loading}>{loading ? 'APPLYING...' : 'APPLY OVERVIEW'}</button>
            </div>
        </div>
    );
};

export default OverviewTab;

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
    squarePortraitPath?: string;
}

const CLASH_THEMES = ['AUTO', 'Bandle_City', 'Bilgewater', 'Demacia', 'Freljord', 'Ionia', 'Ixtal', 'Mount_Targon', 'Noxus', 'Piltover', 'Shadow_Isles', 'Shurima', 'Void', 'Zaun'];
const RANK_TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';
const CHAMPION_SUMMARY_URL = `${CDRAGON_BASE}/v1/champion-summary.json`;

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
    const championInitials = (id: string) => {
        if (id === 'AUTO') return 'A';
        const name = champions.find(champion => String(champion.id) === id)?.name || id;
        return name.slice(0, 2).toUpperCase();
    };
    const championName = (id: string) => champions.find(champion => String(champion.id) === id)?.name || `Champion ${id}`;
    const championIconUrl = (id: string) => {
        const champion = champions.find(candidate => String(candidate.id) === id);
        if (champion?.squarePortraitPath) {
            return `${CDRAGON_BASE}${champion.squarePortraitPath.replace('/lol-game-data/assets', '').toLowerCase()}`;
        }
        return `${CDRAGON_BASE}/v1/champion-icons/${encodeURIComponent(id)}.png`;
    };

    return (
        <div className="tab-content fadeIn overview-studio-page ui-page">
            <div className="overview-studio-header ui-page-header">
                <div className="ui-page-header__copy">
                    <h2 className="ui-page-header__title">Overview Cards</h2>
                    <p className="ui-page-header__description">Customize Honor, Mastery and Clash cards shown on your profile.</p>
                </div>
                <div className="ui-page-header__actions">
                    <span className={`overview-plugin-state ${pluginInstalled ? 'ready' : ''}`}>
                        {pluginInstalled ? 'Pengu ready' : 'Pengu required'}
                    </span>
                </div>
            </div>

            <div className="overview-studio-grid">
                <div className="overview-control-stack">
                <section className="card overview-module overview-mastery-module">
                    <header className="overview-module-header ui-section-header">
                        <div className="overview-module-icon ui-section-header__icon"><Medal size={18} /></div>
                        <div className="ui-section-header__copy"><h3 className="ui-section-header__title">Honor & Mastery</h3><p className="ui-section-header__description">Set progression values and the three champions shown on hover.</p></div>
                    </header>
                    <div className="overview-global-fields">
                        <label htmlFor="overview-honor-level" className="ui-field">Honor Level
                            <select id="overview-honor-level" className="ui-control" value={honorLevel} disabled={!lcu} onChange={(event) => setHonorLevel(event.target.value)}>
                                <option value="AUTO">AUTOMATIC</option>
                                {[1, 2, 3, 4, 5].map(level => <option key={level} value={String(level)}>LEVEL {level}</option>)}
                            </select>
                        </label>
                        <label htmlFor="overview-mastery-score" className="ui-field">Mastery Score
                            <input id="overview-mastery-score" className="ui-control" type="number" min="0" max="9999999" placeholder="Automatic" value={masteryScore} disabled={!lcu} onChange={(event) => setMasteryScore(event.target.value === '' ? '' : String(Math.min(9999999, Math.max(0, Number.parseInt(event.target.value, 10) || 0))))} />
                        </label>
                    </div>
                    <div className="overview-mastery-roster">
                        {masterySlots.map(slot => (
                            <div className="overview-mastery-row" key={slot.number}>
                                <div className="overview-slot-label"><div><strong>{slot.title}</strong><span>{slot.detail}</span></div></div>
                                <label htmlFor={`overview-mastery-champion${slot.suffix}`} className="ui-field">Champion
                                    <select id={`overview-mastery-champion${slot.suffix}`} className="ui-control" aria-label={`${slot.title === 'Center' ? 'Primary / Center' : `${slot.title} Hover`} Champion`} value={slot.championId} disabled={!lcu} onChange={(event) => slot.setChampionId(event.target.value)}>{championOptions(slot.championId)}</select>
                                </label>
                                <label htmlFor={`overview-mastery-level${slot.suffix}`} className="ui-field">Level
                                    <input id={`overview-mastery-level${slot.suffix}`} className="ui-control" aria-label={`${slot.title === 'Center' ? 'Primary / Center' : `${slot.title} Hover`} Mastery Level`} type="number" min="1" placeholder="Auto" value={slot.level === 'AUTO' ? '' : slot.level} disabled={!lcu} onChange={(event) => slot.setLevel(normalizeMasteryLevel(event.target.value))} />
                                </label>
                            </div>
                        ))}
                    </div>
                </section>

                <aside className="overview-clash-stack">
                    <section className="card overview-module overview-clash-module">
                        <header className="overview-module-header ui-section-header"><div className="overview-module-icon ui-section-header__icon"><Trophy size={18} /></div><div className="ui-section-header__copy"><h3 className="ui-section-header__title">Clash Trophy</h3><p className="ui-section-header__description">Choose the cup, bracket and tier.</p></div></header>
                        <div className="overview-clash-fields">
                            <label htmlFor="overview-trophy-theme" className="ui-field">Theme
                                <select id="overview-trophy-theme" className="ui-control" aria-label="Clash Trophy" value={trophyTheme} disabled={!lcu} onChange={(event) => setTrophyTheme(event.target.value)}>{CLASH_THEMES.map(theme => <option key={theme} value={theme}>{theme === 'AUTO' ? 'AUTOMATIC' : theme.replaceAll('_', ' ')}</option>)}</select>
                            </label>
                            <div className="overview-trophy-meta-grid" style={{ opacity: trophyTheme === 'AUTO' ? 0.5 : 1 }}>
                                <label htmlFor="overview-trophy-bracket" className="ui-field">Bracket
                                    <select id="overview-trophy-bracket" className="ui-control" aria-label="Trophy Bracket" value={trophyBracket} disabled={!lcu || trophyTheme === 'AUTO'} onChange={(event) => setTrophyBracket(event.target.value)}>{[4, 8, 16].map(bracket => <option key={bracket} value={String(bracket)}>{bracket} TEAMS</option>)}</select>
                                </label>
                                <label htmlFor="overview-trophy-tier" className="ui-field">Tier
                                    <select id="overview-trophy-tier" className="ui-control" aria-label="Trophy Tier" value={trophyTier} disabled={!lcu || trophyTheme === 'AUTO'} onChange={(event) => setTrophyTier(event.target.value)}>{[1, 2, 3, 4].map(tier => <option key={tier} value={String(tier)}>TIER {tier}</option>)}</select>
                                </label>
                            </div>
                        </div>
                    </section>

                    <section className="card overview-module overview-clash-module">
                        <header className="overview-module-header ui-section-header"><div className="overview-module-icon ui-section-header__icon"><Flag size={18} /></div><div className="ui-section-header__copy"><h3 className="ui-section-header__title">Clash Banner</h3><p className="ui-section-header__description">Choose the regional flag and level.</p></div></header>
                        <div className="overview-clash-fields">
                            <label htmlFor="overview-clash-banner-theme" className="ui-field">Theme
                                <select id="overview-clash-banner-theme" className="ui-control" aria-label="Clash Banner" value={clashBannerTheme} disabled={!lcu} onChange={(event) => setClashBannerTheme(event.target.value)}>{CLASH_THEMES.map(theme => <option key={theme} value={theme}>{theme === 'AUTO' ? 'AUTOMATIC' : theme.replaceAll('_', ' ')}</option>)}</select>
                            </label>
                            <label htmlFor="overview-clash-banner-level" className="ui-field" style={{ opacity: clashBannerTheme === 'AUTO' ? 0.5 : 1 }}>Banner Level
                                <select id="overview-clash-banner-level" className="ui-control" value={clashBannerLevel} disabled={!lcu || clashBannerTheme === 'AUTO'} onChange={(event) => setClashBannerLevel(event.target.value)}>{[1, 2, 3].map(level => <option key={level} value={String(level)}>LEVEL {level}</option>)}</select>
                            </label>
                        </div>
                    </section>
                </aside>
                </div>

                <aside className="card overview-live-preview" aria-label="Overview live preview">
                    <header><div><span>Preview</span><strong>Overview Modules</strong></div><b>LIVE</b></header>
                    <div className="overview-preview-mastery">
                        <span>MASTERY</span>
                        <div className="overview-preview-champions">
                            {masterySlots.map(slot => (
                                <b key={slot.number}>
                                    {championInitials(slot.championId)}
                                    {slot.championId !== 'AUTO' && /^\d+$/.test(slot.championId) && (
                                        <img
                                            key={slot.championId}
                                            src={championIconUrl(slot.championId)}
                                            alt={championName(slot.championId)}
                                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                                        />
                                    )}
                                    <small className="overview-preview-mastery-level" aria-label={`${slot.title} mastery level`}>{slot.level}</small>
                                </b>
                            ))}
                        </div>
                        <strong>{masteryScore || 'AUTO'} <small>TOTAL SCORE</small></strong>
                    </div>
                    <div className="overview-preview-pair">
                        <div><span>CLASH TROPHY</span><b>{trophyTheme === 'AUTO' ? 'AUTO' : trophyTheme.replaceAll('_', ' ')}</b><small>{trophyTheme === 'AUTO' ? 'Automatic bracket / tier' : `${trophyBracket} teams / Tier ${trophyTier}`}</small></div>
                        <div><span>HONOR</span><b>{honorLevel}</b><small>Selected level</small></div>
                    </div>
                    <div className="overview-preview-banner"><span>CLASH BANNER</span><strong>{clashBannerTheme === 'AUTO' ? 'AUTOMATIC' : clashBannerTheme.replaceAll('_', ' ')}</strong><small>{clashBannerTheme === 'AUTO' ? 'Automatic level' : `Level ${clashBannerLevel}`}</small></div>
                </aside>
            </div>

            <div className="overview-action-dock card ui-action-dock">
                <div className="ui-action-dock__hint"><Award size={17} /><span>Automatic keeps Riot's original value.</span></div>
                <button type="button" className="primary-btn" onClick={applyChanges} disabled={!lcu || loading}>{loading ? 'APPLYING...' : 'APPLY OVERVIEW'}</button>
            </div>
        </div>
    );
};

export default OverviewTab;

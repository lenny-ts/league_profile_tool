import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import OverviewTab from './OverviewTab';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('OverviewTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockInvoke.mockResolvedValue(undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([
                { id: 266, name: 'Aatrox', squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/266.png' },
                { id: 103, name: 'Ahri' },
                { id: 86, name: 'Garen' },
            ]),
        }));
    });

    const createProps = () => ({
        lcu: { port: '1234', token: 'secret' },
        showToast: vi.fn(),
        addLog: vi.fn(),
        lcuRequest: vi.fn().mockImplementation((method, endpoint) => {
            if (method === 'GET' && endpoint === '/lol-ranked/v1/current-ranked-stats') {
                return Promise.resolve({
                    highestPreviousSeasonEndTier: 'DIAMOND',
                    queueMap: { RANKED_SOLO_5x5: { tier: 'MASTER', division: 'I', leaguePoints: 246 } },
                });
            }
            if (method === 'GET' && endpoint === '/lol-chat/v1/me') {
                return Promise.resolve({ lol: { rankedLeagueTier: 'MASTER', rankedLeagueDivision: 'I' } });
            }
            return Promise.resolve({});
        }),
    });

    it('should render Overview controls outside RankTab', async () => {
        render(<OverviewTab {...createProps()} />);
        expect(screen.getByText('Honor & Mastery')).toBeDefined();
        expect(screen.getByText('Clash Trophy')).toBeDefined();
        expect(screen.getByText('Clash Banner')).toBeDefined();
        expect(screen.getByText('APPLY OVERVIEW')).toBeDefined();
        expect(screen.getByText('Overview Modules')).toBeDefined();
        expect(screen.queryByText('Summoner')).toBeNull();
        const preview = within(screen.getByLabelText('Overview live preview'));
        expect(preview.getByText('Automatic bracket / tier')).toBeDefined();
        expect(preview.getByText('Automatic level')).toBeDefined();
        expect(screen.getByLabelText('Trophy Bracket').closest('div')).toHaveClass('overview-trophy-meta-grid');
        expect((await screen.findAllByText('AATROX')).length).toBe(3);
    });

    it('should persist and apply Overview card overrides with the current rank config', async () => {
        const props = createProps();
        render(<OverviewTab {...props} />);

        fireEvent.change(screen.getByLabelText('Honor Level'), { target: { value: '5' } });
        fireEvent.change(screen.getByLabelText('Mastery Score'), { target: { value: '13579' } });
        fireEvent.change(screen.getByLabelText('Primary / Center Mastery Level'), { target: { value: '37' } });
        fireEvent.change(screen.getByLabelText('Left Hover Mastery Level'), { target: { value: '8' } });
        fireEvent.change(screen.getByLabelText('Right Hover Mastery Level'), { target: { value: '15' } });
        expect(screen.getByLabelText('Center mastery level')).toHaveTextContent('37');
        expect(screen.getByLabelText('Left mastery level')).toHaveTextContent('8');
        expect(screen.getByLabelText('Right mastery level')).toHaveTextContent('15');
        await screen.findAllByText('AATROX');
        fireEvent.change(screen.getByLabelText('Primary / Center Champion'), { target: { value: '266' } });
        fireEvent.change(screen.getByLabelText('Left Hover Champion'), { target: { value: '103' } });
        fireEvent.change(screen.getByLabelText('Right Hover Champion'), { target: { value: '86' } });
        expect((await screen.findByRole('img', { name: 'Aatrox' })).getAttribute('src')).toContain('/266.png');
        fireEvent.change(screen.getByLabelText('Clash Trophy'), { target: { value: 'Demacia' } });
        fireEvent.change(screen.getByLabelText('Trophy Bracket'), { target: { value: '8' } });
        fireEvent.change(screen.getByLabelText('Trophy Tier'), { target: { value: '3' } });
        fireEvent.change(screen.getByLabelText('Clash Banner'), { target: { value: 'Ionia' } });
        fireEvent.change(screen.getByLabelText('Banner Level'), { target: { value: '2' } });
        fireEvent.click(screen.getByText('APPLY OVERVIEW'));

        await waitFor(() => {
            expect(JSON.parse(localStorage.getItem('profile_saved_overview_cards_v1') || '{}')).toEqual({
                honorLevel: '5', masteryScore: '13579', masteryLevel: '37', masteryLevel2: '8', masteryLevel3: '15', masteryChampionId: '266', masteryChampionId2: '103', masteryChampionId3: '86', trophyTheme: 'Demacia',
                trophyBracket: '8', trophyTier: '3', clashBannerTheme: 'Ionia', clashBannerLevel: '2',
            });
            expect(mockInvoke).toHaveBeenCalledWith('save_rank_config', expect.objectContaining({
                tier: 'MASTER', leaguePoints: 246, lastSeasonTier: 'DIAMOND', honorLevel: '5',
                masteryScore: '13579', masteryLevel: '37', masteryLevel2: '8', masteryLevel3: '15', masteryChampionId: '266', masteryChampionId2: '103', masteryChampionId3: '86', trophyTheme: 'Demacia', trophyBracket: 8,
                trophyTier: 3, clashBannerTheme: 'Ionia', clashBannerLevel: 2,
            }));
            expect(mockInvoke).toHaveBeenCalledWith('install_pengu_plugin');
            expect(props.showToast).toHaveBeenCalledWith('Overview Overrides Applied!', 'success');
        });
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RankTab from './RankTab';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('RankTab', () => {
    const createMockProps = () => {
        const lcuRequest = vi.fn().mockImplementation((method, endpoint) => {
            if (method === "GET" && endpoint === "/lol-chat/v1/me") {
                return Promise.resolve({
                    lol: {
                        rankedLeagueTier: "CHALLENGER",
                        rankedLeagueDivision: "I",
                        rankedLeagueQueue: "RANKED_SOLO_5x5",
                        challengeCrystalLevel: "CHALLENGER",
                        challengePoints: 1200
                    }
                });
            }
            return Promise.resolve({});
        });

        return {
            lcu: { port: '1234', token: 'secret' },
            showToast: vi.fn(),
            addLog: vi.fn(),
            lcuRequest
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockInvoke.mockResolvedValue(undefined);
    });

    it('should render only rank customization controls and sync from LCU on mount', async () => {
        const props = createMockProps();
        render(<RankTab {...props} />);

        const rankSection = (await screen.findByText('Rank Override')).closest('.card');
        expect(rankSection).toBeDefined();
        expect(screen.queryByText('Challenge Crystal Override')).toBeNull();
        expect(screen.queryByLabelText('Challenge Points')).toBeNull();
        expect(screen.queryByLabelText('Honor Level')).toBeNull();
        expect(props.lcuRequest).toHaveBeenCalledWith("GET", "/lol-chat/v1/me");
    });

    it('should update rank preview when selection changes', async () => {
        const props = createMockProps();
        render(<RankTab {...props} />);

        const goldBtn = await screen.findAllByText('GOLD');
        fireEvent.click(goldBtn[0]!);

        const goldElements = screen.getAllByText(/GOLD/);
        expect(goldElements.length).toBeGreaterThan(0);
    });

    it('should apply a custom League Points value to the overview config', async () => {
        const props = createMockProps();
        render(<RankTab {...props} />);

        await waitFor(() => expect(props.addLog).toHaveBeenCalledWith('Rank status synced successfully.'));
        fireEvent.change(screen.getByLabelText('League Points'), { target: { value: '742' } });
        fireEvent.click(screen.getByText('APPLY'));

        await waitFor(() => {
            expect(localStorage.getItem('profile_saved_rank_lp_v1')).toBe('742');
            expect(mockInvoke).toHaveBeenCalledWith('save_rank_config', expect.objectContaining({
                leaguePoints: 742,
            }));
        });
    });

    it('should apply a custom Last Season Rank to the overview config', async () => {
        const props = createMockProps();
        render(<RankTab {...props} />);

        await waitFor(() => expect(props.addLog).toHaveBeenCalledWith('Rank status synced successfully.'));
        fireEvent.change(screen.getByLabelText('Last Season Rank'), { target: { value: 'DIAMOND' } });
        fireEvent.click(screen.getByText('APPLY'));

        await waitFor(() => {
            expect(localStorage.getItem('profile_saved_last_season_rank_v1')).toBe('DIAMOND');
            expect(mockInvoke).toHaveBeenCalledWith('save_rank_config', expect.objectContaining({
                lastSeasonTier: 'DIAMOND',
            }));
        });
    });

    it('should apply an independently selected rank border', async () => {
        const props = createMockProps();
        render(<RankTab {...props} />);

        await waitFor(() => expect(props.addLog).toHaveBeenCalledWith('Rank status synced successfully.'));
        fireEvent.change(screen.getByLabelText('Rank Border'), { target: { value: 'MASTER' } });
        fireEvent.click(screen.getByText('APPLY'));

        await waitFor(() => {
            expect(localStorage.getItem('profile_saved_rank_border_v1')).toBe('MASTER');
            expect(mockInvoke).toHaveBeenCalledWith('save_rank_config', expect.objectContaining({
                borderTier: 'MASTER',
            }));
        });
    });

    it('should apply an independently selected rank banner', async () => {
        const props = createMockProps();
        render(<RankTab {...props} />);

        await waitFor(() => expect(props.addLog).toHaveBeenCalledWith('Rank status synced successfully.'));
        fireEvent.change(screen.getByLabelText('Rank Banner'), { target: { value: 'CHALLENGER' } });
        fireEvent.click(screen.getByText('APPLY'));

        await waitFor(() => {
            expect(localStorage.getItem('profile_saved_rank_banner_v1')).toBe('CHALLENGER');
            expect(mockInvoke).toHaveBeenCalledWith('save_rank_config', expect.objectContaining({
                bannerTier: 'CHALLENGER',
            }));
        });
    });

    it('should offer the current ranked queue types', async () => {
        const props = createMockProps();
        render(<RankTab {...props} />);

        expect(screen.getByRole('button', { name: 'Solo/Duo' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Flex 5v5' })).toBeDefined();
        expect(screen.getByRole('button', { name: '5v5' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'TFT' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Double Up' })).toBeDefined();
        expect(screen.queryByRole('button', { name: 'Flex 3v3' })).toBeNull();
        expect(screen.getByTitle('GRANDMASTER rank tier').parentElement).toHaveClass('rank-tier-grid');
        expect(screen.getByText('1. Install PenguLoader').parentElement?.parentElement).toHaveClass('rank-setup-grid');
        await waitFor(() => expect(props.addLog).toHaveBeenCalledWith('Rank status synced successfully.'));
    });

    it('should explain the Pengu requirement for the Overview override', async () => {
        const props = createMockProps();
        render(<RankTab {...props} />);

        expect(screen.getAllByText('Profile Overview').length).toBeGreaterThan(0);
        expect(screen.getByText('Setup')).toBeDefined();
        expect(screen.getByText(/Profile Overview.*Setup Guide/)).toBeDefined();
        expect(screen.getAllByText(/Settings > Pengu Loader/).length).toBeGreaterThan(0);
        await waitFor(() => expect(props.addLog).toHaveBeenCalledWith('Rank status synced successfully.'));
    });

    it('should persist and apply the Overview preference independently', async () => {
        const props = createMockProps();
        render(<RankTab {...props} />);

        const overviewToggle = screen.getByRole('button', { name: 'Toggle Profile Overview rank override' });
        fireEvent.click(overviewToggle);

        const applyButton = screen.getByText('APPLY') as HTMLButtonElement;
        await waitFor(() => expect(applyButton.disabled).toBe(false));
        fireEvent.click(applyButton);

        await waitFor(() => {
            expect(localStorage.getItem('pengu_overview_override_v1')).toBe('false');
            expect(mockInvoke).toHaveBeenCalledWith('save_rank_config', expect.objectContaining({
                overviewEnabled: false,
            }));
            expect(props.lcuRequest).toHaveBeenCalledWith('PUT', '/lol-chat/v1/me', expect.anything());
        });
    });

    it('should call lcuRequest with correct parameters on apply', async () => {
        const props = createMockProps();
        render(<RankTab {...props} />);

        const applyBtn = await screen.findByText('APPLY');
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(props.lcuRequest).toHaveBeenCalledWith("PUT", "/lol-chat/v1/me", expect.objectContaining({
                lol: expect.objectContaining({
                    rankedLeagueTier: "CHALLENGER",
                    rankedLeagueDivision: "I",
                    rankedLeagueQueue: "RANKED_SOLO_5x5"
                })
            }));
            expect(props.showToast).toHaveBeenCalledWith("Rank Overrides Applied!", "success");
        });
    });

    it('should handle apply errors gracefully', async () => {
        const props = createMockProps();
        props.lcuRequest.mockImplementation((method, endpoint) => {
            if (method === "PUT" && endpoint === "/lol-chat/v1/me") {
                return Promise.reject(new Error("Network Error"));
            }
            return Promise.resolve({});
        });

        render(<RankTab {...props} />);

        const applyBtn = await screen.findByText('APPLY');
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(props.showToast).toHaveBeenCalledWith(expect.stringContaining("Customization failed: Network Error"), "error");
            expect(props.addLog).toHaveBeenCalledWith(expect.stringContaining("Customization application failed: Network Error"));
        });
    });

    it('should disable apply button when LCU is missing', async () => {
        const props = createMockProps() as any;
        props.lcu = null;

        render(<RankTab {...props} />);
        const applyBtn = screen.getByText('APPLY');
        expect((applyBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('should sync the selected queue from current ranked stats', async () => {
        const props = createMockProps();
        props.lcuRequest.mockImplementation((method, endpoint) => {
            if (method === 'GET' && endpoint === '/lol-ranked/v1/current-ranked-stats') {
                return Promise.resolve({
                    highestPreviousSeasonEndTier: 'PLATINUM',
                    queueMap: {
                        RANKED_SOLO_5x5: { tier: 'GOLD', division: 'II', leaguePoints: 64 },
                    },
                });
            }
            return Promise.resolve({});
        });

        render(<RankTab {...props} />);

        await waitFor(() => {
            expect(screen.getByTitle('GOLD rank tier')).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByLabelText('League Points')).toHaveValue(64);
            expect(screen.getByLabelText('Last Season Rank')).toHaveValue('PLATINUM');
            expect(props.lcuRequest).toHaveBeenCalledWith('GET', '/lol-ranked/v1/current-ranked-stats');
        });

        fireEvent.click(screen.getByTitle('Read the current rank for the selected queue from the League Client'));
        await waitFor(() => expect(props.showToast).toHaveBeenCalledWith('Rank synced from League Client', 'success'));
    });
});

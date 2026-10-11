import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChallengeLevelTab from './ChallengeLevelTab';

describe('ChallengeLevelTab', () => {
    const createMockProps = () => {
        const lcuRequest = vi.fn().mockImplementation((method, endpoint) => {
            if (method === 'GET' && endpoint === '/lol-chat/v1/me') {
                return Promise.resolve({
                    lol: {
                        challengeCrystalLevel: 'CHALLENGER',
                        challengePoints: '1200',
                        rankedLeagueTier: 'GOLD',
                    },
                });
            }
            return Promise.resolve({});
        });

        return {
            lcu: { port: '1234', token: 'secret' },
            showToast: vi.fn(),
            addLog: vi.fn(),
            lcuRequest,
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should render as a dedicated feature and sync challenge data', async () => {
        const props = createMockProps();
        render(<ChallengeLevelTab {...props} />);

        expect(screen.getByText('Challenge Level')).toBeDefined();
        expect(screen.getByLabelText('Challenge level preview')).toBeDefined();
        expect(screen.getByLabelText('Challenge level preview').parentElement).toHaveClass('challenge-summary-grid');
        expect(screen.getByText('APPLY CHALLENGE LEVEL').parentElement).toHaveClass('challenge-action-row');
        await waitFor(() => expect(props.addLog).toHaveBeenCalledWith('Challenge level synced successfully.'));
    });

    it('should update the crystal readout and points inspector', async () => {
        const props = createMockProps();
        render(<ChallengeLevelTab {...props} />);
        await waitFor(() => expect(props.addLog).toHaveBeenCalledWith('Challenge level synced successfully.'));

        const goldCrystal = screen.getByTitle('GOLD challenge crystal');
        fireEvent.click(goldCrystal);
        fireEvent.change(screen.getByLabelText('Challenge Points'), { target: { value: '3456' } });

        expect(goldCrystal).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByLabelText('Challenge level preview')).toHaveTextContent('GOLD');
        expect(screen.getByLabelText('Challenge Points')).toHaveValue(3456);
    });

    it('should apply and persist only challenge fields', async () => {
        const props = createMockProps();
        render(<ChallengeLevelTab {...props} />);
        await waitFor(() => expect((screen.getByText('APPLY CHALLENGE LEVEL') as HTMLButtonElement).disabled).toBe(false));

        fireEvent.click(screen.getByTitle('DIAMOND challenge crystal'));
        fireEvent.change(screen.getByLabelText('Challenge Points'), { target: { value: '2500' } });
        fireEvent.click(screen.getByText('APPLY CHALLENGE LEVEL'));

        await waitFor(() => {
            expect(props.lcuRequest).toHaveBeenCalledWith('PUT', '/lol-chat/v1/me', expect.objectContaining({
                lol: expect.objectContaining({
                    challengeCrystalLevel: 'DIAMOND',
                    challengePoints: '2500',
                    rankedLeagueTier: 'GOLD',
                }),
            }));
            expect(localStorage.getItem('profile_saved_challenge_crystal_v1')).toBe('DIAMOND');
            expect(localStorage.getItem('profile_saved_challenge_points_v1')).toBe('2500');
            expect(props.showToast).toHaveBeenCalledWith('Challenge Level Applied!', 'success');
        });
    });

    it('should disable controls without an LCU connection', () => {
        const props = { ...createMockProps(), lcu: null };
        render(<ChallengeLevelTab {...props} />);

        expect(screen.getByText('APPLY CHALLENGE LEVEL')).toBeDisabled();
        expect(screen.getByText('League client connection required.')).toBeDefined();
    });

    it('should sync official challenge summary data and show feedback', async () => {
        const props = createMockProps();
        props.lcuRequest.mockImplementation((method, endpoint) => {
            if (method === 'GET' && endpoint === '/lol-challenges/v1/summary-player-data/local-player') {
                return Promise.resolve({
                    overallChallengeLevel: 'DIAMOND',
                    totalChallengeScore: 4321,
                });
            }
            return Promise.resolve({});
        });

        render(<ChallengeLevelTab {...props} />);

        await waitFor(() => {
            expect(screen.getByTitle('DIAMOND challenge crystal')).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByLabelText('Challenge Points')).toHaveValue(4321);
        });

        fireEvent.click(screen.getByTitle('Read the current challenge crystal and points from the League Client'));
        await waitFor(() => expect(props.showToast).toHaveBeenCalledWith('Challenge level synced from League Client', 'success'));
    });

    it('should read object-shaped challenge points without rendering an object string', async () => {
        const props = createMockProps();
        props.lcuRequest.mockImplementation((method, endpoint) => {
            if (method === 'GET' && endpoint === '/lol-challenges/v1/summary-player-data/local-player') {
                return Promise.resolve({
                    overallChallengeLevel: 'MASTER',
                    challengePoints: { current: 9876, max: 10000 },
                });
            }
            return Promise.resolve({});
        });

        render(<ChallengeLevelTab {...props} />);

        await waitFor(() => {
            expect(screen.getByLabelText('Challenge Points')).toHaveValue(9876);
            expect(screen.getByLabelText('Challenge Points')).not.toHaveValue('[object Object]');
        });
    });
});

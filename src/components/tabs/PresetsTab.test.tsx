import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PresetsTab from './PresetsTab';
import {
    SAVED_AVAILABILITY_KEY,
    SAVED_BIO_KEY,
    SAVED_ICON_KEY,
    SAVED_BACKGROUND_KEY,
    SAVED_CUSTOM_BACKGROUND_KEY,
    SAVED_TOKENS_KEY,
    SAVED_TITLE_KEY
} from '../../storageKeys';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('PresetsTab', () => {
    const mockLcu = { port: '1234', token: 'secret' };
    const mockShowToast = vi.fn();
    const mockAddLog = vi.fn();
    const mockLcuRequest = vi.fn();

    const mockPresets = [
        {
            id: 'preset-1',
            name: 'Classic Solo Queue',
            bio: 'Tryharding',
            availability: 'dnd',
            iconId: '500',
            backgroundId: '266000',
            tokens: '[1,2,3]',
            title: 'Challenger',
            bannerAccent: '3',
            crestBorder: '5'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.mocked(invoke).mockResolvedValue(JSON.stringify(mockPresets));
        mockLcuRequest.mockImplementation((method: string, endpoint: string) => {
            if (method === 'GET' && endpoint.includes('summary-player-data')) {
                return Promise.resolve({ bannerAccent: '3', crestBorder: '5', prestigeCrestBorderLevel: 0 });
            }
            return Promise.resolve({});
        });
    });

    it('should render profiles presets header and load items from Tauri disk storage', async () => {
        render(
            <PresetsTab 
                lcu={mockLcu} 
                showToast={mockShowToast} 
                addLog={mockAddLog} 
                lcuRequest={mockLcuRequest} 
            />
        );

        expect(screen.getByText('Profile Presets')).toBeDefined();
        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('load_presets');
            expect(screen.getByText('Classic Solo Queue')).toBeDefined();
        });
    });

    it('should fall back to localStorage migration if disk load fails', async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error('Disk read failed'));
        localStorage.setItem('profile_presets_list_v1', JSON.stringify(mockPresets));

        render(
            <PresetsTab 
                lcu={mockLcu} 
                showToast={mockShowToast} 
                addLog={mockAddLog} 
                lcuRequest={mockLcuRequest} 
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Classic Solo Queue')).toBeDefined();
            expect(invoke).toHaveBeenCalledWith('save_presets', { data: JSON.stringify(mockPresets) });
        });
    });

    it('should support saving the current profile status as a new preset', async () => {
        localStorage.setItem(SAVED_BIO_KEY, 'Best Mid EUW');
        localStorage.setItem(SAVED_AVAILABILITY_KEY, 'chat');
        localStorage.setItem(SAVED_ICON_KEY, '23');
        localStorage.setItem(SAVED_BACKGROUND_KEY, '103001');
        localStorage.setItem(SAVED_TOKENS_KEY, '[1,2,3]');
        localStorage.setItem(SAVED_TITLE_KEY, 'Challenger');

        render(
            <PresetsTab 
                lcu={mockLcu} 
                showToast={mockShowToast} 
                addLog={mockAddLog} 
                lcuRequest={mockLcuRequest} 
            />
        );

        await screen.findByText('Classic Solo Queue');

        const nameInput = screen.getByPlaceholderText(/edgy setup/i);
        fireEvent.change(nameInput, { target: { value: 'My Custom Preset' } });

        const saveBtn = screen.getByText('SAVE PRESET');
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('save_presets', expect.any(Object));
            expect(mockShowToast).toHaveBeenCalledWith('Preset "My Custom Preset" saved!', 'success');
        });
    });

    it('should apply a chosen preset successfully to the League client via LCU endpoint triggers', async () => {
        render(
            <PresetsTab 
                lcu={mockLcu} 
                showToast={mockShowToast} 
                addLog={mockAddLog} 
                lcuRequest={mockLcuRequest} 
            />
        );

        await screen.findByText('Classic Solo Queue');

        const loadBtn = screen.getByText('LOAD');
        fireEvent.click(loadBtn);

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('update_bio', { port: '1234', token: 'secret', newBio: 'Tryharding' });
            expect(mockLcuRequest).toHaveBeenCalledWith('PUT', '/lol-chat/v1/me', { availability: 'dnd' });
            expect(mockLcuRequest).toHaveBeenCalledWith('PUT', '/lol-summoner/v1/current-summoner/icon', { profileIconId: 500 });
            expect(mockLcuRequest).toHaveBeenCalledWith('POST', '/lol-summoner/v1/current-summoner/summoner-profile', {
                key: 'backgroundSkinId',
                value: 266000
            });
            expect(mockLcuRequest).toHaveBeenCalledWith('POST', '/lol-challenges/v1/update-player-preferences', {
                challengeIds: [1, 2, 3],
                title: 'Challenger',
                bannerAccent: '3',
                crestBorder: '5',
                prestigeCrestBorderLevel: 0
            });
            expect(mockShowToast).toHaveBeenCalledWith('Preset "Classic Solo Queue" applied successfully!', 'success');
        });
    });

    it('removes an active GIF when loading a preset with a Riot background', async () => {
        localStorage.setItem(SAVED_CUSTOM_BACKGROUND_KEY, '{"active":true,"fileName":"animated.gif"}');
        render(<PresetsTab lcu={mockLcu} showToast={mockShowToast} addLog={mockAddLog} lcuRequest={mockLcuRequest} />);
        await screen.findByText('Classic Solo Queue');
        fireEvent.click(screen.getByText('LOAD'));
        await waitFor(() => expect(invoke).toHaveBeenCalledWith('clear_custom_background'));
        expect(localStorage.getItem(SAVED_CUSTOM_BACKGROUND_KEY)).toBeNull();
    });

    it('should not send title when preset title is -1', async () => {
        const presetWithMinusOneTitle = [{
            id: 'preset-2',
            name: 'No Title Preset',
            bio: null,
            availability: null,
            iconId: null,
            backgroundId: null,
            tokens: '[1]',
            title: '-1',
        }];
        vi.mocked(invoke).mockResolvedValue(JSON.stringify(presetWithMinusOneTitle));

        render(
            <PresetsTab
                lcu={mockLcu}
                showToast={mockShowToast}
                addLog={mockAddLog}
                lcuRequest={mockLcuRequest}
            />
        );

        await screen.findByText('No Title Preset');

        const loadBtn = screen.getByText('LOAD');
        fireEvent.click(loadBtn);

        await waitFor(() => {
            const updateCall = mockLcuRequest.mock.calls.find(
                (c: any[]) => c[0] === 'POST' && c[1].includes('update-player-preferences')
            );
            expect(updateCall).toBeDefined();
            expect(updateCall![2].title).toBeUndefined();
        });
    });

    it('should apply preset even when summary fetch fails', async () => {
        mockLcuRequest.mockImplementation((method: string, endpoint: string) => {
            if (method === 'GET' && endpoint.includes('summary-player-data')) {
                return Promise.reject(new Error('Summary unavailable'));
            }
            return Promise.resolve({});
        });

        render(
            <PresetsTab
                lcu={mockLcu}
                showToast={mockShowToast}
                addLog={mockAddLog}
                lcuRequest={mockLcuRequest}
            />
        );

        await screen.findByText('Classic Solo Queue');

        const loadBtn = screen.getByText('LOAD');
        fireEvent.click(loadBtn);

        await waitFor(() => {
            const updateCall = mockLcuRequest.mock.calls.find(
                (c: any[]) => c[0] === 'POST' && c[1].includes('update-player-preferences')
            );
            expect(updateCall).toBeDefined();
            expect(updateCall![2].challengeIds).toEqual([1, 2, 3]);
            expect(updateCall![2].title).toBe('Challenger');
        });
    });

    it('should delete a selected preset', async () => {
        render(
            <PresetsTab 
                lcu={mockLcu} 
                showToast={mockShowToast} 
                addLog={mockAddLog} 
                lcuRequest={mockLcuRequest} 
            />
        );

        await screen.findByText('Classic Solo Queue');

        const deleteBtn = screen.getByTitle('Delete preset');
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('save_presets', { data: '[]' });
            expect(mockShowToast).toHaveBeenCalledWith('Preset deleted.', 'success');
        });
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsTab from './SettingsTab';

const mockInvoke = vi.fn();
const mockOpen = vi.fn();
const mockSave = vi.fn();

vi.mock('@tauri-apps/plugin-autostart', () => ({
    enable: vi.fn(),
    disable: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: (...args: unknown[]) => mockOpen(...args),
    save: (...args: unknown[]) => mockSave(...args),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('SettingsTab', () => {
    const mockProps = {
        isAutostartEnabled: false,
        setIsAutostartEnabled: vi.fn(),
        minimizeToTray: false,
        toggleMinimizeToTray: vi.fn(),
        latestVersion: '1.4.0',
        clientVersion: '1.3.7',
        addLog: vi.fn(),
    };

    it('should render technical settings', () => {
        render(<SettingsTab {...mockProps} />);
        expect(screen.getByText('Technical Settings')).toBeDefined();
        expect(screen.getByText('Auto-launch')).toBeDefined();
        expect(screen.getByText('Minimize to Tray')).toBeDefined();
    });

    it('should have accessible labels for switches', () => {
        render(<SettingsTab {...mockProps} />);
        expect(screen.getByText('Toggle Auto-launch')).toHaveClass('sr-only');
        expect(screen.getByText('Toggle Minimize to Tray')).toHaveClass('sr-only');
    });

    it('should show update panel when a new version is available', () => {
        render(<SettingsTab {...mockProps} />);
        expect(screen.getByText('New Enhancement Available')).toBeDefined();
        expect(screen.getByText('UPDATE NOW')).toHaveAttribute('href', 'https://github.com/lenny-ts/league_profile_tool/releases/latest');
    });

    it('should not show update panel when version is up to date', () => {
        render(<SettingsTab {...mockProps} latestVersion="1.3.7" />);
        expect(screen.queryByText('New Enhancement Available')).toBeNull();
    });

    it('should call setIsAutostartEnabled and addLog when auto-launch is clicked', async () => {
        render(<SettingsTab {...mockProps} />);
        const autostartRow = screen.getByText('Auto-launch').closest('button');
        if (!autostartRow) throw new Error('Button not found');

        await fireEvent.click(autostartRow);
        expect(mockProps.setIsAutostartEnabled).toHaveBeenCalledWith(true);
        expect(mockProps.addLog).toHaveBeenCalledWith('Auto-launch enabled.');
    });

    it('should call toggleMinimizeToTray when minimize to tray is clicked', () => {
        render(<SettingsTab {...mockProps} />);
        const minimizeRow = screen.getByText('Minimize to Tray').closest('button');
        if (!minimizeRow) throw new Error('Button not found');

        fireEvent.click(minimizeRow);
        expect(mockProps.toggleMinimizeToTray).toHaveBeenCalled();
    });

    it('should toggle auto-restore profile state', () => {
        localStorage.clear();
        render(<SettingsTab {...mockProps} />);
        const autoRestoreRow = screen.getByText('Auto-Restore Profile').closest('button');
        if (!autoRestoreRow) throw new Error('Button not found');

        fireEvent.click(autoRestoreRow);
        expect(localStorage.getItem('profile_auto_enforce_v1')).toBe('true');
        expect(mockProps.addLog).toHaveBeenCalledWith('Auto-Enforcer enabled.');

        fireEvent.click(autoRestoreRow);
        expect(localStorage.getItem('profile_auto_enforce_v1')).toBe('false');
        expect(mockProps.addLog).toHaveBeenCalledWith('Auto-Enforcer disabled.');
    });

    it('should show checkbox panel when Clear Saved Data is clicked', () => {
        render(<SettingsTab {...mockProps} />);
        fireEvent.click(screen.getByText('Clear Saved Data'));
        expect(screen.getByText('What to clear?')).toBeDefined();
        expect(screen.getByText('Clear Selected')).toBeDefined();
        expect(screen.getByText('Cancel')).toBeDefined();
    });

    it('should render all reset options', () => {
        render(<SettingsTab {...mockProps} />);
        fireEvent.click(screen.getByText('Clear Saved Data'));
        expect(screen.getByText('Rank overrides')).toBeDefined();
        expect(screen.getByText('Challenge overrides')).toBeDefined();
        expect(screen.getByText('Background skin & custom')).toBeDefined();
        expect(screen.getByText('Tokens, Title, Banner & Crest')).toBeDefined();
        expect(screen.getByText('Profile icon')).toBeDefined();
        expect(screen.getByText('Status & Bio')).toBeDefined();
        expect(screen.getByText('Auto-Enforcer & localStorage')).toBeDefined();
    });

    it('should hide checkbox panel on Cancel', () => {
        render(<SettingsTab {...mockProps} />);
        fireEvent.click(screen.getByText('Clear Saved Data'));
        fireEvent.click(screen.getByText('Cancel'));
        expect(screen.queryByText('What to clear?')).toBeNull();
    });

    it('should call lcuRequest when Clear Selected is clicked with default options', async () => {
        localStorage.setItem('profile_saved_icon_v1', '42');
        const lcuReq = vi.fn(() => Promise.resolve({ lol: {} }));
        render(<SettingsTab {...mockProps} lcuRequest={lcuReq} showToast={vi.fn()} />);
        fireEvent.click(screen.getByText('Clear Saved Data'));
        fireEvent.click(screen.getByText('Clear Selected'));
        expect(localStorage.getItem('profile_auto_enforce_v1')).toBeNull();
        await waitFor(() => {
            expect(lcuReq).toHaveBeenCalledWith('GET', '/lol-chat/v1/me');
        });
    });

    it('should clear the Pengu rank and overview override when rank is cleared', async () => {
        localStorage.setItem('pengu_overview_override_v1', 'true');
        localStorage.setItem('profile_saved_custom_background_v1', '{"active":true}');
        render(<SettingsTab {...mockProps} showToast={vi.fn()} />);
        fireEvent.click(screen.getByText('Clear Saved Data'));
        expect(screen.getByText('Overview Cards')).toBeDefined();
        fireEvent.click(screen.getByText('Clear Selected'));

        await waitFor(() => {
            expect(localStorage.getItem('pengu_overview_override_v1')).toBeNull();
            expect(localStorage.getItem('profile_saved_custom_background_v1')).toBeNull();
            expect(mockInvoke).toHaveBeenCalledWith('clear_custom_background');
            expect(mockInvoke).toHaveBeenCalledWith('save_rank_config', {
                tier: 'NONE',
                division: 'I',
                queue: 'RANKED_SOLO_5x5',
                leaguePoints: 0,
                lastSeasonTier: 'UNRANKED',
                borderTier: 'AUTO',
                bannerTier: 'AUTO',
                honorLevel: 'AUTO',
                masteryScore: '',
                masteryLevel: 'AUTO',
                masteryLevel2: 'AUTO',
                masteryLevel3: 'AUTO',
                masteryChampionId: 'AUTO',
                masteryChampionId2: 'AUTO',
                masteryChampionId3: 'AUTO',
                trophyTheme: 'AUTO',
                trophyBracket: 4,
                trophyTier: 4,
                clashBannerTheme: 'AUTO',
                clashBannerLevel: 1,
                overviewEnabled: false,
            });
        });
    });

    it('should not call lcuRequest when all options are unchecked', () => {
        const lcuReq = vi.fn(() => Promise.resolve({ lol: {} }));
        render(<SettingsTab {...mockProps} lcuRequest={lcuReq} showToast={vi.fn()} />);
        fireEvent.click(screen.getByText('Clear Saved Data'));
        const checkboxes = screen.getAllByRole('checkbox');
        checkboxes.forEach(cb => fireEvent.click(cb));
        fireEvent.click(screen.getByText('Clear Selected'));
        expect(lcuReq).not.toHaveBeenCalled();
    });

    describe('importSettings', () => {
        beforeEach(() => {
            mockInvoke.mockReset();
            mockOpen.mockReset();
            localStorage.clear();
        });

        it('should import settings from a JSON file via Tauri invoke', async () => {
            const fileContent = JSON.stringify({
                profile_saved_icon_v1: '99',
                profile_auto_enforce_v1: 'true',
                profile_saved_bio_v1: 'Hello World',
            });
            mockOpen.mockResolvedValue('/fake/path/settings.json');
            mockInvoke.mockResolvedValue(fileContent);

            const showToast = vi.fn();
            render(<SettingsTab {...mockProps} showToast={showToast} />);

            fireEvent.click(screen.getByText('Import'));
            await waitFor(() => {
                expect(mockInvoke).toHaveBeenCalledWith('read_text_file', { path: '/fake/path/settings.json' });
            });

            expect(localStorage.getItem('profile_saved_icon_v1')).toBe('99');
            expect(localStorage.getItem('profile_auto_enforce_v1')).toBe('true');
            expect(localStorage.getItem('profile_saved_bio_v1')).toBe('Hello World');
            expect(showToast).toHaveBeenCalledWith('Settings imported! Restart for full effect.', 'success');
        });

        it('should remove keys that are null in the imported JSON', async () => {
            localStorage.setItem('profile_saved_icon_v1', 'old-value');
            const fileContent = JSON.stringify({ profile_saved_icon_v1: null });
            mockOpen.mockResolvedValue('/fake/path.json');
            mockInvoke.mockResolvedValue(fileContent);

            render(<SettingsTab {...mockProps} showToast={vi.fn()} />);
            fireEvent.click(screen.getByText('Import'));
            await waitFor(() => {
                expect(localStorage.getItem('profile_saved_icon_v1')).toBeNull();
            });
        });

        it('should sanitize control characters from imported values', async () => {
            const malicious = 'hello\x00\x01\x02world\x7F';
            const fileContent = JSON.stringify({ profile_saved_bio_v1: malicious });
            mockOpen.mockResolvedValue('/fake/path.json');
            mockInvoke.mockResolvedValue(fileContent);

            render(<SettingsTab {...mockProps} showToast={vi.fn()} />);
            fireEvent.click(screen.getByText('Import'));
            await waitFor(() => {
                const stored = localStorage.getItem('profile_saved_bio_v1');
                expect(stored).toBe('helloworld');
                expect(stored).not.toContain('\x00');
                expect(stored).not.toContain('\x7F');
            });
        });

        it('should not write non-string values to localStorage', async () => {
            const fileContent = JSON.stringify({ profile_saved_icon_v1: 42 });
            mockOpen.mockResolvedValue('/fake/path.json');
            mockInvoke.mockResolvedValue(fileContent);

            render(<SettingsTab {...mockProps} showToast={vi.fn()} />);
            fireEvent.click(screen.getByText('Import'));
            await waitFor(() => {
                expect(localStorage.getItem('profile_saved_icon_v1')).toBeNull();
            });
        });

        it('should handle import failure gracefully', async () => {
            mockOpen.mockResolvedValue('/fake/path.json');
            mockInvoke.mockRejectedValue(new Error('Read error'));

            const showToast = vi.fn();
            render(<SettingsTab {...mockProps} showToast={showToast} />);
            fireEvent.click(screen.getByText('Import'));
            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Settings import failed', 'error');
            });
        });

        it('should do nothing when no file is selected', async () => {
            mockOpen.mockResolvedValue(null);
            render(<SettingsTab {...mockProps} showToast={vi.fn()} />);
            fireEvent.click(screen.getByText('Import'));
            await waitFor(() => {
                expect(mockInvoke).not.toHaveBeenCalled();
            });
        });
    });

    describe('PenguLoader Integration', () => {
        beforeEach(() => {
            mockInvoke.mockReset();
            localStorage.clear();
        });

        it('should show install button with correct label when not installed', () => {
            render(<SettingsTab {...mockProps} />);
            expect(screen.getByText('Install Plugin')).toBeDefined();
            expect(screen.queryByText('Reinstall Plugin')).toBeNull();
            expect(screen.queryByText('✓ Plugin installed')).toBeNull();
        });

        it('should show reinstall button and status when plugin is installed', () => {
            localStorage.setItem('pengu_plugin_installed_v1', 'true');
            render(<SettingsTab {...mockProps} />);
            expect(screen.getByText('Reinstall Plugin')).toBeDefined();
            expect(screen.queryByText('Install Plugin')).toBeNull();
            expect(screen.getByText('✓ Plugin installed')).toBeDefined();
        });

        it('should install plugin successfully and update state', async () => {
            mockInvoke.mockResolvedValue('Plugin installed');
            const showToast = vi.fn();
            render(<SettingsTab {...mockProps} showToast={showToast} />);

            fireEvent.click(screen.getByText('Install Plugin'));
            await waitFor(() => {
                expect(mockInvoke).toHaveBeenCalledWith('install_pengu_plugin');
                expect(showToast).toHaveBeenCalledWith('Plugin installed! Restart League Client.', 'success');
                expect(screen.getByText('✓ Plugin installed')).toBeDefined();
            });
        });

        it('should handle plugin install failure gracefully', async () => {
            mockInvoke.mockRejectedValue(new Error('Pengu Loader not found'));
            const showToast = vi.fn();
            render(<SettingsTab {...mockProps} showToast={showToast} />);

            fireEvent.click(screen.getByText('Install Plugin'));
            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Install failed: Error: Pengu Loader not found', 'error');
            });
        });

        it('should open plugins folder successfully', async () => {
            mockInvoke.mockResolvedValue('Opened');
            render(<SettingsTab {...mockProps} />);

            fireEvent.click(screen.getByText('Open Plugins Folder'));
            await waitFor(() => {
                expect(mockInvoke).toHaveBeenCalledWith('open_pengu_plugins_folder');
                expect(mockProps.addLog).toHaveBeenCalledWith('Opened Pengu Loader plugins folder.');
            });
        });

        it('should handle open plugins folder failure', async () => {
            mockInvoke.mockRejectedValue(new Error('Folder not found'));
            const showToast = vi.fn();
            render(<SettingsTab {...mockProps} showToast={showToast} />);

            fireEvent.click(screen.getByText('Open Plugins Folder'));
            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Failed to open folder: Error: Folder not found', 'error');
            });
        });

        it('should show manual installation instructions', () => {
            render(<SettingsTab {...mockProps} />);
            expect(screen.getByText('Manual Installation:')).toBeDefined();
            expect(screen.getByText(/Copy the complete/)).toBeDefined();
            expect(screen.getByText(/Pengu Loader\\plugins\\rank-override/)).toBeDefined();
        });

        it('should show download link', () => {
            render(<SettingsTab {...mockProps} />);
            const link = screen.getByText('Download Pengu Loader').closest('a');
            expect(link).toHaveAttribute('href', 'https://github.com/PenguLoader/PenguLoader/releases');
            expect(link).toHaveAttribute('target', '_blank');
        });
    });

    describe('exportSettings', () => {
        beforeEach(() => {
            mockInvoke.mockReset();
            mockSave.mockReset();
            localStorage.clear();
        });

        it('should export settings to a file via Tauri invoke', async () => {
            localStorage.setItem('profile_saved_icon_v1', '55');
            mockSave.mockResolvedValue('/fake/export.json');
            mockInvoke.mockResolvedValue(undefined);

            const showToast = vi.fn();
            render(<SettingsTab {...mockProps} showToast={showToast} />);
            fireEvent.click(screen.getByText('Export'));
            await waitFor(() => {
                expect(mockInvoke).toHaveBeenCalledWith(
                    'save_logs_to_path',
                    expect.objectContaining({ path: '/fake/export.json' })
                );
                expect(showToast).toHaveBeenCalledWith('Settings exported!', 'success');
            });
        });

        it('should not export when no save path is chosen', async () => {
            mockSave.mockResolvedValue(null);
            render(<SettingsTab {...mockProps} showToast={vi.fn()} />);
            fireEvent.click(screen.getByText('Export'));
            await waitFor(() => {
                expect(mockInvoke).not.toHaveBeenCalled();
            });
        });
    });
});

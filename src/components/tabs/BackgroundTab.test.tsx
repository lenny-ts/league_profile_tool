import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockInvoke = vi.fn();
const mockOpen = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: (...args: unknown[]) => mockOpen(...args),
}));

vi.mock('../../data/supplemental-skins.json', () => ({
    default: {
        "103": [{ id: 103086, name: "Immortalized Legend Ahri", isBase: false, splashPath: "/lol-game-data/assets/v1/champion-splashes/103/103086.jpg" }],
        "145": [{ id: 145071, name: "Signature Immortalized Legend Kai'Sa", isBase: false, splashPath: "/lol-game-data/assets/ASSETS/Characters/Kaisa/Skins/Skin71/Images/kaisa_splash_centered_71.jpg" }],
        "999": [{ id: 999001, name: "Skins From Unloaded Champ", isBase: false, splashPath: "/lol-game-data/assets/v1/champion-splashes/999/999001.jpg" }]
    }
}));

import BackgroundTab from './BackgroundTab';

describe('BackgroundTab', () => {
    const mockChampSummary = [
        { id: 1, name: 'Aatrox', alias: 'Aatrox', squarePortraitPath: '/assets/1.png' },
        { id: 103, name: 'Ahri', alias: 'Ahri', squarePortraitPath: '/assets/103.png' },
        { id: 145, name: "Kai'Sa", alias: 'Kaisa', squarePortraitPath: '/assets/145.png' },
        { id: 999, name: 'Unloadable', alias: 'Unloadable', squarePortraitPath: '/assets/999.png' }
    ];

    const mockSkins = {
        skins: [
            { id: 1000, name: 'Default Aatrox', isBase: true, splashPath: '/assets/1000.jpg' },
            { id: 1001, name: 'Justicar Aatrox', isBase: false, splashPath: '/assets/1001.jpg' }
        ]
    };

    const mockAhriSkins = {
        skins: [
            { id: 103000, name: 'Default Ahri', isBase: true, splashPath: '/assets/103000.jpg' },
            { id: 103001, name: 'Dynasty Ahri', isBase: false, splashPath: '/assets/103001.jpg' }
        ]
    };

    const mockKaisaSkins = {
        skins: [
            { id: 145000, name: "Kai'Sa", isBase: true, splashPath: '/assets/145000.jpg' },
            { id: 145070, name: "Risen Legend Kai'Sa", isBase: false, splashPath: '/assets/145070.jpg' }
        ]
    };

    const createProps = () => ({
        lcu: { port: '1234', token: 'secret' },
        loading: false,
        showToast: vi.fn(),
        addLog: vi.fn(),
        lcuRequest: vi.fn().mockResolvedValue({ backgroundSkinId: 0 })
    });

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockInvoke.mockResolvedValue(undefined);
        globalThis.fetch = vi.fn().mockImplementation((url) => {
            if (url.includes('champion-summary.json')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockChampSummary
                } as Response);
            }
            if (url.includes('champions/1.json')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockSkins
                } as Response);
            }
            if (url.includes('champions/103.json')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockAhriSkins
                } as Response);
            }
            if (url.includes('champions/145.json')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockKaisaSkins
                } as Response);
            }
            return Promise.reject(new Error('Unknown URL'));
        });
    });

    it('should install and persist a custom animated background', async () => {
        mockOpen.mockResolvedValue('C:\\images\\animated.gif');
        mockInvoke.mockImplementation((command: string) => Promise.resolve(command === 'save_custom_background' ? 'custom-background.gif' : command === 'read_custom_background_preview' ? 'data:image/gif;base64,R0lGODlh' : undefined));
        const props = createProps();
        render(<BackgroundTab {...props} />);

        fireEvent.click(screen.getByRole('tab', { name: 'Custom / GIF' }));
        fireEvent.click(screen.getByText('Choose File'));
        const preview = await screen.findByAltText('Custom background preview');
        fireEvent.change(screen.getByLabelText('Custom background fit'), { target: { value: 'contain' } });
        fireEvent.change(screen.getByLabelText('Custom background position'), { target: { value: 'top' } });
        fireEvent.change(screen.getByLabelText('Custom background darken'), { target: { value: '35' } });
        expect(preview).toHaveStyle({ objectFit: 'contain', objectPosition: 'top' });
        expect(document.querySelector('.custom-background-preview-dim')).toHaveStyle({ opacity: '0.35' });
        fireEvent.click(screen.getByText('APPLY CUSTOM'));

        await waitFor(() => {
            expect(mockInvoke).toHaveBeenCalledWith('install_pengu_plugin');
            expect(mockInvoke).toHaveBeenCalledWith('save_custom_background', {
                sourcePath: 'C:\\images\\animated.gif', fit: 'contain', position: 'top', dim: 35,
            });
            expect(JSON.parse(localStorage.getItem('profile_saved_custom_background_v1') || '{}')).toEqual({
                active: true, fileName: 'animated.gif', fit: 'contain', position: 'top', dim: 35,
            });
        });
    });

    it('should render and load champions', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        expect(screen.getByText('Profile Background')).toBeDefined();
        await waitFor(() => {
            expect(screen.getByText('Aatrox')).toBeDefined();
            expect(screen.getByText('Ahri')).toBeDefined();
        });
    });

    it('should filter champions by search', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        await screen.findByText('Aatrox');

        const input = screen.getByPlaceholderText(/Search by champion name/i);
        fireEvent.change(input, { target: { value: 'Ahri' } });

        expect(screen.queryByText('Aatrox')).toBeNull();
        expect(screen.getByText('Ahri')).toBeDefined();
    });

    it('should load skins when a champion is selected', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        const aatroxTxt = await screen.findByText('Aatrox');
        fireEvent.click(aatroxTxt.closest('button')!);

        await waitFor(() => {
            expect(screen.getByText('Justicar Aatrox')).toBeDefined();
            expect(screen.getByText('← BACK')).toBeDefined();
        });
    });

    it('should apply background when a skin is selected and clicked', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        // Select Champ
        const aatroxBtn1 = await screen.findByText('Aatrox');
        fireEvent.click(aatroxBtn1);
        
        // Select Skin
        const justicarTxt1 = await screen.findByText('Justicar Aatrox');
        const skinBtn = justicarTxt1.closest('button')!;
        fireEvent.click(skinBtn);

        // Click Apply
        const applyBtn = screen.getByText(/APPLY — Justicar Aatrox/i);
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(props.lcuRequest).toHaveBeenCalledWith('POST', expect.anything(), expect.objectContaining({ value: 1001 }));
            expect(props.showToast).toHaveBeenCalledWith(expect.stringContaining('Justicar Aatrox'), 'success');
        });
    });

    it('should handle direct skin ID input', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        await screen.findByText('Aatrox');

        const input = screen.getByPlaceholderText(/name or ID/i);
        fireEvent.change(input, { target: { value: '12345' } });

        const applyBtn = screen.getByText('APPLY');
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(props.lcuRequest).toHaveBeenCalledWith('POST', expect.anything(), expect.objectContaining({ value: 12345 }));
            expect(props.showToast).toHaveBeenCalledWith(expect.stringContaining('Skin 12345'), 'success');
        });
    });

    it('should show skin suggestions and apply by name', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        await screen.findByText('Aatrox');

        const input = screen.getByPlaceholderText(/name or ID/i);
        fireEvent.change(input, { target: { value: 'Justicar' } });

        const suggestion = await screen.findByText(/Justicar Aatrox/);
        expect(suggestion).toBeDefined();

        fireEvent.click(suggestion);

        const applyBtn = screen.getByText('APPLY');
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(props.lcuRequest).toHaveBeenCalledWith('POST', expect.anything(), expect.objectContaining({ value: 1001 }));
            expect(props.showToast).toHaveBeenCalledWith(expect.stringContaining('Justicar Aatrox'), 'success');
        });
    });

    it('should dismiss suggestions on outside click', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        await screen.findByText('Aatrox');

        const input = screen.getByPlaceholderText(/name or ID/i);
        fireEvent.change(input, { target: { value: 'Justicar' } });

        await screen.findByText(/Justicar Aatrox/);

        fireEvent.mouseDown(document.body);

        expect(screen.queryByText(/Justicar Aatrox/)).toBeNull();
    });

    it('should show suggestions again on focus if matches exist', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        await screen.findByText('Aatrox');

        const input = screen.getByPlaceholderText(/name or ID/i);
        fireEvent.change(input, { target: { value: 'Justicar' } });

        expect(await screen.findByText(/Justicar Aatrox/)).toBeDefined();

        // Dismiss by clicking outside
        fireEvent.mouseDown(document.body);
        expect(screen.queryByText(/Justicar Aatrox/)).toBeNull();

        // Focus input again
        fireEvent.focus(input);
        expect(await screen.findByText(/Justicar Aatrox/)).toBeDefined();
    });

    it('should disable APPLY with non-matching text input', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        await screen.findByText('Aatrox');

        const input = screen.getByPlaceholderText(/name or ID/i);
        fireEvent.change(input, { target: { value: 'zzzzz' } });

        const applyBtn = screen.getByText('APPLY').closest('button')!;
        expect(applyBtn.disabled).toBe(true);
    });

    it('should handle mouse hover on suggestion items', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        await screen.findByText('Aatrox');

        const input = screen.getByPlaceholderText(/name or ID/i);
        fireEvent.change(input, { target: { value: 'Justicar' } });

        const suggestion = await screen.findByText(/Justicar Aatrox/);
        const btn = suggestion.closest('button')!;

        fireEvent.mouseEnter(btn);
        expect(btn.style.background).toBe('rgba(59, 130, 246, 0.05)');

        fireEvent.mouseLeave(btn);
        expect(btn.style.background).toBe('none');
    });

    it('should go back to champion list from skin list', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        const aatroxBtn2 = await screen.findByText('Aatrox');
        fireEvent.click(aatroxBtn2);
        expect(await screen.findByTitle(/Justicar Aatrox/i)).toBeDefined();

        fireEvent.click(screen.getByText('← BACK'));
        expect(screen.getByText('Aatrox')).toBeDefined();
        expect(screen.queryByText('Justicar Aatrox')).toBeNull();
    });

    it('should show current background ID if LCU is connected', async () => {
        const props = createProps();
        props.lcuRequest = vi.fn().mockImplementation((_m, endpoint) => {
            if (endpoint === '/lol-summoner/v1/current-summoner/summoner-profile') {
                return Promise.resolve({ backgroundSkinId: 555 });
            }
            return Promise.resolve({});
        });

        render(<BackgroundTab {...props} />);

        expect(await screen.findByText('#555')).toBeDefined();
    });

    it('should show error toast if champion fetch fails', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
        const props = createProps();
        
        render(<BackgroundTab {...props} />);

        await waitFor(() => expect(props.showToast).toHaveBeenCalledWith('Failed to load champion list', 'error'));
    });

    it('should include supplemental skins from JSON data', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        const ahriTxt = await screen.findByText('Ahri');
        fireEvent.click(ahriTxt.closest('button')!);

        await waitFor(() => {
            expect(screen.getByText('Dynasty Ahri')).toBeDefined();
            expect(screen.getByText('Immortalized Legend Ahri')).toBeDefined();
            expect(screen.getByText('ID: 103086')).toBeDefined();
        });
    });

    it("should include Signature Immortalized Legend Kai'Sa in Kai'Sa skin list", async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        const kaisaTxt = await screen.findByText("Kai'Sa");
        fireEvent.click(kaisaTxt.closest('button')!);

        await waitFor(() => {
            expect(screen.getByText("Risen Legend Kai'Sa")).toBeDefined();
            expect(screen.getByText("Signature Immortalized Legend Kai'Sa")).toBeDefined();
            expect(screen.getByText('ID: 145071')).toBeDefined();
        });
    });

    it('should show placeholder when splash image fails to load', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        const aatroxBtn = await screen.findByText('Aatrox');
        fireEvent.click(aatroxBtn);

        const img = (await screen.findByAltText('Justicar Aatrox')) as HTMLImageElement;
        fireEvent.error(img);
        expect(img.src).toContain('data:image/svg+xml');

        // Select the skin to show preview strip
        fireEvent.click(screen.getByText('Justicar Aatrox'));
        const previewImg = await waitFor(() => document.querySelector('.bg-preview-thumb') as HTMLImageElement);
        fireEvent.error(previewImg);
        expect(previewImg.src).toContain('data:image/svg+xml');
    });

    it('should find supplemental skins for unloaded champions via search', async () => {
        const props = createProps();
        render(<BackgroundTab {...props} />);

        await screen.findByText('Aatrox');

        const input = screen.getByPlaceholderText(/name or ID/i);
        fireEvent.change(input, { target: { value: 'Skins From Unloaded' } });

        expect(await screen.findByText(/Skins From Unloaded Champ/)).toBeDefined();
    });

    it('should unify duplicate champions (e.g. mode IDs 60000+) and combine their skins', async () => {
        const duplicateChampsSummary = [
            { id: 1, name: 'Annie', alias: 'Annie', squarePortraitPath: '/assets/1.png' },
            { id: 60001, name: 'Annie', alias: 'Annie', squarePortraitPath: '/assets/60001.png' }
        ];

        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('champion-summary.json')) {
                return Promise.resolve({ ok: true, json: async () => duplicateChampsSummary } as Response);
            }
            if (url.includes('champions/1.json')) {
                return Promise.resolve({ ok: true, json: async () => ({ skins: [{ id: 1001, name: 'Goth Annie', isBase: false, splashPath: '/1001.jpg' }] }) } as Response);
            }
            if (url.includes('champions/60001.json')) {
                return Promise.resolve({ ok: true, json: async () => ({ skins: [{ id: 60001001, name: 'Swarm Goth Annie', isBase: false, splashPath: '/60001001.jpg' }] }) } as Response);
            }
            return Promise.reject(new Error('Unknown URL'));
        });

        const props = createProps();
        render(<BackgroundTab {...props} />);

        const annieButtons = await screen.findAllByText('Annie');
        // Annie should appear ONCE as a champion button in the grid
        expect(annieButtons).toHaveLength(1);

        fireEvent.click(annieButtons[0]!.closest('button')!);

        await waitFor(() => {
            expect(screen.getByText('Goth Annie')).toBeDefined();
            expect(screen.getByText('Swarm Goth Annie')).toBeDefined();
        });
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from './App';
import * as core from '@tauri-apps/api/core';
import * as app from '@tauri-apps/api/app';
import * as window from '@tauri-apps/api/window';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn().mockImplementation((cmd) => {
        if (cmd === 'get_lcu_credentials') {
            return Promise.resolve({ port: '1234', token: 'secret' });
        }
        return Promise.resolve(null);
    }),
}));

vi.mock('@tauri-apps/api/app', () => ({
    getVersion: vi.fn().mockResolvedValue('1.3.7'),
}));

vi.mock('@tauri-apps/api/window', () => ({
    LogicalSize: class LogicalSize {
        width: number;
        height: number;
        constructor(width: number, height: number) {
            this.width = width;
            this.height = height;
        }
    },
    currentMonitor: vi.fn().mockResolvedValue(null),
    getCurrentWindow: vi.fn().mockReturnValue({
        onCloseRequested: vi.fn().mockResolvedValue(() => {}),
        minimize: vi.fn(),
        close: vi.fn(),
        setSize: vi.fn().mockResolvedValue(undefined),
        center: vi.fn().mockResolvedValue(undefined),
    }),
}));

describe('App Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should render application layout and title', async () => {
        render(<App />);
        expect(await screen.findByText('Home')).toBeDefined();
        expect(screen.getByText('LPT CONTROL CENTER')).toBeDefined();
        expect(screen.getByText('Dashboard')).toBeDefined();
        const homeNav = screen.getByRole('button', { name: 'Home' });
        const firstCategory = homeNav.closest('nav')?.querySelector('.nav-category-title');
        expect(firstCategory).not.toBeNull();
        expect(homeNav.compareDocumentPosition(firstCategory as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('should initialize and show version', async () => {
        let resolveVersion: any;
        const versionPromise = new Promise(resolve => { resolveVersion = resolve; });
        vi.mocked(app.getVersion).mockReturnValue(versionPromise as any);

        render(<App />);
        expect(screen.getByText(/INITIALIZING/i)).toBeDefined();

        resolveVersion('1.3.7');

        expect(await screen.findByText('Home')).toBeDefined();
    });

    it('should switch tabs', async () => {
        render(<App />);

        const bioTabBtn = await screen.findByText(/Profile Bio/i);
        fireEvent.click(bioTabBtn);

        expect(await screen.findByRole('heading', { name: 'Profile Bio & Status' })).toBeDefined();
    });

    it('should open Overview Cards as a separate tab', async () => {
        render(<App />);
        fireEvent.click(await screen.findByText('Overview Cards'));
        expect(await screen.findByText('Honor & Mastery')).toBeDefined();
    });

    it('should handle app close request', async () => {
        let closeCallback: any;
        vi.mocked(window.getCurrentWindow).mockReturnValue({
            onCloseRequested: vi.fn().mockImplementation(async (cb) => {
                closeCallback = cb;
                return vi.fn();
            }),
        } as any);

        render(<App />);

        await waitFor(() => expect(closeCallback).toBeDefined());

        const mockEvent = { preventDefault: vi.fn() };
        await closeCallback(mockEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(core.invoke).toHaveBeenCalledWith('force_quit');
    });

    it('should toggle sidebar collapse state', async () => {
        render(<App />);
        expect(await screen.findByText('Home')).toBeDefined();

        const toggleBtn = screen.getByTitle(/Collapse Menu/i);
        fireEvent.click(toggleBtn);

        expect(screen.getByTitle(/Expand Menu/i)).toBeDefined();
    });

    it('should handle init failure gracefully', async () => {
        vi.mocked(app.getVersion).mockRejectedValue(new Error('Init Failed'));

        render(<App />);
        expect(await screen.findByText('Home')).toBeDefined();
    });

    it('should toggle minimize to tray', async () => {
        vi.mocked(core.invoke).mockResolvedValue(true);
        render(<App />);

        expect(await screen.findByText('Home')).toBeDefined();

        fireEvent.click(screen.getByText('Settings'));

        expect(await screen.findByText('Technical Settings')).toBeDefined();

        const logsTabBtn = screen.getByText(/System Logs/i).closest('.nav-item') as HTMLElement;
        fireEvent.keyDown(logsTabBtn, { key: 'Enter', code: 'Enter' });
    });
});
